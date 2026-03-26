// ── Client-Side AI Provider Abstraction ─────────────────────────────
// Supports multiple LLM providers from the mobile app directly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ── Types ───────────────────────────────────────────────────────────

export interface AIConfig {
  provider: 'groq' | 'openai' | 'ollama' | 'demo' | 'claude';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Per-provider API key storage — keys are saved independently so switching providers doesn't lose them. */
  providerKeys?: Record<string, string>;
}

export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIContentBlock[];
}

/**
 * Safely extract text from an AIMessage content field.
 * If content is a string, returns it directly.
 * If content is an array of blocks, joins all text blocks.
 */
export function getTextContent(content: string | AIContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export interface AIProviderResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  cacheMetrics?: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
}

export interface CacheableSystemBlock {
  text: string;
  cacheControl?: boolean;
}

export interface AICallOptions {
  cacheableSystem?: CacheableSystemBlock[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;  // For cancellation/timeout
  max_tokens?: number;   // Override the default max_tokens per call
}

// ── Timeout / Abort Support ─────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const STREAMING_TIMEOUT_MS = 60_000; // 60 seconds — generous for first byte & between chunks

function createTimeoutSignal(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  existingSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Request timed out. Please try again.'));
  }, timeoutMs);

  // If an external signal is provided, link them
  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort(existingSignal.reason);
    } else {
      existingSignal.addEventListener(
        'abort',
        () => {
          controller.abort(existingSignal.reason);
        },
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * A timeout that resets every time `resetTimeout()` is called.
 * Used for streaming responses so the timer measures time since the
 * *last* chunk, not since the request started.
 */
function createResettableTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; resetTimeout: () => void; cleanup: () => void } {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(
      () => controller.abort(new Error('Request timed out. Please try again.')),
      timeoutMs,
    );
  };

  resetTimeout(); // Start initial timeout

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId);
          controller.abort(externalSignal.reason);
        },
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,
    resetTimeout,
    cleanup: () => clearTimeout(timeoutId),
  };
}

// ── Storage ─────────────────────────────────────────────────────────

const SECURE_AI_CONFIG_KEY = 'ai_config';
/** @deprecated Used only for migration from AsyncStorage to SecureStore. */
const LEGACY_AI_CONFIG_KEY = '@ai/config';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'claude',
  model: 'claude-sonnet-4-20250514',
};

let cachedConfig: AIConfig | null = null;

export async function getAIConfig(): Promise<AIConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    // Try SecureStore first
    const stored = await SecureStore.getItemAsync(SECURE_AI_CONFIG_KEY);
    if (stored) {
      cachedConfig = JSON.parse(stored);
      return cachedConfig!;
    }
    // Migrate from AsyncStorage if present (one-time)
    const legacy = await AsyncStorage.getItem(LEGACY_AI_CONFIG_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(SECURE_AI_CONFIG_KEY, legacy);
      await AsyncStorage.removeItem(LEGACY_AI_CONFIG_KEY);
      cachedConfig = JSON.parse(legacy);
      return cachedConfig!;
    }
  } catch {
    // Ignore storage errors
  }
  // First launch — persist the default so chat can read it immediately
  cachedConfig = DEFAULT_CONFIG;
  SecureStore.setItemAsync(SECURE_AI_CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG)).catch(() => {});
  return DEFAULT_CONFIG;
}

export async function setAIConfig(config: AIConfig): Promise<void> {
  cachedConfig = config;
  await SecureStore.setItemAsync(SECURE_AI_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Invalidate the in-memory cache only — forces the next getAIConfig() call
 * to re-read from SecureStore. Safe to call on every tab mount.
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
}

/**
 * Fully clear both the in-memory cache AND the persisted SecureStore entry.
 * Use only for explicit user-initiated resets (e.g. "Reset AI Settings").
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  SecureStore.deleteItemAsync(SECURE_AI_CONFIG_KEY).catch(() => {});
}

/**
 * One-time migration: upgrade stored config to new format if needed.
 * Preserves all existing settings.
 */
export async function migrateAIConfig(): Promise<void> {
  try {
    const config = await getAIConfig();
    // Migrate: ensure providerKeys exist for backward compatibility
    if (config.apiKey && !config.providerKeys) {
      config.providerKeys = { [config.provider]: config.apiKey };
      await setAIConfig(config);
    }
  } catch {
    // Ignore storage errors
  }
}

// ── Provider Defaults ───────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3',
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
};

export function getProviderDefaults(provider: string): { baseUrl: string; model: string } {
  return PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai;
}

