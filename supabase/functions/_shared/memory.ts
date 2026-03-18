// ── Coach Memory System ─────────────────────────────────────────────

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import type { UserContext, WorkoutSummary, NutritionDaySummary } from './types.ts';
import { estimateTokenCount } from './ai-provider.ts';

const MAX_CONTEXT_TOKENS = 6000;
const MAX_CONVERSATION_MESSAGES = 20;
const RECENT_WORKOUTS_COUNT = 5;
const RECENT_NUTRITION_DAYS = 3;

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
 * Load last N completed workout sessions.
 */
async function loadRecentWorkouts(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkoutSummary[]> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(RECENT_WORKOUTS_COUNT);

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
): Promise<NutritionDaySummary[]> {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < RECENT_NUTRITION_DAYS; i++) {
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

  // Trim if too large
  const tokens = estimateTokenCount(result);
  if (tokens > MAX_CONTEXT_TOKENS) {
    // Drop memory summaries first, then nutrition, then workout details
    const trimmedSections = sections.slice(0, -1);
    result = trimmedSections.join('\n\n');
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
