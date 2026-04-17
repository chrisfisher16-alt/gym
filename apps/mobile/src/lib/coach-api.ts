// ── Coach API Layer ─────────────────────────────────────────────────
// Primary chat goes through the Supabase `coach-chat` Edge Function so
// the Anthropic key stays server-side. Falls back to the client-side AI
// provider only when Supabase is unconfigured or the user has no session
// (e.g. demo/preview mode).

import { sendAIMessage, sendWorkoutCoachMessage, sendNutritionCoachMessage, type AIClientResponse } from './ai-client';
import { buildExerciseAdjustmentSystemPrompt } from './coach-system-prompt';
import type { AIMessage } from './ai-provider';
import { supabase, isSupabaseConfigured } from './supabase';
import { useProfileStore } from '../stores/profile-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { getDateString } from './nutrition-utils';
import type { DailyNutritionLog } from '../types/nutrition';

// ── Types ───────────────────────────────────────────────────────────

export interface StructuredContent {
  type: 'workout_plan' | 'nutrition_summary' | 'meal_analysis' | 'weekly_summary' | 'progress_chart' | 'action_button' | 'text';
  data: Record<string, unknown>;
}

export interface ChatResponse {
  /** Server-side conversation id (UUID). Absent when running via the client-side fallback. */
  conversation_id: string;
  message_id: string;
  content: string;
  model: string;
  isDemo: boolean;
  structured_content?: StructuredContent[];
}

interface EdgeChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  structured_content?: StructuredContent[];
  model: string;
  tokens?: { input: number; output: number; total: number };
}

export interface ParsedMealItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity: number;
  unit: string;
  is_estimate: boolean;
  confidence: number;
}

// ── API Functions ───────────────────────────────────────────────────

/**
 * Send a chat message to the AI coach. Prefers the server-side `coach-chat`
 * Edge Function; falls back to the client-side provider only when the user
 * has no Supabase session.
 *
 * `conversationId` should be the server-side (remote) conversation id from a
 * prior response, or undefined to start a new server-side conversation.
 */
export async function sendChatMessage(
  conversationId: string | undefined,
  message: string,
  context: string = 'general',
  history: AIMessage[] = [],
): Promise<ChatResponse> {
  if (isSupabaseConfigured) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data, error } = await supabase.functions.invoke<EdgeChatResponse>('coach-chat', {
          body: {
            message,
            conversation_id: conversationId,
            context,
          },
        });
        if (error) throw error;
        if (data) {
          return {
            conversation_id: data.conversation_id,
            message_id: data.message_id,
            content: data.content,
            model: data.model,
            isDemo: false,
            structured_content: data.structured_content,
          };
        }
      }
    } catch (error) {
      console.warn('coach-chat edge function failed, falling back to client-side provider:', error);
    }
  }

  // Fallback: client-side provider (demo mode or offline/unauthenticated)
  const response = await sendAIMessage(message, {
    history,
    context: context as 'general' | 'workout' | 'nutrition',
  });

  return {
    conversation_id: conversationId ?? '',
    message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: response.content,
    model: response.model,
    isDemo: response.isDemo,
  };
}

// ── Coach Quick Edge Function helpers ───────────────────────────────

interface CoachQuickResponse {
  content: string;
  model: string;
}

async function hasAuthedSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/**
 * Collect the nutrition context the Edge Function needs to build the
 * in-nutrition system prompt (targets, today's totals, allergies, etc.).
 */