// ── Server Proxy URLs ────────────────────────────────────────────────
// When users don't have their own API key, route through the Vercel proxy
// which injects a server-side key. On web, also used for CORS.

const PROXY_BASE = process.env.EXPO_PUBLIC_PROXY_BASE_URL || '';
const CLAUDE_PROXY_URL = `${PROXY_BASE}/api/anthropic`;
const GROQ_PROXY_URL = `${PROXY_BASE}/api/groq`;
const OPENAI_PROXY_URL = `${PROXY_BASE}/api/openai`;

function assertProxyConfigured(): void {
  if (!PROXY_BASE) {
    throw new Error(
      'AI proxy not configured. Set EXPO_PUBLIC_PROXY_BASE_URL in your .env file, or add your own API key in AI Settings.',
    );
  }
}

/** Whether a config has a user-provided API key. */
function hasUserKey(config: AIConfig): boolean {
  return !!config.apiKey && config.apiKey.length > 5;
}

function getClaudeBaseUrl(config: AIConfig): string {
  // Always use proxy on web (CORS), or on native when no user key
  if (Platform.OS === 'web' || !hasUserKey(config)) {
    assertProxyConfigured();
    return CLAUDE_PROXY_URL;
  }
  return config.baseUrl || PROVIDER_DEFAULTS.claude.baseUrl;
}

function getOpenAICompatibleUrl(config: AIConfig): string {
  const defaults = getProviderDefaults(config.provider);
  // Ollama always uses local URL
  if (config.provider === 'ollama') {
    return config.baseUrl || defaults.baseUrl;
  }
  // On web or when no user key, route through proxy
  if (Platform.OS === 'web' || !hasUserKey(config)) {
    assertProxyConfigured();
    if (config.provider === 'groq') return GROQ_PROXY_URL;
    if (config.provider === 'openai') return OPENAI_PROXY_URL;
  }
  return config.baseUrl || defaults.baseUrl;
}

// ── OpenAI-Compatible API Call ───────────────────────────────────────

export async function callOpenAICompatible(
  messages: AIMessage[],
  config: AIConfig,
  options?: AICallOptions,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults(config.provider);
  const baseUrl = getOpenAICompatibleUrl(config);
  const model = config.model || defaults.model;

  const { signal, cleanup } = createTimeoutSignal(DEFAULT_TIMEOUT_MS, options?.signal);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth header if user has their own key (proxy handles server key)
    if (hasUserKey(config)) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const body = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : m.content.map((block) =>
              block.type === 'text'
                ? { type: 'text' as const, text: block.text }
                : { type: 'image_url' as const, image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } },
            ),
      })),
      temperature: 0.7,
      max_tokens: options?.max_tokens ?? 2048,
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in AI Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 404) {
        throw new Error(`Model "${model}" not found. Please check your model name in AI Settings.`);
      }
      if (response.status === 529 || response.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      }
      throw new Error(`AI provider error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw new Error('No response from AI provider. Please try again.');
    }

    return {
      content: choice.message.content,
      model: data.model ?? model,
      tokensUsed: data.usage?.total_tokens,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    cleanup();
  }
}

// ── Claude (Anthropic) API Call ──────────────────────────────────────

export async function callClaudeAPI(
  messages: AIMessage[],
  config: AIConfig,
  options?: AICallOptions,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults('claude');
  const baseUrl = getClaudeBaseUrl(config);
  const model = config.model || defaults.model;

  const useCaching = options?.cacheableSystem && options.cacheableSystem.length > 0;

  // Extract system message (Anthropic API uses a top-level `system` field)
  let systemPrompt: string | undefined;
  const nonSystemMessages: { role: string; content: string | AIContentBlock[] }[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      if (!useCaching) {
        systemPrompt = getTextContent(m.content);
      }
      // When caching is active, skip system messages from the array
    } else {
      nonSystemMessages.push({ role: m.role, content: m.content });
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  // Only send x-api-key when user has their own key (proxy injects server key)
  if (hasUserKey(config)) {
    headers['x-api-key'] = config.apiKey!;
  }

  if (useCaching) {
    headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
  }

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMessages,
    max_tokens: options?.max_tokens ?? 2048,
  };

  if (useCaching) {
    body.system = options!.cacheableSystem!.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
    }));
  } else if (systemPrompt) {
    body.system = systemPrompt;
  }

  const { signal, cleanup } = createTimeoutSignal(DEFAULT_TIMEOUT_MS, options?.signal);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in AI Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 404) {
        throw new Error(`Model "${model}" not found. Please check your model name in AI Settings.`);
      }
      if (response.status === 529 || response.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      }
      throw new Error(`AI provider error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');

    if (!textBlock?.text) {
      throw new Error('No response from AI provider. Please try again.');
    }

    const response_obj: AIProviderResponse = {
      content: textBlock.text,
      model: data.model ?? model,
      tokensUsed: data.usage ? data.usage.input_tokens + data.usage.output_tokens : undefined,
    };

    if (data.usage?.cache_creation_input_tokens !== undefined || data.usage?.cache_read_input_tokens !== undefined) {
      response_obj.cacheMetrics = {
        cacheCreationInputTokens: data.usage.cache_creation_input_tokens,
        cacheReadInputTokens: data.usage.cache_read_input_tokens,
      };
    }

    return response_obj;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    cleanup();
  }
}

