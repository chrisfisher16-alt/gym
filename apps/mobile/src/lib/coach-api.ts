// ── Coach API Layer ─────────────────────────────────────────────────
// Functions for AI coach features. Uses client-side AI providers instead
// of Supabase Edge Functions.

import { sendAIMessage, sendWorkoutCoachMessage, sendNutritionCoachMessage, type AIClientResponse } from './ai-client';
import { buildExerciseAdjustmentSystemPrompt } from './coach-system-prompt';
import type { AIMessage } from './ai-provider';

// ── Types ───────────────────────────────────────────────────────────

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  model: string;
  isDemo: boolean;
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
 * Send a chat message to the AI coach.
 * Uses the client-side AI provider (demo, Groq, OpenAI, Ollama).
 */
export async function sendChatMessage(
  conversationId: string | undefined,
  message: string,
  context: string = 'general',
  history: AIMessage[] = [],
): Promise<ChatResponse> {
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

/**
 * Send a quick in-workout coach message.
 */
export async function sendWorkoutQuickMessage(
  message: string,
  exerciseName?: string,
): Promise<AIClientResponse> {
  return sendWorkoutCoachMessage(message, exerciseName);
}

/**
 * Send a quick in-nutrition coach message.
 */
export async function sendNutritionQuickMessage(
  message: string,
): Promise<AIClientResponse> {
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
