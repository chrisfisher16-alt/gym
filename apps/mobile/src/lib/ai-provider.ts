// ── Client-Side AI Provider Abstraction ─────────────────────────────
// Supports multiple LLM providers from the mobile app directly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Types ───────────────────────────────────────────────────────────

export interface AIConfig {
  provider: 'groq' | 'openai' | 'ollama' | 'demo' | 'claude';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderResponse {
  content: string;
  model: string;
  tokensUsed?: number;
}

// ── Storage ─────────────────────────────────────────────────────────

const AI_CONFIG_KEY = '@ai/config';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'claude',
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
};

let cachedConfig: AIConfig | null = null;

export async function getAIConfig(): Promise<AIConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const stored = await AsyncStorage.getItem(AI_CONFIG_KEY);
    if (stored) {
      cachedConfig = JSON.parse(stored);
      return cachedConfig!;
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_CONFIG;
}

export async function setAIConfig(config: AIConfig): Promise<void> {
  cachedConfig = config;
  await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * One-time migration: if the stored config still has the old API key,
 * clear it so the updated DEFAULT_CONFIG takes effect.
 */
export async function migrateAIConfig(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(AI_CONFIG_KEY);
    if (stored) {
      const parsed: AIConfig = JSON.parse(stored);
      if (parsed.apiKey?.startsWith('')) {
        await AsyncStorage.removeItem(AI_CONFIG_KEY);
        cachedConfig = null;
      }
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

// ── Web CORS Proxy ──────────────────────────────────────────────────

const CLAUDE_WEB_PROXY_URL = 'http://localhost:3001/api/anthropic';

function getClaudeBaseUrl(configBaseUrl?: string): string {
  if (Platform.OS === 'web') {
    return CLAUDE_WEB_PROXY_URL;
  }
  return configBaseUrl || PROVIDER_DEFAULTS.claude.baseUrl;
}

// ── OpenAI-Compatible API Call ───────────────────────────────────────

export async function callOpenAICompatible(
  messages: AIMessage[],
  config: AIConfig,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults(config.provider);
  const baseUrl = config.baseUrl || defaults.baseUrl;
  const model = config.model || defaults.model;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Ollama doesn't need auth, others do
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
    max_tokens: 2048,
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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
}

// ── Claude (Anthropic) API Call ──────────────────────────────────────

export async function callClaudeAPI(
  messages: AIMessage[],
  config: AIConfig,
): Promise<AIProviderResponse> {
  const defaults = getProviderDefaults('claude');
  const baseUrl = getClaudeBaseUrl(config.baseUrl);
  const model = config.model || defaults.model;

  // Extract system message (Anthropic API uses a top-level `system` field)
  let systemPrompt: string | undefined;
  const nonSystemMessages: { role: string; content: string }[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemPrompt = m.content;
    } else {
      nonSystemMessages.push({ role: m.role, content: m.content });
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': config.apiKey ?? '',
    'anthropic-version': '2023-06-01',
  };

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMessages,
    max_tokens: 2048,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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
    throw new Error(`AI provider error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');

  if (!textBlock?.text) {
    throw new Error('No response from AI provider. Please try again.');
  }

  return {
    content: textBlock.text,
    model: data.model ?? model,
    tokensUsed: data.usage ? data.usage.input_tokens + data.usage.output_tokens : undefined,
  };
}

// ── Unified AI Call ─────────────────────────────────────────────────

export async function callAI(
  messages: AIMessage[],
  config: AIConfig,
): Promise<AIProviderResponse> {
  if (config.provider === 'claude') {
    return callClaudeAPI(messages, config);
  }
  return callOpenAICompatible(messages, config);
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