// ── Streaming Claude (Anthropic) API Call ───────────────────────────

async function callClaudeAPIStreaming(
  messages: AIMessage[],
  config: AIConfig,
  options: AICallOptions,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults('claude');
  const baseUrl = getClaudeBaseUrl(config);
  const model = config.model || defaults.model;
  const onToken = options.onToken!;

  const useCaching = options.cacheableSystem && options.cacheableSystem.length > 0;

  let systemField: unknown;
  const nonSystemMessages: { role: string; content: string | AIContentBlock[] }[] = [];

  if (useCaching) {
    systemField = options.cacheableSystem!.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
    }));
    for (const m of messages) {
      if (m.role !== 'system') {
        nonSystemMessages.push({ role: m.role, content: m.content });
      }
    }
  } else {
    for (const m of messages) {
      if (m.role === 'system') {
        systemField = getTextContent(m.content);
      } else {
        nonSystemMessages.push({ role: m.role, content: m.content });
      }
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  // Only send x-api-key when user has their own key (proxy injects server key)
  if (hasUserKey(config)) {
    headers['x-api-key'] = config.apiKey!;
  }
  if (useCaching) {
    headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
  }

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMessages,
    max_tokens: options.max_tokens ?? 2048,
    stream: true,
  };
  if (systemField) body.system = systemField;

  const { signal, resetTimeout, cleanup } = createResettableTimeoutSignal(STREAMING_TIMEOUT_MS, options.signal);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in AI Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 404) {
        throw new Error(`Model "${model}" not found. Please check your model name in AI Settings.`);
      }
      if (response.status === 529 || response.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      }
      throw new Error(`AI provider error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error('Streaming not supported — response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let modelName = model;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetTimeout(); // Got data — reset the idle timeout

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'message_start') {
              modelName = parsed.message?.model ?? model;
              const usage = parsed.message?.usage;
              if (usage) {
                inputTokens = usage.input_tokens ?? 0;
                cacheReadTokens = usage.cache_read_input_tokens ?? 0;
                cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
              }
            } else if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text ?? '';
              if (text) {
                fullContent += text;
                onToken(text);
              }
            } else if (parsed.type === 'message_delta') {
              const usage = parsed.usage;
              if (usage) {
                outputTokens = usage.output_tokens ?? 0;
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    const result: AIProviderResponse = {
      content: fullContent,
      model: modelName,
      tokensUsed: inputTokens + outputTokens,
    };

    if (cacheCreationTokens || cacheReadTokens) {
      result.cacheMetrics = {
        cacheCreationInputTokens: cacheCreationTokens,
        cacheReadInputTokens: cacheReadTokens,
      };
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    cleanup();
  }
}

// ── Streaming OpenAI-Compatible API Call ────────────────────────────

async function callOpenAICompatibleStreaming(
  messages: AIMessage[],
  config: AIConfig,
  options: AICallOptions,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults(config.provider);
  const baseUrl = getOpenAICompatibleUrl(config);
  const model = config.model || defaults.model;
  const onToken = options.onToken!;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Only send auth header when user has their own key (proxy injects server key)
  if (hasUserKey(config)) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const allMessages = [...messages.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content
      : m.content.map((block) =>
          block.type === 'text'
            ? { type: 'text' as const, text: block.text }
            : { type: 'image_url' as const, image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } },
        ),
  }))];
  if (options.cacheableSystem?.length) {
    const systemText = options.cacheableSystem.map((b) => b.text).join('\n\n');
    allMessages.unshift({ role: 'system', content: systemText });
  }

  const body = {
    model,
    messages: allMessages,
    temperature: 0.7,
    max_tokens: options.max_tokens ?? 2048,
    stream: true,
  };

  const { signal, resetTimeout, cleanup } = createResettableTimeoutSignal(STREAMING_TIMEOUT_MS, options.signal);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your API key in AI Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 404) {
        throw new Error(`Model "${model}" not found. Please check your model name in AI Settings.`);
      }
      if (response.status === 529 || response.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      }
      throw new Error(`AI provider error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    if (!response.body) {
      throw new Error('Streaming not supported — response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let modelName = model;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetTimeout(); // Got data — reset the idle timeout

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onToken(delta.content);
            }
            if (parsed.model) modelName = parsed.model;
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    return {
      content: fullContent,
      model: modelName,
      tokensUsed: undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    cleanup();
  }
}

// ── Retry with Backoff for 429s ──────────────────────────────────────

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1500;

async function callWithRetry(
  fn: () => Promise<AIProviderResponse>,
): Promise<AIProviderResponse> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Retry on rate limit and overload errors
      const isRetryable = lastError.message.includes('Rate limit') || lastError.message.includes('temporarily overloaded');
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw lastError;
      }
      // Exponential backoff: 1.5s, 3s
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