function gatherNutritionContext(): Record<string, unknown> {
  const profile = useProfileStore.getState().profile;
  const nutrition = useNutritionStore.getState();

  const ctx: Record<string, unknown> = {
    targets: {
      calories: nutrition.targets.calories,
      protein_g: nutrition.targets.protein_g,
      carbs_g: nutrition.targets.carbs_g,
      fat_g: nutrition.targets.fat_g,
    },
  };

  const todayStr = getDateString(new Date());
  const logs = (nutrition.dailyLogs ?? {}) as Record<string, DailyNutritionLog>;
  const todayLog = logs[todayStr];
  if (todayLog && todayLog.meals.length > 0) {
    let cals = 0, protein = 0, carbs = 0, fat = 0;
    for (const meal of todayLog.meals) {
      for (const item of meal.items) {
        cals += item.calories;
        protein += item.protein_g;
        carbs += item.carbs_g;
        fat += item.fat_g;
      }
    }
    ctx.today_totals = {
      calories: Math.round(cals),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      meal_count: todayLog.meals.length,
    };
  }

  if (profile.allergies?.length) ctx.allergies = profile.allergies;
  if (profile.dietaryPreferences?.length) ctx.dietary_preferences = profile.dietaryPreferences;

  return ctx;
}

/**
 * Send a quick in-workout coach message. Prefers the `coach-quick`
 * Edge Function; falls back to the client-side provider when the user
 * has no Supabase session (demo/preview mode).
 */
export async function sendWorkoutQuickMessage(
  message: string,
  exerciseName?: string,
): Promise<AIClientResponse> {
  if (await hasAuthedSession()) {
    try {
      const { data, error } = await supabase.functions.invoke<CoachQuickResponse>('coach-quick', {
        body: {
          mode: 'workout',
          message,
          workout: exerciseName ? { current_exercise: exerciseName } : undefined,
        },
      });
      if (error) throw error;
      if (data) return { content: data.content, model: data.model, isDemo: false };
    } catch (error) {
      console.warn('coach-quick (workout) failed, falling back to client-side provider:', error);
    }
  }
  return sendWorkoutCoachMessage(message, exerciseName);
}

/**
 * Send a quick in-nutrition coach message. Prefers the `coach-quick`
 * Edge Function; falls back to the client-side provider when the user
 * has no Supabase session.
 */
export async function sendNutritionQuickMessage(
  message: string,
): Promise<AIClientResponse> {
  if (await hasAuthedSession()) {
    try {
      const nutritionContext = gatherNutritionContext();
      const { data, error } = await supabase.functions.invoke<CoachQuickResponse>('coach-quick', {
        body: {
          mode: 'nutrition',
          message,
          nutrition: nutritionContext,
        },
      });
      if (error) throw error;
      if (data) return { content: data.content, model: data.model, isDemo: false };
    } catch (error) {
      console.warn('coach-quick (nutrition) failed, falling back to client-side provider:', error);
    }
  }
  return sendNutritionCoachMessage(message);
}

// ── Exercise Adjustment ─────────────────────────────────────────────

export interface ExerciseAdjustmentReplace {
  action: 'replace';
  currentExercise: string;
  exerciseName: string;
  reason: string;
}

export interface ExerciseAdjustmentSets {
  action: 'adjust_sets';
  currentExercise: string;
  sets?: number;
  reps?: string;
  reason: string;
}

export type ExerciseAdjustment = ExerciseAdjustmentReplace | ExerciseAdjustmentSets;

export interface ExerciseAdjustmentResponse {
  content: string;
  /** @deprecated Use adjustments array instead. */
  adjustment: ExerciseAdjustment | null;
  /** Array of all proposed adjustments (may be 1 or more). */
  adjustments: ExerciseAdjustment[];
  model: string;
  isDemo: boolean;
}

/**
 * Parse a single adjustment object into a typed ExerciseAdjustment.
 */
function parseSingleAdjustment(obj: Record<string, unknown>, fallbackCurrentExercise?: string): ExerciseAdjustment | null {
  const currentExercise = (obj.currentExercise as string) ?? fallbackCurrentExercise ?? '';
  if (obj.action === 'replace' && obj.exerciseName) {
    return {
      action: 'replace',
      currentExercise,
      exerciseName: obj.exerciseName as string,
      reason: (obj.reason as string) ?? '',
    };
  }
  if (obj.action === 'adjust_sets') {
    return {
      action: 'adjust_sets',
      currentExercise,
      sets: obj.sets as number | undefined,
      reps: obj.reps as string | undefined,
      reason: (obj.reason as string) ?? '',
    };
  }
  return null;
}

