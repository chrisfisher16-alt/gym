// ── Provider-Agnostic AI Service Layer ──────────────────────────────

import type {
  AIMessage,
  AIResponse,
  AIProviderOptions,
  AIProvider,
  AIToolCall,
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

  // ── Streaming ─────────────────────────────────────────────────────

  async *chatStream(
    messages: AIMessage[],
    options?: AIProviderOptions,
  ): AsyncGenerator<AIStreamChunk> {
    const model = this.model;
    const cachedBlocks = options?.cacheOptions?.cachedSystemBlocks;

    if (this.isAnthropicAPI && cachedBlocks && cachedBlocks.length > 0) {
      yield* this.streamAnthropicNative(model, messages, cachedBlocks, options);
    } else {
      yield* this.streamOpenAICompatible(model, messages, cachedBlocks, options);
    }
  }

  private async *streamOpenAICompatible(
    model: string,
    messages: AIMessage[],
    cachedBlocks: CacheableSystemBlock[] | undefined,
    options?: AIProviderOptions,
  ): AsyncGenerator<AIStreamChunk> {
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
      stream: true,
    };

    if (options?.json_mode) {
      body.response_format = { type: 'json_object' };
    }
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.tool_choice) body.tool_choice = options.tool_choice;
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

    let fullContent = '';
    let finishReason = 'stop';
    const toolCalls: AIToolCall[] = [];
    // Accumulate partial tool call data keyed by index
    const toolCallPartials: Record<number, { id: string; name: string; args: string }> = {};

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullContent += delta.content;
            yield { type: 'token', text: delta.content };
          }

          // Accumulate streamed tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallPartials[idx]) {
                toolCallPartials[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
              }
              if (tc.id) toolCallPartials[idx].id = tc.id;
              if (tc.function?.name) toolCallPartials[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallPartials[idx].args += tc.function.arguments;
            }
          }

          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    // Finalize tool calls
    for (const idx of Object.keys(toolCallPartials).map(Number).sort()) {
      const p = toolCallPartials[idx];
      toolCalls.push({
        id: p.id,
        type: 'function',
        function: { name: p.name, arguments: p.args },
      });
    }

    yield {
      type: 'done',
      response: {
        content: fullContent || null,
        tool_calls: toolCalls,
        model,
        input_tokens: estimateTokenCount(JSON.stringify(messages)),
        output_tokens: estimateTokenCount(fullContent),
        total_tokens: 0,
        finish_reason: finishReason,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      },
    };
  }

  private async *streamAnthropicNative(
    model: string,
    messages: AIMessage[],
    cachedBlocks: CacheableSystemBlock[],
    options?: AIProviderOptions,
  ): AsyncGenerator<AIStreamChunk> {
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
      stream: true,
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

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let stopReason = 'stop';
    const toolCalls: AIToolCall[] = [];
    // Track current tool_use block being streamed
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);

          switch (event.type) {
            case 'content_block_start':
              if (event.content_block?.type === 'tool_use') {
                currentToolId = event.content_block.id ?? '';
                currentToolName = event.content_block.name ?? '';
                currentToolArgs = '';
              }
              break;

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta' && event.delta.text) {
                fullContent += event.delta.text;
                yield { type: 'token', text: event.delta.text };
              } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
                currentToolArgs += event.delta.partial_json;
              }
              break;

            case 'content_block_stop':
              if (currentToolId) {
                toolCalls.push({
                  id: currentToolId,
                  type: 'function',
                  function: { name: currentToolName, arguments: currentToolArgs },
                });
                currentToolId = '';
                currentToolName = '';
                currentToolArgs = '';
              }
              break;

            case 'message_delta':
              if (event.delta?.stop_reason) {
                stopReason = event.delta.stop_reason;
              }
              if (event.usage) {
                outputTokens = event.usage.output_tokens ?? outputTokens;
              }
              break;

            case 'message_start':
              if (event.message?.usage) {
                inputTokens = event.message.usage.input_tokens ?? 0;
                cacheReadTokens = event.message.usage.cache_read_input_tokens ?? 0;
                cacheCreationTokens = event.message.usage.cache_creation_input_tokens ?? 0;
              }
              break;
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    yield {
      type: 'done',
      response: {
        content: fullContent || null,
        tool_calls: toolCalls,
        model,
        input_tokens: inputTokens || estimateTokenCount(JSON.stringify(messages)),
        output_tokens: outputTokens || estimateTokenCount(fullContent),
        total_tokens: (inputTokens || 0) + (outputTokens || 0),
        finish_reason: stopReason === 'end_turn' ? 'stop' : (stopReason ?? 'stop'),
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: cacheCreationTokens,
      },
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

// ── Stream Chunk Type ────────────────────────────────────────────────

export interface AIStreamChunk {
  type: 'token' | 'done';
  text?: string;
  response?: AIResponse;
}

/**
 * Create the configured AI provider instance.
 */
export function createAIProvider(): AIProvider {
  return new OpenAICompatibleProvider();
}