// ── Unified AI Call ─────────────────────────────────────────────────

export async function callAI(
  messages: AIMessage[],
  config: AIConfig,
  options?: AICallOptions,
): Promise<AIProviderResponse> {
  // Streaming calls are NOT retried — a retry after partial token delivery
  // would send duplicate tokens to the UI.
  if (options?.onToken) {
    try {
      if (config.provider === 'claude') {
        return await callClaudeAPIStreaming(messages, config, options);
      }
      return await callOpenAICompatibleStreaming(messages, config, options);
    } catch (streamErr: unknown) {
      // If streaming failed because response.body is null (common in React
      // Native), fall back to a non-streaming call and deliver the full
      // response as a single token so the caller still gets content.
      const msg = streamErr instanceof Error ? streamErr.message : '';
      if (msg.includes('Streaming not supported') || msg.includes('response body is null')) {
        console.warn('[AI] Streaming unavailable, falling back to non-streaming call');
        const result = config.provider === 'claude'
          ? await callClaudeAPI(messages, config, options)
          : await callOpenAICompatible(messages, config, options);
        // Deliver the full response as a single token
        if (result.content && options.onToken) {
          options.onToken(result.content);
        }
        return result;
      }
      throw streamErr;
    }
  }

  // Non-streaming calls can safely retry on transient errors.
  return callWithRetry(() => {
    if (config.provider === 'claude') {
      return callClaudeAPI(messages, config, options);
    }
    return callOpenAICompatible(messages, config, options);
  });
}

// ── Model Fetching ──────────────────────────────────────────────────

export interface AIModelInfo {
  id: string;
  name: string;
  description: string;
}

/** Curated descriptions for popular models */
const MODEL_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  // Groq models
  'llama-3.3-70b-versatile': { name: 'Llama 3.3 70B', description: 'Best balance of speed & quality. Recommended.' },
  'llama-3.1-8b-instant': { name: 'Llama 3.1 8B', description: 'Ultra-fast, good for simple tasks.' },
  'llama-3.1-70b-versatile': { name: 'Llama 3.1 70B', description: 'High quality, slightly older than 3.3.' },
  'llama3-70b-8192': { name: 'Llama 3 70B', description: 'Previous gen, still capable.' },
  'llama3-8b-8192': { name: 'Llama 3 8B', description: 'Fast, lightweight, basic tasks.' },
  'gemma2-9b-it': { name: 'Gemma 2 9B', description: 'Google\'s compact model, good quality.' },
  'mixtral-8x7b-32768': { name: 'Mixtral 8x7B', description: 'Large context window (32K tokens).' },
  // OpenAI models
  'gpt-4o': { name: 'GPT-4o', description: 'Most capable OpenAI model. Best quality.' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', description: 'Fast & affordable. Great for coaching.' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', description: 'Powerful with 128K context.' },
  'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', description: 'Cheapest, good for simple tasks.' },
  'o3-mini': { name: 'o3 Mini', description: 'Advanced reasoning model.' },
  // Claude models
  'claude-sonnet-4-20250514': { name: 'Claude Sonnet 4', description: 'Best balance of speed & intelligence. Recommended.' },
  'claude-opus-4-20250514': { name: 'Claude Opus 4', description: 'Most capable. Slower, higher cost.' },
  'claude-haiku-3-5-20241022': { name: 'Claude Haiku 3.5', description: 'Fastest Claude. Great for quick responses.' },
  // Ollama models
  'llama3': { name: 'Llama 3', description: 'Meta\'s latest open model. Best local option.' },
  'llama3.1': { name: 'Llama 3.1', description: 'Updated Llama with longer context.' },
  'mistral': { name: 'Mistral 7B', description: 'Fast, efficient European model.' },
  'gemma2': { name: 'Gemma 2', description: 'Google\'s compact open model.' },
  'phi3': { name: 'Phi-3', description: 'Microsoft\'s small but capable model.' },
  'qwen2': { name: 'Qwen 2', description: 'Alibaba\'s multilingual model.' },
};