/**
 * Parse structured JSON adjustment block(s) from AI response text.
 * Supports both the new {"adjustments":[...]} array format and the
 * legacy single-object format for backwards compatibility.
 */
function parseAdjustmentsFromResponse(text: string, fallbackCurrentExercise?: string): ExerciseAdjustment[] {
  // Try fenced code block first
  const fencedMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fencedMatch?.[1]?.trim();

  const tryParse = (str: string): ExerciseAdjustment[] => {
    try {
      const parsed = JSON.parse(str);

      // New array format: {"adjustments": [...]}
      if (parsed.adjustments && Array.isArray(parsed.adjustments)) {
        const results: ExerciseAdjustment[] = [];
        for (const item of parsed.adjustments) {
          const adj = parseSingleAdjustment(item, fallbackCurrentExercise);
          if (adj) results.push(adj);
        }
        return results;
      }

      // Legacy single-object format: {"action": "replace", ...}
      const single = parseSingleAdjustment(parsed, fallbackCurrentExercise);
      return single ? [single] : [];
    } catch { /* ignore parse errors */ }
    return [];
  };

  if (jsonStr) {
    return tryParse(jsonStr);
  }

  // Try bare JSON on its own line
  const bareMatch = text.match(/^(\{["'](?:adjustments|action)[\s\S]*?\})$/m);
  if (bareMatch) {
    return tryParse(bareMatch[1]);
  }

  return [];
}

/**
 * Strip the JSON code block from the response text so the user sees
 * only the natural-language portion.
 */
function stripJsonBlock(text: string): string {
  return text
    .replace(/```json\s*\n?[\s\S]*?\n?```/g, '')
    .replace(/^\{"action"[^}]+\}$/gm, '')
    .trim();
}

/**
 * Request an exercise adjustment from the AI coach.
 * Returns both the human-readable text and parsed adjustment action(s).
 *
 * @param currentExerciseName - The exercise the user is currently focused on.
 * @param availableExerciseNames - All exercises in the library.
 * @param userRequest - The user's message.
 * @param workoutExercises - All exercises in the current workout (for multi-adjust).
 */
export async function requestExerciseAdjustment(
  currentExerciseName: string,
  availableExerciseNames: string[],
  userRequest: string,
  workoutExercises?: Array<{ name: string; exerciseId: string }>,
): Promise<ExerciseAdjustmentResponse> {
  // Prefer the server-side `coach-quick` Edge Function so the AI key
  // stays off the client. Client still parses the returned JSON block
  // to extract structured adjustment actions.
  if (await hasAuthedSession()) {
    try {
      const { data, error } = await supabase.functions.invoke<CoachQuickResponse>('coach-quick', {
        body: {
          mode: 'exercise_adjustment',
          message: userRequest,
          adjustment: {
            current_exercise: currentExerciseName,
            workout_exercises: workoutExercises?.map((e) => ({ name: e.name })),
            available_exercises: availableExerciseNames,
          },
        },
      });
      if (error) throw error;
      if (data) {
        const adjustments = parseAdjustmentsFromResponse(data.content, currentExerciseName);
        const content = stripJsonBlock(data.content);
        return {
          content,
          adjustment: adjustments[0] ?? null,
          adjustments,
          model: data.model,
          isDemo: false,
        };
      }
    } catch (error) {
      console.warn('coach-quick (exercise_adjustment) failed, falling back to client-side provider:', error);
    }
  }

  // Fallback: client-side provider (demo/preview mode or no session)
  const response = await sendAIMessage(userRequest, {
    systemPrompt: buildExerciseAdjustmentSystemPrompt(
      currentExerciseName,
      availableExerciseNames,
      workoutExercises,
    ),
    context: 'workout',
  });

  const adjustments = parseAdjustmentsFromResponse(response.content, currentExerciseName);
  const content = stripJsonBlock(response.content);

  return {
    content,
    adjustment: adjustments[0] ?? null,
    adjustments,
    model: response.model,
    isDemo: response.isDemo,
  };
}
