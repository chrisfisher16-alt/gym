// ── Provider-Agnostic AI Service Layer ──────────────────────────────

import type {
  AIMessage,
  AIResponse,
  AIProviderOptions,
  AIProvider,
  CacheableSystemBlock,
} from './types.ts';

// ── Token Cost Estimates (per 1M tokens) ─────────────────────────

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-35-20250415': { input: 0.8, output: 4 },
};

/**
 * Estimate cost in USD for a given model and token counts.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Find matching cost config (partial match for model variants)
  const costKey = Object.keys(MODEL_COSTS).find((k) => model.includes(k)) ?? '';
  const costs = MODEL_COSTS[costKey] ?? { input: 2.5, output: 10 }; // default to gpt-4o pricing
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

/**
 * Rough token count estimate: ~4 chars per token for English text.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── OpenAI-Compatible Provider ──────────────────────────────────────

export class OpenAICompatibleProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private fallbackModel: string | null;
  private baseUrl: string;

  constructor() {
    this.apiKey = Deno.env.get('AI_API_KEY') ?? '';
    this.model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
    this.fallbackModel = Deno.env.get('AI_FALLBACK_MODEL') ?? null;
    this.baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1';

    if (!this.apiKey) {
      console.warn('AI_API_KEY not set — AI provider will fail on requests');
    }
  }

  get isAnthropicAPI(): boolean {
    return this.baseUrl.includes('anthropic.com') || this.baseUrl.includes('/v1/messages');
  }

  async chat(messages: AIMessage[], options?: AIProviderOptions): Promise<AIResponse> {
    try {
      return await this.callModel(this.model, messages, options);
    } catch (error) {
      if (this.fallbackModel) {
        console.warn(`Primary model ${this.model} failed, falling back to ${this.fallbackModel}:`, error);
        return await this.callModel(this.fallbackModel, messages, options);
      }
      throw error;
    }
  }

  private async callModel(
    model: string,
    messages: AIMessage[],
    options?: AIProviderOptions,
  ): Promise<AIResponse> {
    const cachedBlocks = options?.cacheOptions?.cachedSystemBlocks;

    if (this.isAnthropicAPI && cachedBlocks && cachedBlocks.length > 0) {
      return this.callAnthropicNative(model, messages, cachedBlocks, options);
    }

    return this.callOpenAICompatible(model, messages, cachedBlocks, options);
  }

  // ── OpenAI-compatible request path ────────────────────────────────

  private async callOpenAICompatible(
    model: string,
    messages: AIMessage[],
    cachedBlocks: CacheableSystemBlock[] | undefined,
    options?: AIProviderOptions,
  ): Promise<AIResponse> {
    // If cachedSystemBlocks provided, prepend as a merged system message
    let finalMessages = messages;
    if (cachedBlocks && cachedBlocks.length > 0) {
      const mergedSystem = cachedBlocks.map((b) => b.text).join('\n\n');
      const nonSystem = messages.filter((m) => m.role !== 'system');
      finalMessages = [{ role: 'system' as const, content: mergedSystem }, ...nonSystem];
    }

    const body: Record<string, unknown> = {
      model,
      messages: finalMessages.map((m) => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
    };

    if (options?.json_mode) {
      body.response_format = { type: 'json_object' };
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.tool_choice) {
        body.tool_choice = options.tool_choice;
      }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No response from AI provider');
    }

    const usage = data.usage ?? {};

    return {
      content: choice.message?.content ?? null,
      tool_calls: choice.message?.tool_calls ?? [],
      model: data.model ?? model,
      input_tokens: usage.prompt_tokens ?? estimateTokenCount(JSON.stringify(messages)),
      output_tokens: usage.completion_tokens ?? estimateTokenCount(choice.message?.content ?? ''),
      total_tokens: usage.total_tokens ?? 0,
      finish_reason: choice.finish_reason ?? 'stop',
      cache_read_tokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
      cache_creation_tokens: 0,
    };
  }

  // ── Anthropic-native request path (with prompt caching) ───────────

  private async callAnthropicNative(
    model: string,
    messages: AIMessage[],
    cachedBlocks: CacheableSystemBlock[],
    options?: AIProviderOptions,
  ): Promise<AIResponse> {
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.name) msg.name = m.name;
        return msg;
      });

    const systemBlocks = cachedBlocks.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
    }));

    const body: Record<string, unknown> = {
      model,
      system: systemBlocks,
      messages: nonSystemMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const usage = data.usage ?? {};

    // Anthropic returns content as an array of blocks
    const textContent = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    // Map Anthropic tool_use blocks to OpenAI-style tool_calls
    const toolCalls = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'tool_use')
      .map((b: { id: string; name: string; input: unknown }) => ({
        id: b.id,
        type: 'function' as const,
        function: {
          name: b.name,
          arguments: JSON.stringify(b.input),
        },
      }));

    return {
      content: textContent || null,
      tool_calls: toolCalls,
      model: data.model ?? model,
      input_tokens: usage.input_tokens ?? estimateTokenCount(JSON.stringify(messages)),
      output_tokens: usage.output_tokens ?? estimateTokenCount(textContent),
      total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      finish_reason: data.stop_reason === 'end_turn' ? 'stop' : (data.stop_reason ?? 'stop'),
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
    };
  }
}

/**
 * Create the configured AI provider instance.
 */
export function createAIProvider(): AIProvider {
  return new OpenAICompatibleProvider();
}