function getModelInfo(modelId: string): AIModelInfo {
  const known = MODEL_DESCRIPTIONS[modelId];
  if (known) {
    return { id: modelId, name: known.name, description: known.description };
  }
  return { id: modelId, name: modelId, description: '' };
}

/** Static model lists for providers without a models API endpoint */
const STATIC_MODELS: Record<string, string[]> = {
  claude: [
    'claude-sonnet-4-20250514',
    'claude-haiku-3-5-20241022',
    'claude-opus-4-20250514',
  ],
  ollama: [
    'llama3',
    'llama3.1',
    'mistral',
    'gemma2',
    'phi3',
    'qwen2',
  ],
};

/**
 * Fetch available models from the AI provider.
 * For Groq/OpenAI, queries the /models API endpoint.
 * For Claude, returns a static curated list.
 * For Ollama, tries the local /api/tags endpoint with static fallback.
 */
export async function fetchAvailableModels(config: AIConfig): Promise<AIModelInfo[]> {
  if (config.provider === 'demo') return [];

  // Claude — static list (no public models endpoint)
  if (config.provider === 'claude') {
    return STATIC_MODELS.claude.map(getModelInfo);
  }

  // Ollama — try local API, fall back to static list
  if (config.provider === 'ollama') {
    try {
      const ollamaBase = (config.baseUrl || 'http://localhost:11434/v1/chat/completions')
        .replace(/\/v1\/chat\/completions$/, '');
      const response = await fetch(`${ollamaBase}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        const models = (data.models ?? []) as { name: string }[];
        if (models.length > 0) {
          return models.map((m) => getModelInfo(m.name.replace(/:latest$/, '')));
        }
      }
    } catch {
      // Fall through to static list
    }
    return STATIC_MODELS.ollama.map(getModelInfo);
  }

  // Groq / OpenAI — query /models endpoint if user has a key
  if (!hasUserKey(config)) {
    // Return curated list when using server-side proxy (no user key)
    const defaultModels: Record<string, string[]> = {
      groq: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'gemma2-9b-it',
        'mixtral-8x7b-32768',
      ],
      openai: [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-3.5-turbo',
      ],
    };
    return (defaultModels[config.provider] ?? []).map(getModelInfo);
  }

  try {
    const defaults = getProviderDefaults(config.provider);
    const baseUrl = (config.baseUrl || defaults.baseUrl).replace(/\/chat\/completions$/, '');
    const modelsUrl = `${baseUrl}/models`;

    const response = await fetch(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const models = (data.data ?? []) as { id: string; owned_by?: string }[];

    // Filter to chat models and sort by known models first
    return models
      .filter((m) => {
        // Skip embedding, whisper, tts, and other non-chat models
        const id = m.id.toLowerCase();
        return !id.includes('embed') && !id.includes('whisper') && 
               !id.includes('tts') && !id.includes('dall-e') &&
               !id.includes('moderation');
      })
      .map((m) => getModelInfo(m.id))
      .sort((a, b) => {
        // Known models first, then alphabetical
        const aKnown = MODEL_DESCRIPTIONS[a.id] ? 0 : 1;
        const bKnown = MODEL_DESCRIPTIONS[b.id] ? 0 : 1;
        if (aKnown !== bKnown) return aKnown - bKnown;
        return a.id.localeCompare(b.id);
      });
  } catch {
    return [];
  }
}

// ── Test Connection ─────────────────────────────────────────────────

export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; error?: string; model?: string }> {
  if (config.provider === 'demo') {
    return { success: true, model: 'Demo Mode' };
  }

  try {
    const testMessages: AIMessage[] = [
      { role: 'user', content: 'Say "Connection successful!" in 5 words or less.' },
    ];
    const result = await callAI(testMessages, config);
    return { success: true, model: result.model };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
