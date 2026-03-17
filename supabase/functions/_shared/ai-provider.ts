// ── Provider-Agnostic AI Service Layer ──────────────────────────────

import type {
  AIMessage,
  AIResponse,
  AIProviderOptions,
  AIProvider,
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
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => {
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
      throw new Error(`AI API error (${response.status}): ${errorText}`);
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
    };
  }
}

/**
 * Create the configured AI provider instance.
 */
export function createAIProvider(): AIProvider {
  return new OpenAICompatibleProvider();
}
