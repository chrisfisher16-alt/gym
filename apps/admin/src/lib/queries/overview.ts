import { createServiceClient } from '@/lib/supabase/service';
import { subDays, format } from 'date-fns';

export interface OverviewKPIs {
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  mau: number;
  paidConversionRate: number;
  mrr: number;
  churnRate: number;
  workoutsCompleted7d: number;
  mealsLogged7d: number;
  coachSessions7d: number;
  aiCostEstimate30d: number;
}

export async function getOverviewKPIs(): Promise<OverviewKPIs> {
  const sb = createServiceClient();
  const now = new Date();
  const d7 = format(subDays(now, 7), 'yyyy-MM-dd');
  const d30 = format(subDays(now, 30), 'yyyy-MM-dd');

  // Use daily_kpis_vw for aggregated metrics
  const { data: kpi7 } = await sb
    .from('daily_kpis_vw')
    .select('new_signups, active_workout_users, active_nutrition_users, total_workouts, total_meals_logged, ai_messages_sent, total_ai_cost_usd')
    .gte('kpi_date', d7);

  const { data: kpi30 } = await sb
    .from('daily_kpis_vw')
    .select('new_signups, total_ai_cost_usd')
    .gte('kpi_date', d30);

  const sum = (rows: Record<string, unknown>[] | null, key: string) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  // DAU = distinct users active today (workout or nutrition)
  const todayStr = format(now, 'yyyy-MM-dd');
  const { data: todayKpi } = await sb
    .from('daily_kpis_vw')
    .select('active_workout_users, active_nutrition_users')
    .eq('kpi_date', todayStr)
    .single();

  const dau = Math.max(
    Number(todayKpi?.active_workout_users) || 0,
    Number(todayKpi?.active_nutrition_users) || 0
  );

  // WAU = distinct users with usage_events in last 7d
  const { count: wau } = await sb
    .from('usage_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', new Date(d7).toISOString());

  // MAU = distinct users with usage_events in last 30d
  const { count: mau } = await sb
    .from('usage_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', new Date(d30).toISOString());

  // Total users
  const { count: totalUsers } = await sb
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  // Paid users
  const { count: paidUsers } = await sb
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .neq('tier', 'free');

  // Revenue metrics
  const { data: revData } = await sb
    .from('revenue_metrics_vw')
    .select('mrr_usd, churn_rate_pct')
    .single();

  // Coach sessions last 7d
  const { count: coachSessions7d } = await sb
    .from('coach_conversations')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', new Date(d7).toISOString());

  const total = totalUsers ?? 1;
  const paidConversionRate = total > 0 ? ((paidUsers ?? 0) / total) * 100 : 0;

  return {
    newUsers7d: sum(kpi7, 'new_signups'),
    newUsers30d: sum(kpi30, 'new_signups'),
    dau,
    wau: wau ?? 0,
    mau: mau ?? 0,
    paidConversionRate: Math.round(paidConversionRate * 10) / 10,
    mrr: Number(revData?.mrr_usd) || 0,
    churnRate: Number(revData?.churn_rate_pct) || 0,
    workoutsCompleted7d: sum(kpi7, 'total_workouts'),
    mealsLogged7d: sum(kpi7, 'total_meals_logged'),
    coachSessions7d: coachSessions7d ?? 0,
    aiCostEstimate30d: Math.round(sum(kpi30, 'total_ai_cost_usd') * 100) / 100,
  };
}

export interface TrendPoint {
  name: string;
  value: number;
}

export async function getSignupTrend(days: number = 30): Promise<TrendPoint[]> {
  const sb = createServiceClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data } = await sb
    .from('daily_kpis_vw')
    .select('kpi_date, new_signups')
    .gte('kpi_date', since)
    .order('kpi_date', { ascending: true });

  return (data ?? []).map((row) => ({
    name: format(new Date(row.kpi_date), 'MMM d'),
    value: Number(row.new_signups) || 0,
  }));
}

export async function getActiveUsersTrend(days: number = 30): Promise<{ name: string; workoutUsers: number; nutritionUsers: number }[]> {
  const sb = createServiceClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data } = await sb
    .from('daily_kpis_vw')
    .select('kpi_date, active_workout_users, active_nutrition_users')
    .gte('kpi_date', since)
    .order('kpi_date', { ascending: true });

  return (data ?? []).map((row) => ({
    name: format(new Date(row.kpi_date), 'MMM d'),
    workoutUsers: Number(row.active_workout_users) || 0,
    nutritionUsers: Number(row.active_nutrition_users) || 0,
  }));
}

export async function getRevenueTrend(days: number = 30): Promise<TrendPoint[]> {
  const sb = createServiceClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data } = await sb
    .from('daily_kpis_vw')
    .select('kpi_date, new_subscriptions')
    .gte('kpi_date', since)
    .order('kpi_date', { ascending: true });

  // Use subscription_events for actual revenue by day
  const { data: revEvents } = await sb
    .from('subscription_events')
    .select('created_at, revenue_usd')
    .gte('created_at', new Date(since).toISOString())
    .order('created_at', { ascending: true });

  // Aggregate by date
  const byDate: Record<string, number> = {};
  for (const row of data ?? []) {
    byDate[row.kpi_date] = 0;
  }
  for (const ev of revEvents ?? []) {
    const d = format(new Date(ev.created_at), 'yyyy-MM-dd');
    byDate[d] = (byDate[d] || 0) + (Number(ev.revenue_usd) || 0);
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      name: format(new Date(date), 'MMM d'),
      value: Math.round(value * 100) / 100,
    }));
}
