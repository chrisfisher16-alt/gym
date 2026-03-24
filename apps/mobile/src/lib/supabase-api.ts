import { supabase, isSupabaseConfigured } from './supabase';
import { enqueue } from './supabase-sync';
import { generateId } from './workout-utils';

// React Native compatible UUID generation (crypto.randomUUID not available in Hermes/JSC)
function uuid(): string {
  return generateId('sb');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FormIQ Supabase API Layer
// All data access functions for the frontend.
// Each function writes locally first (via the store) and queues sync to Supabase.
// ═══════════════════════════════════════════════════════════════════════════════

// Helper to get authenticated user ID; throws if not authed
async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ─── Workout API ───────────────────────────────────────────────────────────────

export async function getActiveWorkout(): Promise<unknown | null> {
  if (!isSupabaseConfigured) return null;

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`*, set_logs (*)`)
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startWorkout(params: {
  programId?: string;
  workoutDayId?: string;
  name: string;
}): Promise<{ sessionId: string }> {
  const userId = await requireUserId();
  const id = uuid();

  const payload = {
    id,
    user_id: userId,
    program_id: params.programId ?? null,
    workout_day_id: params.workoutDayId ?? null,
    name: params.name,
    started_at: new Date().toISOString(),
    is_synced: false,
  };

  // Queue for sync (offline-safe)
  await enqueue('session_create', 'workout_sessions', 'insert', payload);

  return { sessionId: id };
}

export async function logSet(params: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  setType?: string;
  isPR?: boolean;
}): Promise<{ setId: string }> {
  const id = uuid();

  const payload = {
    id,
    session_id: params.sessionId,
    exercise_id: params.exerciseId,
    set_number: params.setNumber,
    weight_kg: params.weight ?? null,
    reps: params.reps ?? null,
    rpe: params.rpe ?? null,
    set_type: params.setType ?? 'working',
    is_pr: params.isPR ?? false,
  };

  await enqueue('set_log', 'set_logs', 'insert', payload);

  return { setId: id };
}

export async function completeSet(setId: string, updates: {
  weight?: number;
  reps?: number;
  rpe?: number;
  isPR?: boolean;
}): Promise<void> {
  await enqueue('set_update', 'set_logs', 'update', {
    id: setId,
    weight_kg: updates.weight,
    reps: updates.reps,
    rpe: updates.rpe,
    is_pr: updates.isPR ?? false,
  });
}

export async function finishWorkout(
  sessionId: string,
  mood?: number,
  notes?: string,
): Promise<void> {
  const now = new Date().toISOString();

  await enqueue('session_complete', 'workout_sessions', 'update', {
    id: sessionId,
    completed_at: now,
    mood_rating: mood ?? null,
    notes: notes ?? null,
    is_synced: false, // Will be marked true after successful sync
  });
}

export async function discardWorkout(sessionId: string): Promise<void> {
  await enqueue('session_discard', 'workout_sessions', 'delete', {
    id: sessionId,
  });
}

// ─── Exercise History & Suggestions ────────────────────────────────────────────

export async function getExerciseHistory(
  exerciseId: string,
  limit = 10,
): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('set_logs')
    .select(`
      *,
      workout_sessions!inner (
        id, name, started_at, user_id
      )
    `)
    .eq('exercise_id', exerciseId)
    .eq('workout_sessions.user_id', userId)
    .not('workout_sessions.completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit * 5); // Get enough sets to cover `limit` sessions

  if (error) throw error;
  return data ?? [];
}

