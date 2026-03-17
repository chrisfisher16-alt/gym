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
  exerciseName: string;
  reason: string;
}

export interface ExerciseAdjustmentSets {
  action: 'adjust_sets';
  sets?: number;
  reps?: string;
  reason: string;
}

export type ExerciseAdjustment = ExerciseAdjustmentReplace | ExerciseAdjustmentSets;

export interface ExerciseAdjustmentResponse {
  content: string;
  adjustment: ExerciseAdjustment | null;
  model: string;
  isDemo: boolean;
}

/**
 * Parse a structured JSON adjustment block from AI response text.
 * Looks for ```json ... ``` fenced blocks or bare JSON objects.
 */
function parseAdjustmentFromResponse(text: string): ExerciseAdjustment | null {
  // Try fenced code block first
  const fencedMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fencedMatch?.[1]?.trim();

  if (!jsonStr) {
    // Try bare JSON object on its own line
    const bareMatch = text.match(/^(\{"action"[^}]+\})$/m);
    if (!bareMatch) return null;
    try {
      const parsed = JSON.parse(bareMatch[1]);
      if (parsed.action === 'replace' && parsed.exerciseName) return parsed;
      if (parsed.action === 'adjust_sets') return parsed;
    } catch { /* ignore */ }
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.action === 'replace' && parsed.exerciseName) {
      return { action: 'replace', exerciseName: parsed.exerciseName, reason: parsed.reason ?? '' };
    }
    if (parsed.action === 'adjust_sets') {
      return {
        action: 'adjust_sets',
        sets: parsed.sets,
        reps: parsed.reps,
        reason: parsed.reason ?? '',
      };
    }
  } catch { /* ignore parse errors */ }

  return null;
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
 * Returns both the human-readable text and a parsed adjustment action (if any).
 */
export async function requestExerciseAdjustment(
  currentExerciseName: string,
  availableExerciseNames: string[],
  userRequest: string,
): Promise<ExerciseAdjustmentResponse> {
  const response = await sendAIMessage(userRequest, {
    systemPrompt: buildExerciseAdjustmentSystemPrompt(
      currentExerciseName,
      availableExerciseNames,
    ),
    context: 'workout',
  });

  const adjustment = parseAdjustmentFromResponse(response.content);
  const content = stripJsonBlock(response.content);

  return {
    content,
    adjustment,
    model: response.model,
    isDemo: response.isDemo,
  };
}
