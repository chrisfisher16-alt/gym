// ── Coach Memory System ─────────────────────────────────────────────

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import type { UserContext, WorkoutSummary, NutritionDaySummary } from './types.ts';
import { estimateTokenCount } from './ai-provider.ts';
import { TTLCache } from './context-cache.ts';

const MAX_CONTEXT_TOKENS = 6000;
const MAX_CONVERSATION_MESSAGES = 20;
const RECENT_WORKOUTS_COUNT = 5;
const RECENT_NUTRITION_DAYS = 3;

// ── Intent Classification ───────────────────────────────────────────

export type ServerIntent = 'workout' | 'nutrition' | 'progress' | 'general';

/**
 * Lightweight server-side intent classifier for context loading optimization.
 * Determines which DB queries to run based on the user's message.
 */
export function classifyIntent(message: string): ServerIntent {
  const lower = message.toLowerCase();
  if (/\b(eat|meal|protein|carb|calorie|macro|diet|food|recipe|cook|nutrition|hungry|snack)\b/.test(lower))
    return 'nutrition';
  if (/\b(progress|pr|personal record|gained|lost|weight trend|body|measurement|stronger|improvement)\b/.test(lower))
    return 'progress';
  if (/\b(workout|exercise|set|rep|bench|squat|deadlift|weight|form|technique|split|program|routine|muscle|recovery)\b/.test(lower))
    return 'workout';
  return 'general';
}

// ── Stable + Dynamic Context Types ──────────────────────────────────

export interface StableContext {
  profile: UserContext['profile'];
  goals: {
    goal_type: string;
    target_value?: unknown;
    unit?: string;
    status?: string;
  } | null;
  preferences: UserContext['preferences'];
}

// Per-process cache for stable user context (profile, goals, preferences)
const stableCtxCache = new TTLCache<StableContext>(5 * 60 * 1000, 100);

export interface DynamicContext {
  recent_workouts: WorkoutSummary[];
  recent_nutrition: NutritionDaySummary[];
  memory_summaries: string[];
}

/**
 * Load the full user context for AI system prompt.
 * Memory hierarchy:
 * 1. Durable: Profile, goals, preferences (always included)
 * 2. Recent: Last few workouts/meals (included in context)
 * 3. Summaries: Weekly/monthly trend summaries (compressed)
 * 4. Conversational: Current conversation messages (windowed)
 */
export async function loadUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserContext> {
  const [profileResult, goalsResult, prefsResult, workoutsResult, nutritionResult, summariesResult] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').single(),
      supabase.from('coach_preferences').select('*').eq('user_id', userId).single(),
      loadRecentWorkouts(supabase, userId),
      loadRecentNutrition(supabase, userId),
      loadMemorySummaries(supabase, userId),
    ]);

  const profile = profileResult.data;
  const goals = goalsResult.data;
  const prefs = prefsResult.data;

  return {
    profile: {
      display_name: profile?.display_name ?? 'User',
      gender: profile?.gender,
      height_cm: profile?.height_cm,
      weight_kg: profile?.weight_kg,
      unit_preference: profile?.unit_preference ?? 'imperial',
    },
    goals: goals
      ? {
          goal_type: goals.goal_type,
          target_value: goals.target_value,
          unit: goals.unit,
          status: goals.status,
        }
      : null,
    preferences: prefs
      ? {
          product_mode: profile?.product_mode ?? 'full_health_coach',
          coach_tone: prefs.tone ?? 'balanced',
          focus_areas: prefs.focus_areas ?? [],
        }
      : null,
    recent_workouts: workoutsResult,
    recent_nutrition: nutritionResult,
    memory_summaries: summariesResult,
  };
}

/**
 * Load stable user data (profile, goals, preferences) — cacheable per user session.
 * Uses in-memory TTL cache to avoid redundant DB queries within a 5-minute window.
 */
export async function loadStableContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<StableContext> {
  // Check cache first
  const cacheKey = `stable:${userId}`;
  const cached = stableCtxCache.get(cacheKey);
  if (cached) return cached;

  // Cache miss — load from DB
  const [profileResult, goalsResult, prefsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').single(),
    supabase.from('coach_preferences').select('*').eq('user_id', userId).single(),
  ]);

  const profile = profileResult.data;
  const goals = goalsResult.data;
  const prefs = prefsResult.data;

  const stableCtx: StableContext = {
    profile: {
      display_name: profile?.display_name ?? 'User',
      gender: profile?.gender,
      height_cm: profile?.height_cm,
      weight_kg: profile?.weight_kg,
      unit_preference: profile?.unit_preference ?? 'imperial',
    },
    goals: goals
      ? {
          goal_type: goals.goal_type,
          target_value: goals.target_value,
          unit: goals.unit,
          status: goals.status,
        }
      : null,
    preferences: prefs
      ? {
          product_mode: profile?.product_mode ?? 'full_health_coach',
          coach_tone: prefs.tone ?? 'balanced',
          focus_areas: prefs.focus_areas ?? [],
        }
      : null,
  };

  // Store in cache
  stableCtxCache.set(cacheKey, stableCtx);

  return stableCtx;
}