export async function getSuggestedWeight(
  exerciseId: string,
  targetReps: number,
  equipment?: string,
): Promise<{ weight: number; isProgression: boolean } | null> {
  if (!isSupabaseConfigured) return null;

  const userId = await requireUserId();

  // Get the most recent completed session's sets for this exercise
  const { data: recentSets, error } = await supabase
    .from('set_logs')
    .select(`
      weight_kg, reps, set_type,
      workout_sessions!inner (
        id, completed_at, user_id
      )
    `)
    .eq('exercise_id', exerciseId)
    .eq('set_type', 'working')
    .eq('workout_sessions.user_id', userId)
    .not('workout_sessions.completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !recentSets?.length) return null;

  // Group by session (the most recent one)
  const lastSessionId = (recentSets[0] as any).workout_sessions?.id;
  const lastSessionSets = recentSets.filter(
    (s: any) => s.workout_sessions?.id === lastSessionId,
  );

  if (!lastSessionSets.length) return null;

  const lastWeight = (lastSessionSets[0] as any).weight_kg ?? 0;
  const allHitTarget = lastSessionSets.every(
    (s: any) => (s.reps ?? 0) >= targetReps,
  );

  // Progressive overload: if all sets hit target reps, suggest increment
  const increment = getIncrement(equipment);

  if (allHitTarget && lastWeight > 0) {
    return { weight: lastWeight + increment, isProgression: true };
  }

  return { weight: lastWeight, isProgression: false };
}

function getIncrement(equipment?: string): number {
  switch (equipment) {
    case 'dumbbells':
      return 1;
    case 'barbell':
      return 2.5;
    case 'cable':
    case 'machine':
      return 2.5;
    default:
      return 2.5;
  }
}

// ─── Nutrition API ─────────────────────────────────────────────────────────────

export async function logMeal(params: {
  date: string;
  mealType: string;
  name: string;
  items: Array<{
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  source?: string;
}): Promise<void> {
  const userId = await requireUserId();

  // Ensure day log exists — use deterministic ID to prevent duplicates across offline syncs.
  // The nutrition_day_logs table has a UNIQUE(user_id, date) constraint.
  // We first try to get the existing day_log, otherwise create one.
  let dayLogId: string;
  if (isSupabaseConfigured) {
    const { data: existing } = await supabase
      .from('nutrition_day_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', params.date)
      .maybeSingle();
    dayLogId = existing?.id ?? uuid();
  } else {
    dayLogId = uuid();
  }

  await enqueue('meal_log', 'nutrition_day_logs', 'upsert', {
    id: dayLogId,
    user_id: userId,
    date: params.date,
  });

  // Create meal log
  const mealLogId = uuid();
  await enqueue('meal_log', 'meal_logs', 'insert', {
    id: mealLogId,
    user_id: userId,
    day_log_id: dayLogId,
    meal_type: params.mealType,
    name: params.name,
    source: params.source ?? 'manual',
    logged_at: new Date().toISOString(),
  });

  // Create meal items
  for (const item of params.items) {
    await enqueue('meal_log', 'meal_items', 'insert', {
      id: uuid(),
      meal_log_id: mealLogId,
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    });
  }
}

export async function logWater(amountMl: number): Promise<void> {
  const userId = await requireUserId();

  await enqueue('water_log', 'hydration_logs', 'insert', {
    id: uuid(),
    user_id: userId,
    amount_ml: amountMl,
    logged_at: new Date().toISOString(),
  });
}

// ─── Progress API ──────────────────────────────────────────────────────────────

export async function getProgressData(timeRange: 'week' | 'month' | '3months' = 'month') {
  if (!isSupabaseConfigured) return null;

  const userId = await requireUserId();
  const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const [sessions, prs, measurements, streak, achievements] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, started_at, completed_at, duration_seconds, name')
      .eq('user_id', userId)
      .gte('started_at', since)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false }),

    supabase
      .from('personal_records')
      .select('*, exercises(name, category)')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
      .limit(20),

    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30),

    supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single(),

    supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false }),
  ]);

  return {
    sessions: sessions.data ?? [],
    personalRecords: prs.data ?? [],
    bodyMeasurements: measurements.data ?? [],
    streak: streak.data,
    achievements: achievements.data ?? [],
  };
}

// ─── Streak API ────────────────────────────────────────────────────────────────

export async function getUserStreak() {
  if (!isSupabaseConfigured) return null;

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateStreak(lastWorkoutDate: string): Promise<void> {
  const userId = await requireUserId();

  // Get current streak
  const { data: current } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!current) return;

  // Compare dates as local calendar days (YYYY-MM-DD) to avoid timezone issues
  const lastDateStr = current.last_workout_date; // 'YYYY-MM-DD' from Supabase date column
  const todayStr = lastWorkoutDate.slice(0, 10); // Extract date portion
  const dayDiff = lastDateStr
    ? Math.round(
        (new Date(todayStr + 'T12:00:00').getTime() - new Date(lastDateStr + 'T12:00:00').getTime()) / 86400000,
      )
    : 0;

  let newStreak = current.current_streak;
  if (dayDiff === 1) {
    newStreak++;
  } else if (dayDiff > 1) {
    newStreak = 1;
  }
  // If dayDiff === 0, same day workout, streak doesn't change

  const longest = Math.max(newStreak, current.longest_streak);

  await enqueue('profile_update', 'user_streaks', 'update', {
    id: current.id,
    current_streak: newStreak,
    longest_streak: longest,
    last_workout_date: lastWorkoutDate,
  });
}

