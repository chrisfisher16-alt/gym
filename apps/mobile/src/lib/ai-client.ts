// ── AI Client ────────────────────────────────────────────────────────
// High-level function to send messages to the AI coach.
// Automatically selects provider, builds system prompt, handles errors.

import { getAIConfig, callAI, getTextContent, type AIMessage, type AIConfig, type AIContentBlock, type CacheableSystemBlock } from './ai-provider';
import { maybeSummarizeConversation, saveSummary } from './conversation-summarizer';
import { getDemoResponse, getDemoContextualResponse } from './ai-demo-responses';
import { buildSystemPrompt, buildWorkoutSystemPrompt, buildNutritionSystemPrompt, buildStaticLayer, buildUserLayer, buildDynamicLayer, gatherUserContext } from './coach-system-prompt';
import { detectIntent } from './intent-detector';
import { verifyCacheEligibility } from './prompt-cache';
import { logClientAIUsage } from './ai-telemetry';
import { getCachedResponse, cacheResponse } from './response-cache';

// ── Token-Budget Conversation Windowing ─────────────────────────────

const MAX_HISTORY_TOKENS = 4000;
const MIN_MESSAGES = 4;

function estimateTokens(content: string | unknown): number {
  if (typeof content === 'string') {
    return Math.ceil(content.length / 4);
  }
  // Handle array of content blocks (multipart messages with images)
  if (Array.isArray(content)) {
    let tokens = 0;
    for (const block of content) {
      if (block && typeof block === 'object' && 'type' in block) {
        if (block.type === 'image') {
          tokens += 1000; // Approximate token cost for an image block
        } else if (block.type === 'text' && 'text' in block) {
          tokens += Math.ceil((block.text as string).length / 4);
        }
      }
    }
    return tokens;
  }
  return 0;
}

/**
 * Trim conversation history to fit within a token budget.
 * Always keeps at least the last MIN_MESSAGES, then fills
 * remaining budget with older messages from most-recent to oldest.
 */
function windowConversationByTokens(
  history: AIMessage[],
  maxTokens: number = MAX_HISTORY_TOKENS,
): AIMessage[] {
  if (history.length === 0) return [];

  // Always include the last MIN_MESSAGES (or fewer if history is short)
  const mustInclude = history.slice(-MIN_MESSAGES);
  const remaining = history.length > MIN_MESSAGES
    ? history.slice(0, -MIN_MESSAGES)
    : [];

  let tokenBudget = maxTokens;
  for (const msg of mustInclude) {
    tokenBudget -= estimateTokens(getTextContent(msg.content));
  }

  // Add older messages from most recent to oldest until budget is exhausted
  const included: AIMessage[] = [];
  for (let i = remaining.length - 1; i >= 0 && tokenBudget > 0; i--) {
    const msgTokens = estimateTokens(getTextContent(remaining[i].content));
    if (tokenBudget - msgTokens < 0 && included.length > 0) break;
    included.unshift(remaining[i]);
    tokenBudget -= msgTokens;
  }

  return [...included, ...mustInclude];
}

export interface SendMessageOptions {
  /** Conversation history (user and assistant messages). */
  history?: AIMessage[];
  /** Override system prompt (for contextual coaches). */
  systemPrompt?: string;
  /** Context type for demo mode matching. */
  context?: 'general' | 'workout' | 'nutrition';
  /** Conversation ID for triggering summarization of long chats. */
  conversationId?: string;
  /** Pre-loaded conversation summaries to inject into system prompt. */
  conversationSummaries?: string[];
  /** AbortSignal for cancellation/timeout support. */
  signal?: AbortSignal;
  /** Streaming callback — receives incremental text tokens as they arrive. */
  onToken?: (token: string) => void;
}

export interface AIClientResponse {
  content: string;
  model: string;
  isDemo: boolean;
  /** True when the response was generated due to an error/fallback */
  isError?: boolean;
}

/**
 * Send a message to the AI coach. Automatically selects the configured provider,
 * builds the system prompt, and falls back to demo mode on error.
 */
