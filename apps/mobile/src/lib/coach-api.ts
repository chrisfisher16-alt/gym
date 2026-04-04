// ── Coach API Layer ─────────────────────────────────────────────────
// Functions for AI coach features. Uses client-side AI providers instead
// of Supabase Edge Functions.

import { sendAIMessage, sendWorkoutCoachMessage, sendNutritionCoachMessage, type AIClientResponse } from './ai-client';
import { loadSummaries } from './conversation-summarizer';
import { buildExerciseAdjustmentSystemPrompt } from './coach-system-prompt';
import type { AIMessage, AIContentBlock } from './ai-provider';

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
  message: string | AIContentBlock[],
  context: string = 'general',
  history: AIMessage[] = [],
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  // Load any existing conversation summaries for context continuity
  const summaries = conversationId ? await loadSummaries(conversationId) : [];

  const response = await sendAIMessage(message, {
    history,
    context: context as 'general' | 'workout' | 'nutrition',
    conversationId,
    conversationSummaries: summaries.length > 0 ? summaries : undefined,
    onToken,
    signal,
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

// ── SSE Edge Function Path ──────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Send a chat message via the Edge Function with SSE streaming.
 * Falls back to the full response if streaming is not available.
 */
export async function sendChatMessageSSE(
  conversationId: string | undefined,
  message: string,
  context: string = 'general',
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  // Import supabase client to get the current session token
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  const response = await fetch(`${SUPABASE_URL}/functions/v1/coach-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      context,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Coach API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  // If response body is null (React Native limitation), fall back to
  // parsing the response as JSON (non-streaming edge function response).
  if (!response.body) {
    const data = await response.json();
    if (data.content && onToken) {
      onToken(data.content);
    }
    return {
      conversation_id: data.conversation_id ?? conversationId ?? '',
      message_id: data.message_id ?? '',
      content: data.content ?? '',
      model: data.model ?? '',
      isDemo: false,
    };
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: {
    conversation_id?: string;
    message_id?: string;
    content?: string;
    model?: string;
    tokens?: { input: number; output: number; total: number };
  } = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        try {
          const data = JSON.parse(dataStr);

          switch (currentEvent) {
            case 'stream_start':
              if (data.conversation_id) finalData.conversation_id = data.conversation_id;
              if (data.message_id) finalData.message_id = data.message_id;
              break;
            case 'token':
              if (data.text && onToken) {
                onToken(data.text);
              }
              break;
            case 'content_final':
              finalData.content = data.content;
              finalData.model = data.model;
              finalData.tokens = data.tokens;
              break;
            case 'done':
              break;
          }
        } catch { /* skip malformed SSE data */ }
        currentEvent = '';
      }
    }
  }

  return {
    conversation_id: finalData.conversation_id ?? conversationId ?? '',
    message_id: finalData.message_id ?? '',
    content: finalData.content ?? '',
    model: finalData.model ?? '',
    isDemo: false,
  };
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

export interface ExerciseAdjustmentAdd {
  action: 'add_exercise';
  exerciseName: string;
  sets: number;
  reps: string;
  reason: string;
}

export interface ExerciseAdjustmentRemove {
  action: 'remove_exercise';
  currentExercise: string;
  reason: string;
}

export interface ExerciseAdjustmentSuperset {
  action: 'create_superset';
  exercises: string[];
  reason: string;
}

export type ExerciseAdjustment =
  | ExerciseAdjustmentReplace
  | ExerciseAdjustmentSets
  | ExerciseAdjustmentAdd
  | ExerciseAdjustmentRemove
  | ExerciseAdjustmentSuperset;

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
  if (obj.action === 'add_exercise' && obj.exerciseName) {
    return {
      action: 'add_exercise',
      exerciseName: obj.exerciseName as string,
      sets: (obj.sets as number) ?? 3,
      reps: (obj.reps as string) ?? '8-12',
      reason: (obj.reason as string) ?? '',
    };
  }
  if (obj.action === 'remove_exercise') {
    return {
      action: 'remove_exercise',
      currentExercise,
      reason: (obj.reason as string) ?? '',
    };
  }
  if (obj.action === 'create_superset' && Array.isArray(obj.exercises)) {
    return {
      action: 'create_superset',
      exercises: obj.exercises as string[],
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
