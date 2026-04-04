// ── Client-Side AI Telemetry ─────────────────────────────────────────
// Fire-and-forget logging of client-side AI usage to track costs.
// Failures are silently ignored — telemetry should never block the user.

import { supabase } from './supabase';

interface AIUsageEvent {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  intent?: string;
  cacheHit?: boolean;
  latencyMs?: number;
  status: 'success' | 'error' | 'fallback';
  context?: string;
}

/**
 * Log AI usage to ai_usage_events. Fire-and-forget — never awaited.
 */
export function logClientAIUsage(event: AIUsageEvent): void {
  // Don't block on telemetry
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('ai_usage_events').insert({
        user_id: user.id,
        model: event.model,
        input_tokens: event.inputTokens ?? 0,
        output_tokens: event.outputTokens ?? 0,
        total_tokens: event.totalTokens ?? (event.inputTokens ?? 0) + (event.outputTokens ?? 0),
        estimated_cost_usd: 0, // Client doesn't have cost tables
        latency_ms: event.latencyMs ?? 0,
        status: event.status,
        cache_hit: event.cacheHit ?? false,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        intent: event.intent ?? null,
        context_type: event.context ?? 'client_chat',
      });
    } catch {
      // Silently ignore telemetry failures
    }
  })();
}
