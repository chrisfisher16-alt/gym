import { createServiceClient } from '@/lib/supabase/service';

export interface RevenueMetrics {
  mrr: number;
  totalActiveSubscribers: number;
  planMix: { plan_id: string; subscribers: number; mrr: number }[];
  churnedThisMonth: number;
  churnRatePct: number;
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('revenue_metrics_vw')
    .select('mrr_usd, total_active_subscribers, plan_mix, churned_this_month, churn_rate_pct')
    .single();

  if (!data) {
    return { mrr: 0, totalActiveSubscribers: 0, planMix: [], churnedThisMonth: 0, churnRatePct: 0 };
  }

  const planMix = Array.isArray(data.plan_mix)
    ? data.plan_mix.map((p: Record<string, unknown>) => ({
        plan_id: String(p.plan_id ?? ''),
        subscribers: Number(p.subscribers) || 0,
        mrr: Number(p.mrr) || 0,
      }))
    : [];

  return {
    mrr: Number(data.mrr_usd) || 0,
    totalActiveSubscribers: Number(data.total_active_subscribers) || 0,
    planMix,
    churnedThisMonth: Number(data.churned_this_month) || 0,
    churnRatePct: Number(data.churn_rate_pct) || 0,
  };
}

export interface SubscriptionEvent {
  id: string;
  user_email: string;
  event_type: string;
  plan_id: string | null;
  previous_plan_id: string | null;
  revenue_usd: number;
  created_at: string;
}

export interface SubscriptionEventsResult {
  events: SubscriptionEvent[];
  total: number;
}

export async function getSubscriptionEvents(
  page: number = 1,
  pageSize: number = 20,
  eventType?: string
): Promise<SubscriptionEventsResult> {
  const sb = createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from('subscription_events')
    .select('id, user_id, event_type, plan_id, previous_plan_id, revenue_usd, created_at, profiles!inner(email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (eventType && eventType !== 'all') {
    query = query.eq('event_type', eventType);
  }

  const { data, count } = await query;

  return {
    events: (data ?? []).map((row) => {
      const profile = row.profiles as unknown as { email: string };
      return {
        id: row.id,
        user_email: profile?.email ?? 'Unknown',
        event_type: row.event_type,
        plan_id: row.plan_id,
        previous_plan_id: row.previous_plan_id,
        revenue_usd: Number(row.revenue_usd) || 0,
        created_at: row.created_at,
      };
    }),
    total: count ?? 0,
  };
}

export interface PlanMix {
  plan_id: string;
  count: number;
}

export async function getPlanMix(): Promise<PlanMix[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('entitlements')
    .select('tier');

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.tier] = (counts[row.tier] || 0) + 1;
  }

  return Object.entries(counts).map(([plan_id, count]) => ({ plan_id, count }));
}

export async function getChurnMetrics(): Promise<{ cancellationRate: number; failedRenewals: number }> {
  const sb = createServiceClient();

  const { count: canceled } = await sb
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'canceled');

  const { count: pastDue } = await sb
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'past_due');

  const { count: total } = await sb
    .from('subscriptions')
    .select('id', { count: 'exact', head: true });

  const t = total ?? 1;
  return {
    cancellationRate: t > 0 ? Math.round(((canceled ?? 0) / t) * 10000) / 100 : 0,
    failedRenewals: pastDue ?? 0,
  };
}
