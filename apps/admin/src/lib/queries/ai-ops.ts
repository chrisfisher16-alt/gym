import { createServiceClient } from '@/lib/supabase/service';
import { subDays, format } from 'date-fns';

export interface AIMetrics {
  messagesToday: number;
  tokenUsageToday: number;
  costEstimateMTD: number;
  errorRate: number;
}

export async function getAIMetrics(): Promise<AIMetrics> {
  const sb = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const { data: todayKpi } = await sb
    .from('daily_kpis_vw')
    .select('ai_messages_sent, total_ai_tokens, total_ai_cost_usd')
    .eq('kpi_date', today)
    .single();

  // MTD cost
  const { data: mtdData } = await sb
    .from('daily_kpis_vw')
    .select('total_ai_cost_usd')
    .gte('kpi_date', monthStart);

  const costMTD = (mtdData ?? []).reduce((acc, r) => acc + (Number(r.total_ai_cost_usd) || 0), 0);

  // Error rate (errors / total today)
  const todayISO = new Date(today).toISOString();
  const { count: totalEvents } = await sb
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayISO);

  const { count: errorEvents } = await sb
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayISO)
    .neq('status', 'success');

  const total = totalEvents ?? 1;
  const errors = errorEvents ?? 0;

  return {
    messagesToday: Number(todayKpi?.ai_messages_sent) || 0,
    tokenUsageToday: Number(todayKpi?.total_ai_tokens) || 0,
    costEstimateMTD: Math.round(costMTD * 100) / 100,
    errorRate: total > 0 ? Math.round((errors / total) * 1000) / 10 : 0,
  };
}

export interface LatencyPoint {
  name: string;
  avgLatency: number;
}

export async function getAILatencyTrend(days: number = 7): Promise<LatencyPoint[]> {
  const sb = createServiceClient();
  const since = subDays(new Date(), days).toISOString();

  const { data } = await sb
    .from('ai_usage_events')
    .select('created_at, latency_ms')
    .gte('created_at', since)
    .not('latency_ms', 'is', null)
    .order('created_at', { ascending: true });

  // Group by date
  const byDate: Record<string, { total: number; count: number }> = {};
  for (const row of data ?? []) {
    const date = format(new Date(row.created_at), 'MMM d');
    if (!byDate[date]) byDate[date] = { total: 0, count: 0 };
    byDate[date].total += Number(row.latency_ms) || 0;
    byDate[date].count += 1;
  }

  return Object.entries(byDate).map(([name, { total, count }]) => ({
    name,
    avgLatency: count > 0 ? Math.round(total / count) : 0,
  }));
}

export interface AIError {
  id: string;
  user_id: string;
  model: string;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface AIErrorsResult {
  errors: AIError[];
  total: number;
}

export async function getAIErrors(page: number = 1, pageSize: number = 20): Promise<AIErrorsResult> {
  const sb = createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await sb
    .from('ai_usage_events')
    .select('id, user_id, model, error, latency_ms, created_at', { count: 'exact' })
    .neq('status', 'success')
    .order('created_at', { ascending: false })
    .range(from, to);

  return {
    errors: (data ?? []) as AIError[],
    total: count ?? 0,
  };
}

export interface FlaggedConversation {
  id: string;
  user_id: string;
  context: string;
  title: string | null;
  message_count: number;
  last_message_at: string;
}

export async function getFlaggedConversations(): Promise<FlaggedConversation[]> {
  // Flagged conversations would need a flag column; for now, return conversations with errors
  const sb = createServiceClient();
  const { data } = await sb
    .from('ai_usage_events')
    .select('conversation_id, user_id, error, created_at, coach_conversations(id, context, title, message_count, last_message_at)')
    .neq('status', 'success')
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const seen = new Set<string>();
  const results: FlaggedConversation[] = [];

  for (const row of data ?? []) {
    const conv = row.coach_conversations as unknown as {
      id: string; context: string; title: string | null;
      message_count: number; last_message_at: string;
    } | null;
    if (!conv || seen.has(conv.id)) continue;
    seen.add(conv.id);
    results.push({
      id: conv.id,
      user_id: row.user_id,
      context: conv.context,
      title: conv.title,
      message_count: conv.message_count,
      last_message_at: conv.last_message_at,
    });
  }

  return results;
}

export interface ModelUsage {
  model: string;
  count: number;
  totalTokens: number;
  totalCost: number;
}

export async function getModelUsage(): Promise<ModelUsage[]> {
  const sb = createServiceClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data } = await sb
    .from('ai_usage_events')
    .select('model, total_tokens, estimated_cost_usd')
    .gte('created_at', monthStart);

  const byModel: Record<string, { count: number; totalTokens: number; totalCost: number }> = {};
  for (const row of data ?? []) {
    if (!byModel[row.model]) byModel[row.model] = { count: 0, totalTokens: 0, totalCost: 0 };
    byModel[row.model].count += 1;
    byModel[row.model].totalTokens += Number(row.total_tokens) || 0;
    byModel[row.model].totalCost += Number(row.estimated_cost_usd) || 0;
  }

  return Object.entries(byModel).map(([model, stats]) => ({
    model,
    count: stats.count,
    totalTokens: stats.totalTokens,
    totalCost: Math.round(stats.totalCost * 100) / 100,
  }));
}

export interface ToolCallMetric {
  toolName: string;
  count: number;
  successRate: number;
}

export async function getToolCallMetrics(): Promise<ToolCallMetric[]> {
  const sb = createServiceClient();
  const d30 = subDays(new Date(), 30).toISOString();

  const { data } = await sb
    .from('ai_usage_events')
    .select('tool_calls_count, status')
    .gte('created_at', d30)
    .gt('tool_calls_count', 0);

  const totalCalls = (data ?? []).reduce((acc, r) => acc + (Number(r.tool_calls_count) || 0), 0);
  const successCalls = (data ?? []).filter(r => r.status === 'success').reduce((acc, r) => acc + (Number(r.tool_calls_count) || 0), 0);

  return [{
    toolName: 'All Tool Calls',
    count: totalCalls,
    successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0,
  }];
}