// ─── Achievements API ──────────────────────────────────────────────────────────

const ACHIEVEMENT_DEFINITIONS = [
  { type: 'first_workout', name: 'First Step', desc: 'Complete your first workout', icon: 'barbell-outline', check: (ctx: AchCtx) => ctx.totalSessions >= 1 },
  { type: 'sessions_5', name: 'Getting Started', desc: 'Complete 5 workouts', icon: 'fitness-outline', check: (ctx: AchCtx) => ctx.totalSessions >= 5 },
  { type: 'sessions_10', name: 'Dedicated', desc: 'Complete 10 workouts', icon: 'fitness-outline', check: (ctx: AchCtx) => ctx.totalSessions >= 10 },
  { type: 'sessions_25', name: 'Iron Will', desc: 'Complete 25 workouts', icon: 'fitness-outline', check: (ctx: AchCtx) => ctx.totalSessions >= 25 },
  { type: 'sessions_50', name: 'Half Century', desc: 'Complete 50 workouts', icon: 'medal-outline', check: (ctx: AchCtx) => ctx.totalSessions >= 50 },
  { type: 'streak_7', name: 'Week Warrior', desc: '7-day streak', icon: 'flame-outline', check: (ctx: AchCtx) => ctx.currentStreak >= 7 },
  { type: 'streak_14', name: 'Two Week Champion', desc: '14-day streak', icon: 'flame-outline', check: (ctx: AchCtx) => ctx.currentStreak >= 14 },
  { type: 'streak_30', name: 'Monthly Master', desc: '30-day streak', icon: 'flame-outline', check: (ctx: AchCtx) => ctx.currentStreak >= 30 },
  { type: 'volume_10k', name: 'Volume Crusher', desc: 'Lift 10,000kg in one session', icon: 'trending-up-outline', check: (ctx: AchCtx) => ctx.sessionVolume >= 10000 },
  { type: 'volume_50k', name: 'Iron Mountain', desc: 'Lift 50,000kg total', icon: 'trending-up-outline', check: (ctx: AchCtx) => ctx.totalVolume >= 50000 },
  { type: 'first_pr', name: 'Record Breaker', desc: 'Set your first PR', icon: 'trophy-outline', check: (ctx: AchCtx) => ctx.totalPRs >= 1 },
  { type: 'prs_10', name: 'PR Machine', desc: 'Set 10 personal records', icon: 'trophy-outline', check: (ctx: AchCtx) => ctx.totalPRs >= 10 },
];

interface AchCtx {
  totalSessions: number;
  currentStreak: number;
  sessionVolume: number;
  totalVolume: number;
  totalPRs: number;
}

export async function checkAchievements(context: AchCtx): Promise<string[]> {
  if (!isSupabaseConfigured) return [];

  const userId = await requireUserId();

  // Get already-earned achievements
  const { data: earned } = await supabase
    .from('achievements')
    .select('achievement_type')
    .eq('user_id', userId);

  const earnedTypes = new Set((earned ?? []).map((a: any) => a.achievement_type));
  const newlyEarned: string[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (earnedTypes.has(def.type)) continue;
    if (def.check(context)) {
      await enqueue('achievement_earned', 'achievements', 'insert', {
        id: uuid(),
        user_id: userId,
        achievement_type: def.type,
        name: def.name,
        description: def.desc,
        icon: def.icon,
        earned_at: new Date().toISOString(),
        metadata: context,
      });
      newlyEarned.push(def.name);
    }
  }

  return newlyEarned;
}

// ─── Profile API ───────────────────────────────────────────────────────────────

export async function updateProfile(updates: Record<string, unknown>): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  if (!isSupabaseConfigured) return;

  // Call the server-side function that cascades user deletion
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw error;

  // Sign out locally
  await supabase.auth.signOut();
}

// ─── Social Auth ───────────────────────────────────────────────────────────────

export async function signInWithApple(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function sendMagicLink(email: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
