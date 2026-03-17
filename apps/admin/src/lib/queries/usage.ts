import { createServiceClient } from '@/lib/supabase/service';
import { subDays, format, startOfWeek } from 'date-fns';

export async function getDAU(): Promise<number> {
  const sb = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data } = await sb
    .from('daily_kpis_vw')
    .select('active_workout_users, active_nutrition_users')
    .eq('kpi_date', today)
    .single();

  // Use max of workout or nutrition users as proxy; in reality it's UNION of both
  return Math.max(
    Number(data?.active_workout_users) || 0,
    Number(data?.active_nutrition_users) || 0
  );
}

export async function getWAU(): Promise<number> {
  const sb = createServiceClient();
  const d7 = subDays(new Date(), 7).toISOString();
  const { count } = await sb
    .from('usage_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', d7);
  return count ?? 0;
}

export async function getMAU(): Promise<number> {
  const sb = createServiceClient();
  const d30 = subDays(new Date(), 30).toISOString();
  const { count } = await sb
    .from('usage_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', d30);
  return count ?? 0;
}

export interface WorkoutMetrics {
  data: { name: string; completed: number }[];
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
}

export async function getWorkoutMetrics(days: number = 7): Promise<WorkoutMetrics> {
  const sb = createServiceClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data: kpi } = await sb
    .from('daily_kpis_vw')
    .select('kpi_date, total_workouts')
    .gte('kpi_date', since)
    .order('kpi_date', { ascending: true });

  const chartData = (kpi ?? []).map((row) => ({
    name: format(new Date(row.kpi_date), 'EEE'),
    completed: Number(row.total_workouts) || 0,
  }));

  // Count starts and completions
  const sinceISO = new Date(since).toISOString();
  const { count: totalStarts } = await sb
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', sinceISO);

  const { count: totalCompletions } = await sb
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', sinceISO)
    .not('completed_at', 'is', null);

  const starts = totalStarts ?? 0;
  const completions = totalCompletions ?? 0;

  return {
    data: chartData,
    totalStarts: starts,
    totalCompletions: completions,
    completionRate: starts > 0 ? Math.round((completions / starts) * 100) : 0,
  };
}

export interface MealMetrics {
  data: { name: string; logged: number }[];
  sourcesBreakdown: { source: string; count: number }[];
}

export async function getMealMetrics(days: number = 7): Promise<MealMetrics> {
  const sb = createServiceClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data: kpi } = await sb
    .from('daily_kpis_vw')
    .select('kpi_date, total_meals_logged')
    .gte('kpi_date', since)
    .order('kpi_date', { ascending: true });

  const chartData = (kpi ?? []).map((row) => ({
    name: format(new Date(row.kpi_date), 'EEE'),
    logged: Number(row.total_meals_logged) || 0,
  }));

  // Source breakdown
  const sinceISO = new Date(since).toISOString();
  const { data: meals } = await sb
    .from('meal_logs')
    .select('source')
    .gte('logged_at', sinceISO);

  const sources: Record<string, number> = {};
  for (const m of meals ?? []) {
    sources[m.source] = (sources[m.source] || 0) + 1;
  }

  return {
    data: chartData,
    sourcesBreakdown: Object.entries(sources).map(([source, count]) => ({ source, count })),
  };
}

export interface CohortRow {
  week: string;
  [key: string]: string;
}

export async function getRetentionCohort(weeks: number = 4): Promise<CohortRow[]> {
  const sb = createServiceClient();
  const rows: CohortRow[] = [];

  for (let w = 0; w < weeks; w++) {
    const cohortStart = startOfWeek(subDays(new Date(), (weeks - w) * 7));
    const cohortEnd = subDays(cohortStart, -7);

    // Users who signed up in this week
    const { count: cohortSize } = await sb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cohortStart.toISOString())
      .lt('created_at', cohortEnd.toISOString());

    const size = cohortSize ?? 0;
    const row: CohortRow = { week: `W${w + 1}` };
    row['w0'] = '100%';

    // For each subsequent week, check how many had activity
    for (let r = 1; r <= weeks - w; r++) {
      const retStart = subDays(cohortStart, -(r * 7));
      const retEnd = subDays(retStart, -7);

      const { count: active } = await sb
        .from('usage_events')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', retStart.toISOString())
        .lt('created_at', retEnd.toISOString());

      const pct = size > 0 ? Math.round(((active ?? 0) / size) * 100) : 0;
      row[`w${r}`] = `${pct}%`;
    }

    // Fill remaining with '—'
    for (let r = weeks - w + 1; r <= weeks; r++) {
      row[`w${r}`] = '—';
    }

    rows.push(row);
  }

  return rows;
}

export interface FunnelStep {
  step: string;
  count: number;
  pct: string;
}

export async function getOnboardingFunnel(): Promise<FunnelStep[]> {
  const sb = createServiceClient();

  // Total users
  const { count: totalUsers } = await sb
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  const total = totalUsers ?? 0;

  // Onboarding completed
  const { count: onboardingDone } = await sb
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('onboarding_completed', true);

  // Users with goals set
  const { count: goalsSet } = await sb
    .from('goals')
    .select('user_id', { count: 'exact', head: true });

  // First workout
  const { count: firstWorkout } = await sb
    .from('workout_sessions')
    .select('user_id', { count: 'exact', head: true });

  // First meal
  const { count: firstMeal } = await sb
    .from('meal_logs')
    .select('user_id', { count: 'exact', head: true });

  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';

  return [
    { step: 'Signed Up', count: total, pct: '100%' },
    { step: 'Onboarding Completed', count: onboardingDone ?? 0, pct: pct(onboardingDone ?? 0) },
    { step: 'Goals Set', count: goalsSet ?? 0, pct: pct(goalsSet ?? 0) },
    { step: 'First Workout Logged', count: firstWorkout ?? 0, pct: pct(firstWorkout ?? 0) },
    { step: 'First Meal Logged', count: firstMeal ?? 0, pct: pct(firstMeal ?? 0) },
  ];
}

export interface EngagementMetrics {
  avgWorkoutsPerWeek: number;
  avgMealsPerDay: number;
}

export async function getEngagementMetrics(): Promise<EngagementMetrics> {
  const sb = createServiceClient();
  const d7 = subDays(new Date(), 7).toISOString();
  const d1 = subDays(new Date(), 1).toISOString();

  // Active users last 7d
  const { count: activeUsers } = await sb
    .from('usage_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', d7);

  const { count: workouts7d } = await sb
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', d7);

  const { count: meals1d } = await sb
    .from('meal_logs')
    .select('id', { count: 'exact', head: true })
    .gte('logged_at', d1);

  const active = activeUsers ?? 1;
  return {
    avgWorkoutsPerWeek: active > 0 ? Math.round(((workouts7d ?? 0) / active) * 10) / 10 : 0,
    avgMealsPerDay: active > 0 ? Math.round(((meals1d ?? 0) / active) * 10) / 10 : 0,
  };
}