/**
 * Load dynamic data filtered by intent — not cached, changes every request.
 */
export async function loadDynamicContext(
  supabase: SupabaseClient,
  userId: string,
  intent: ServerIntent,
): Promise<DynamicContext> {
  const queries: [
    Promise<WorkoutSummary[]>,
    Promise<NutritionDaySummary[]>,
    Promise<string[]>,
  ] = [
    // Workouts: load for workout/progress, skip for nutrition/general
    intent === 'workout'
      ? loadRecentWorkouts(supabase, userId, 5)
      : intent === 'progress'
        ? loadRecentWorkouts(supabase, userId, 3)
        : Promise.resolve([]),
    // Nutrition: load for nutrition/progress, skip for workout/general
    intent === 'nutrition'
      ? loadRecentNutrition(supabase, userId, 3)
      : intent === 'progress'
        ? loadRecentNutrition(supabase, userId, 1)
        : Promise.resolve([]),
    // Memory summaries: always load
    loadMemorySummaries(supabase, userId),
  ];

  const [workouts, nutrition, summaries] = await Promise.all(queries);

  return {
    recent_workouts: workouts,
    recent_nutrition: nutrition,
    memory_summaries: summaries,
  };
}

/**
 * Build context string from stable context (profile, goals, preferences).
 */
export function buildStableContextString(ctx: StableContext): string {
  const sections: string[] = [];

  sections.push(`## User Profile
- Name: ${ctx.profile.display_name}
- Gender: ${ctx.profile.gender ?? 'Not specified'}
- Height: ${ctx.profile.height_cm ? `${ctx.profile.height_cm}cm` : 'Not specified'}
- Weight: ${ctx.profile.weight_kg ? `${ctx.profile.weight_kg}kg` : 'Not specified'}
- Units: ${ctx.profile.unit_preference}`);

  if (ctx.goals) {
    sections.push(`## Goals
- Type: ${ctx.goals.goal_type}
- Target value: ${ctx.goals.target_value ?? 'Not set'}${ctx.goals.unit ? ` ${ctx.goals.unit}` : ''}
- Status: ${ctx.goals.status ?? 'active'}`);
  }

  if (ctx.preferences) {
    sections.push(`## Preferences
- Mode: ${ctx.preferences.product_mode}
- Coach tone: ${ctx.preferences.coach_tone}
- Focus areas: ${ctx.preferences.focus_areas.join(', ') || 'None specified'}`);
  }

  return sections.join('\n\n');
}

/**
 * Build context string from dynamic context (workouts, nutrition, memory).
 * Applies iterative trimming if the dynamic portion exceeds token budget.
 */
export function buildDynamicContextString(ctx: DynamicContext): string {
  const sections: string[] = [];

  if (ctx.recent_workouts.length > 0) {
    const workoutLines = ctx.recent_workouts.map((w) => {
      const exerciseList = w.exercises
        .slice(0, 3)
        .map((e) => `${e.name} (${e.sets} sets, best: ${e.best_set})`)
        .join('; ');
      return `- ${w.name} (${w.completed_at}): ${w.total_sets} sets, ${w.total_volume} volume${w.pr_count > 0 ? `, ${w.pr_count} PRs` : ''}. Exercises: ${exerciseList}`;
    });
    sections.push(`## Recent Workouts (last ${ctx.recent_workouts.length})\n${workoutLines.join('\n')}`);
  }

  if (ctx.recent_nutrition.length > 0) {
    const nutritionLines = ctx.recent_nutrition.map(
      (n) =>
        `- ${n.date}: ${n.total_calories} cal, ${n.protein_g}g protein, ${n.carbs_g}g carbs, ${n.fat_g}g fat, ${n.meals_count} meals, ${n.water_ml}ml water`,
    );
    sections.push(`## Recent Nutrition (last ${ctx.recent_nutrition.length} days)\n${nutritionLines.join('\n')}`);
  }

  if (ctx.memory_summaries.length > 0) {
    sections.push(`## Previous Coaching Notes\n${ctx.memory_summaries.join('\n')}`);
  }

  let result = sections.join('\n\n');

  // Iterative trimming: drop least important sections until within budget
  // Budget for dynamic portion is roughly half of max context tokens
  const dynamicBudget = Math.floor(MAX_CONTEXT_TOKENS * 0.6);
  while (estimateTokenCount(result) > dynamicBudget && sections.length > 1) {
    sections.pop();
    result = sections.join('\n\n');
  }

  return result;
}

/**
 * Load last N completed workout sessions.
 */
async function loadRecentWorkouts(
  supabase: SupabaseClient,
  userId: string,
  count: number = RECENT_WORKOUTS_COUNT,
): Promise<WorkoutSummary[]> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(count);

  if (!data || data.length === 0) return [];

  return data.map((session: Record<string, unknown>) => ({
    id: session.id as string,
    name: (session.name as string) ?? 'Workout',
    completed_at: session.completed_at as string,
    duration_seconds: (session.duration_seconds as number) ?? 0,
    total_sets: (session.total_sets as number) ?? 0,
    total_volume: (session.total_volume as number) ?? 0,
    pr_count: (session.pr_count as number) ?? 0,
    exercises: (session.exercises as Array<{ name: string; sets: number; best_set: string }>) ?? [],
  }));
}

