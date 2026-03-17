// ── AI Client ────────────────────────────────────────────────────────
// High-level function to send messages to the AI coach.
// Automatically selects provider, builds system prompt, handles errors.

import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { getDemoResponse, getDemoContextualResponse } from './ai-demo-responses';
import { buildSystemPrompt, buildWorkoutSystemPrompt, buildNutritionSystemPrompt } from './coach-system-prompt';

export interface SendMessageOptions {
  /** Conversation history (user and assistant messages). */
  history?: AIMessage[];
  /** Override system prompt (for contextual coaches). */
  systemPrompt?: string;
  /** Context type for demo mode matching. */
  context?: 'general' | 'workout' | 'nutrition';
}

export interface AIClientResponse {
  content: string;
  model: string;
  isDemo: boolean;
}

/**
 * Send a message to the AI coach. Automatically selects the configured provider,
 * builds the system prompt, and falls back to demo mode on error.
 */
export async function sendAIMessage(
  userMessage: string,
  options: SendMessageOptions = {},
): Promise<AIClientResponse> {
  const config = await getAIConfig();

  // Demo mode — return pre-written responses
  if (config.provider === 'demo') {
    const response = options.context && options.context !== 'general'
      ? getDemoContextualResponse(userMessage, options.context)
      : getDemoResponse(userMessage);
    return { content: response, model: 'Demo Mode', isDemo: true };
  }

  // Build messages array with system prompt
  const systemPrompt = options.systemPrompt ?? buildSystemPrompt();

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  if (options.history && options.history.length > 0) {
    // Keep last 20 messages to stay within token limits
    const recentHistory = options.history.slice(-20);
    messages.push(...recentHistory);
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await callAI(messages, config);
    return {
      content: response.content,
      model: response.model,
      isDemo: false,
    };
  } catch (error) {
    // On error, fall back to demo mode with a helpful prefix
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('AI provider error, falling back to demo mode:', errorMsg);

    const demoResponse = options.context && options.context !== 'general'
      ? getDemoContextualResponse(userMessage, options.context)
      : getDemoResponse(userMessage);

    const friendlyError = getFriendlyError(errorMsg);

    return {
      content: `*${friendlyError}*\n\n---\n\n${demoResponse}`,
      model: 'Demo Mode (fallback)',
      isDemo: true,
    };
  }
}

/**
 * Quick contextual message for in-workout coach.
 */
export async function sendWorkoutCoachMessage(
  userMessage: string,
  exerciseName?: string,
): Promise<AIClientResponse> {
  return sendAIMessage(userMessage, {
    systemPrompt: buildWorkoutSystemPrompt(exerciseName),
    context: 'workout',
  });
}

/**
 * Quick contextual message for in-nutrition coach.
 */
export async function sendNutritionCoachMessage(
  userMessage: string,
): Promise<AIClientResponse> {
  return sendAIMessage(userMessage, {
    systemPrompt: buildNutritionSystemPrompt(),
    context: 'nutrition',
  });
}

function getFriendlyError(errorMsg: string): string {
  if (errorMsg.includes('Invalid API key')) {
    return 'Your API key appears to be invalid. Please check Settings → AI Settings. Here\'s a demo response instead:';
  }
  if (errorMsg.includes('Rate limit')) {
    return 'Rate limit reached. Please wait a moment. Here\'s a demo response in the meantime:';
  }
  if (errorMsg.includes('not found')) {
    return 'The configured AI model was not found. Please check Settings → AI Settings. Here\'s a demo response:';
  }
  if (errorMsg.includes('NetworkError') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
    return 'Could not connect to AI provider. Check your internet connection. Here\'s a demo response:';
  }
  return 'AI provider is temporarily unavailable. Here\'s a demo response instead:';
}