export async function sendAIMessage(
  userMessage: string | AIContentBlock[],
  options: SendMessageOptions = {},
): Promise<AIClientResponse> {
  const startTime = Date.now();
  const config = await getAIConfig();

  // Extract text for demo mode / intent detection / caching
  const userText = getTextContent(userMessage);

  // Demo mode — return pre-written responses
  if (config.provider === 'demo') {
    const response = options.context && options.context !== 'general'
      ? getDemoContextualResponse(userText, options.context)
      : getDemoResponse(userText);
    options.onToken?.(response);
    return { content: response, model: 'Demo Mode', isDemo: true };
  }

  // Check response cache before making an API call
  const intent = detectIntent(userText);
  const cached = getCachedResponse(userText, intent);
  if (cached) {
    logClientAIUsage({
      model: cached.model,
      status: 'success',
      latencyMs: 0,
      intent: intent,
      context: options.context ?? 'general',
      cacheHit: true,
    });
    options.onToken?.(cached.content);
    return {
      content: cached.content,
      model: cached.model,
      isDemo: false,
    };
  }

  // Build messages array — with cache layers when using default prompt,
  // or a plain system message when an override is provided.
  const useLayeredPrompt = !options.systemPrompt;

  let cacheableSystem: CacheableSystemBlock[] | undefined;
  const messages: AIMessage[] = [];

  if (useLayeredPrompt) {
    // Intent-aware layered prompt with cache hints
    const ctx = gatherUserContext(intent);
    if (options.conversationSummaries && options.conversationSummaries.length > 0) {
      ctx.conversationSummaries = options.conversationSummaries;
    }

    const staticLayer = buildStaticLayer(ctx.coachTone);
    const userLayer = buildUserLayer(ctx);
    const dynamicLayer = buildDynamicLayer(ctx, intent);

    // Verify cache eligibility (diagnostic only)
    const cacheCheck = verifyCacheEligibility(staticLayer, userLayer);
    if (cacheCheck.staticLayerChanged) {
      console.warn('[AI Cache] Static layer changed — cache will miss');
    }
    if (cacheCheck.userLayerChanged) {
      console.debug('[AI Cache] User layer changed — partial cache miss');
    }

    cacheableSystem = [
      { text: staticLayer, cacheControl: true },
      { text: userLayer, cacheControl: true },
    ];
    if (dynamicLayer.trim()) {
      cacheableSystem.push({ text: dynamicLayer, cacheControl: false });
    }
    // No system message in the messages array — it's in cacheableSystem
  } else {
    // Override prompt — pass as regular system message, no caching
    messages.push({ role: 'system', content: options.systemPrompt! });
  }

  // Add conversation history (token-budget windowed)
  if (options.history && options.history.length > 0) {
    const recentHistory = windowConversationByTokens(options.history);
    messages.push(...recentHistory);
  }

  // Add current user message (may be string or multipart content blocks)
  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await callAI(
      messages,
      config,
      {
        ...(useLayeredPrompt ? { cacheableSystem } : {}),
        signal: options.signal,
        onToken: options.onToken,
      },
    );

    const endTime = Date.now();
    logClientAIUsage({
      model: response.model,
      totalTokens: response.tokensUsed,
      intent: useLayeredPrompt ? intent : undefined,
      cacheHit: (response.cacheMetrics?.cacheReadInputTokens ?? 0) > 0,
      latencyMs: endTime - startTime,
      status: 'success',
      context: options.context ?? 'general',
    });

    // Cache the successful response for future identical questions
    if (useLayeredPrompt) {
      cacheResponse(userText, intent, response.content, response.model);
    }

    // Fire-and-forget: trigger summarization check for long conversations
    if (options.history && options.conversationId) {
      maybeSummarizeConversation(
        [...options.history, { role: 'user', content: userText }, { role: 'assistant', content: response.content }],
        (summary) => saveSummary(options.conversationId!, summary),
      );
    }

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
      ? getDemoContextualResponse(userText, options.context)
      : getDemoResponse(userText);

    const friendlyError = getFriendlyError(errorMsg, config);

    const endTime = Date.now();
    logClientAIUsage({
      model: 'demo_fallback',
      status: 'fallback',
      latencyMs: endTime - startTime,
      context: options.context ?? 'general',
    });

    return {
      content: `*${friendlyError}*\n\n---\n\n${demoResponse}`,
      model: 'Demo Mode (fallback)',
      isDemo: true,
      isError: true,
    };
  }
}

// Note: isError flag is set in the main catch block above.
// The sendWorkoutCoachMessage and sendNutritionCoachMessage functions
// delegate to sendAIMessage which already handles error fallbacks.

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

const PROVIDER_NAMES: Record<string, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  claude: 'Claude',
  ollama: 'Ollama',
};

function getFriendlyError(errorMsg: string, config?: AIConfig): string {
  if (errorMsg.includes('Invalid API key')) {
    return 'Your API key appears to be invalid. Please check Settings → AI Settings. Here\'s a demo response instead:';
  }
  if (errorMsg.includes('Rate limit')) {
    const providerName = config ? PROVIDER_NAMES[config.provider] ?? config.provider : 'your AI provider';
    return `Your ${providerName} API rate limit was reached — this is a limit from ${providerName}'s free tier, not your app subscription. Wait a moment and try again. Here\'s a demo response in the meantime:`;
  }
  if (errorMsg.includes('not found')) {
    return 'The configured AI model was not found. Please check Settings → AI Settings. Here\'s a demo response:';
  }
  if (errorMsg.includes('timed out')) {
    return 'The request timed out. The AI provider may be slow right now. Here\'s a demo response:';
  }
  if (errorMsg.includes('NetworkError') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
    return 'Could not connect to AI provider. Check your internet connection. Here\'s a demo response:';
  }
  return 'AI provider is temporarily unavailable. Here\'s a demo response instead:';
}