/**
 * Load last N days of nutrition data.
 */
async function loadRecentNutrition(
  supabase: SupabaseClient,
  userId: string,
  days: number = RECENT_NUTRITION_DAYS,
): Promise<NutritionDaySummary[]> {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const { data } = await supabase
    .from('nutrition_day_logs')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates)
    .order('date', { ascending: false });

  if (!data || data.length === 0) return [];

  return data.map((day: Record<string, unknown>) => ({
    date: day.date as string,
    total_calories: (day.total_calories as number) ?? 0,
    protein_g: (day.total_protein_g as number) ?? 0,
    carbs_g: (day.total_carbs_g as number) ?? 0,
    fat_g: (day.total_fat_g as number) ?? 0,
    fiber_g: (day.total_fiber_g as number) ?? 0,
    meals_count: (day.meals_count as number) ?? 0,
    water_ml: (day.water_ml as number) ?? 0,
  }));
}

/**
 * Load compressed memory summaries for the user.
 */
async function loadMemorySummaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('coach_memory_summaries')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  return data?.map((s: { content: string }) => s.content) ?? [];
}

/**
 * Load conversation messages with windowing to keep context manageable.
 */
export async function loadConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Array<{ role: string; content: string }>> {
  const { data } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  // Window to last N messages to keep context manageable
  const messages = data as Array<{ role: string; content: string }>;
  if (messages.length <= MAX_CONVERSATION_MESSAGES) return messages;

  // Keep first message (system context) + last N messages
  return [messages[0], ...messages.slice(-MAX_CONVERSATION_MESSAGES + 1)];
}

/**
 * Build the context string from UserContext, estimating tokens.
 * Trims less-important sections if context is too large.
 */
export function buildContextString(context: UserContext): string {
  const sections: string[] = [];

  // Durable context (always included)
  sections.push(`## User Profile
- Name: ${context.profile.display_name}
- Gender: ${context.profile.gender ?? 'Not specified'}
- Height: ${context.profile.height_cm ? `${context.profile.height_cm}cm` : 'Not specified'}
- Weight: ${context.profile.weight_kg ? `${context.profile.weight_kg}kg` : 'Not specified'}
- Units: ${context.profile.unit_preference}`);

  if (context.goals) {
    sections.push(`## Goals
- Type: ${context.goals.goal_type}
- Target value: ${context.goals.target_value ?? 'Not set'}${context.goals.unit ? ` ${context.goals.unit}` : ''}
- Status: ${context.goals.status ?? 'active'}`);
  }

  if (context.preferences) {
    sections.push(`## Preferences
- Mode: ${context.preferences.product_mode}
- Coach tone: ${context.preferences.coach_tone}
- Focus areas: ${context.preferences.focus_areas.join(', ') || 'None specified'}`);
  }

  // Recent workouts
  if (context.recent_workouts.length > 0) {
    const workoutLines = context.recent_workouts.map((w) => {
      const exerciseList = w.exercises
        .slice(0, 3)
        .map((e) => `${e.name} (${e.sets} sets, best: ${e.best_set})`)
        .join('; ');
      return `- ${w.name} (${w.completed_at}): ${w.total_sets} sets, ${w.total_volume} volume${w.pr_count > 0 ? `, ${w.pr_count} PRs` : ''}. Exercises: ${exerciseList}`;
    });
    sections.push(`## Recent Workouts (last ${context.recent_workouts.length})\n${workoutLines.join('\n')}`);
  }

  // Recent nutrition
  if (context.recent_nutrition.length > 0) {
    const nutritionLines = context.recent_nutrition.map(
      (n) =>
        `- ${n.date}: ${n.total_calories} cal, ${n.protein_g}g protein, ${n.carbs_g}g carbs, ${n.fat_g}g fat, ${n.meals_count} meals, ${n.water_ml}ml water`,
    );
    sections.push(`## Recent Nutrition (last ${context.recent_nutrition.length} days)\n${nutritionLines.join('\n')}`);
  }

  // Memory summaries (compressed)
  if (context.memory_summaries.length > 0) {
    sections.push(`## Previous Coaching Notes\n${context.memory_summaries.join('\n')}`);
  }

  let result = sections.join('\n\n');

  // Iterative trimming: drop least important sections (last added = least important)
  // until we're within the token budget
  while (estimateTokenCount(result) > MAX_CONTEXT_TOKENS && sections.length > 1) {
    sections.pop();
    result = sections.join('\n\n');
  }

  return result;
}

/**
 * Save a conversation summary for long-term memory compression.
 */
export async function saveConversationSummary(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  summary: string,
  keyFacts: string[],
): Promise<void> {
  await supabase.from('coach_memory_summaries').insert({
    user_id: userId,
    summary_type: 'behavioral',
    content: summary,
    data: { key_facts: keyFacts, conversation_id: conversationId },
    created_at: new Date().toISOString(),
  });
}
