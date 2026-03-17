// ── Coach API Layer ─────────────────────────────────────────────────
// Functions for AI coach features. Uses client-side AI providers instead
// of Supabase Edge Functions.

import { sendAIMessage, sendWorkoutCoachMessage, sendNutritionCoachMessage, type AIClientResponse } from './ai-client';
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
