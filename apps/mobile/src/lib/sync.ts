// ── Client Sync ─────────────────────────────────────────────────────
// Write-through sync from local stores to Supabase. Best-effort — a
// failed push is queued in AsyncStorage and retried on the next app
// launch or sync attempt. The local store remains the source of truth
// for the UI; server state is a write-through cache used by server-side
// features (coach memory, weekly summary, admin analytics).
//
// Scope: summary-level only. Full relational sync (set_logs joined on
// exercises, meal_items joined on barcode, etc.) is deferred — see
// docs/DECISIONS.md.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { captureException } from './observability';
import type { CompletedSession } from '../types/workout';
import type { MealEntry } from '../types/nutrition';

const QUEUE_KEY = '@sync/queue';
const MAX_QUEUE_ITEMS = 100;

type QueueItem =
  | { kind: 'workout_session'; session: CompletedSession }
  | { kind: 'meal_log'; date: string; meal: MealEntry };

// ── Queue helpers ────────────────────────────────────────────────────

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  try {
    const trimmed = queue.slice(-MAX_QUEUE_ITEMS);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // swallow
  }
}

async function enqueue(item: QueueItem): Promise<void> {
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
}

// ── Auth helper ──────────────────────────────────────────────────────

async function getAuthedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Push a workout session ───────────────────────────────────────────

async function pushWorkoutSession(session: CompletedSession, userId: string): Promise<boolean> {
  const exercisesJson = session.exercises.map((ex) => ({
    exercise_id: ex.exerciseId,
    exercise_name: ex.exerciseName,
    sets: ex.sets.map((set) => ({
      set_number: set.setNumber,
      set_type: set.setType,
      weight: set.weight,
      reps: set.reps,
      duration_seconds: set.durationSeconds,
      rpe: set.rpe,
      is_pr: set.isPR,
      completed_at: set.completedAt,
    })),
  }));

  const payload = {
    user_id: userId,
    local_id: session.id,
    name: session.name,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    duration_seconds: session.durationSeconds,
    notes: session.notes || null,
    mood_rating: session.mood,
    total_volume: session.totalVolume,
    total_sets: session.totalSets,
    pr_count: session.prCount,
    exercises_json: exercisesJson,
    is_synced: true,
  };

  const { error } = await supabase
    .from('workout_sessions')
    .upsert(payload, { onConflict: 'user_id,local_id' });

  if (error) {
    captureException(error, { where: 'sync.pushWorkoutSession', local_id: session.id });
    return false;
  }
  return true;
}

// ── Push a meal log ──────────────────────────────────────────────────

async function pushMealLog(date: string, meal: MealEntry, userId: string): Promise<boolean> {
  // 1. Upsert the day log (day_log_id is required on meal_logs).
  const totals = meal.items.reduce(
    (acc, item) => {
      acc.calories += item.calories;
      acc.protein += item.protein_g;
      acc.carbs += item.carbs_g;
      acc.fat += item.fat_g;
      acc.fiber += item.fiber_g;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  const { data: dayLog, error: dayErr } = await supabase
    .from('nutrition_day_logs')
    .upsert(
      {
        user_id: userId,
        date,
      },
      { onConflict: 'user_id,date' },
    )
    .select('id')
    .single();

  if (dayErr || !dayLog) {
    captureException(dayErr ?? new Error('Missing dayLog'), {
      where: 'sync.pushMealLog.dayLog',
      date,
    });
    return false;
  }

  const itemsJson = meal.items.map((item) => ({
    name: item.name,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
    quantity: item.quantity,
    unit: item.unit,
    is_estimate: item.is_estimate,
  }));

  const mealPayload = {
    user_id: userId,
    local_id: meal.id,
    day_log_id: dayLog.id as string,
    meal_type: meal.mealType,
    name: meal.name,
    source: meal.source,
    photo_url: meal.photoUri ?? null,
    notes: meal.notes ?? null,
    logged_at: meal.timestamp,
    items_json: itemsJson,
    is_synced: true,
  };

  const { error: mealErr } = await supabase
    .from('meal_logs')
    .upsert(mealPayload, { onConflict: 'user_id,local_id' });

  if (mealErr) {
    captureException(mealErr, { where: 'sync.pushMealLog.meal', local_id: meal.id });
    return false;
  }

  // Best-effort: update the day log totals to keep consumed columns in step.
  await supabase
    .from('nutrition_day_logs')
    .update({
      calories_consumed: Math.round(totals.calories),
      protein_consumed_g: Math.round(totals.protein * 10) / 10,
      carbs_consumed_g: Math.round(totals.carbs * 10) / 10,
      fat_consumed_g: Math.round(totals.fat * 10) / 10,
      fiber_consumed_g: Math.round(totals.fiber * 10) / 10,
    })
    .eq('id', dayLog.id);

  return true;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Attempt to sync a completed workout session to Supabase. Queues the
 * session for retry if the push fails (no session, no network, etc.).
 */
export async function syncWorkoutSession(session: CompletedSession): Promise<void> {
  const userId = await getAuthedUserId();
  if (!userId) {
    await enqueue({ kind: 'workout_session', session });
    return;
  }
  try {
    const ok = await pushWorkoutSession(session, userId);
    if (!ok) {
      await enqueue({ kind: 'workout_session', session });
    }
  } catch (e) {
    captureException(e, { where: 'sync.syncWorkoutSession', local_id: session.id });
    await enqueue({ kind: 'workout_session', session });
  }
}

/**
 * Attempt to sync a meal log to Supabase. Queues for retry on failure.
 */
export async function syncMealLog(date: string, meal: MealEntry): Promise<void> {
  const userId = await getAuthedUserId();
  if (!userId) {
    await enqueue({ kind: 'meal_log', date, meal });
    return;
  }
  try {
    const ok = await pushMealLog(date, meal, userId);
    if (!ok) {
      await enqueue({ kind: 'meal_log', date, meal });
    }
  } catch (e) {
    captureException(e, { where: 'sync.syncMealLog', local_id: meal.id });
    await enqueue({ kind: 'meal_log', date, meal });
  }
}

/**
 * Flush the queued sync items. Safe to call at app launch or on
 * connectivity-restored events. Silently skips if no session.
 */
export async function flushSyncQueue(): Promise<{ flushed: number; remaining: number }> {
  const userId = await getAuthedUserId();
  if (!userId) {
    const queue = await readQueue();
    return { flushed: 0, remaining: queue.length };
  }

  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const failed: QueueItem[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      let ok = false;
      if (item.kind === 'workout_session') {
        ok = await pushWorkoutSession(item.session, userId);
      } else if (item.kind === 'meal_log') {
        ok = await pushMealLog(item.date, item.meal, userId);
      }
      if (ok) flushed++;
      else failed.push(item);
    } catch {
      failed.push(item);
    }
  }

  await writeQueue(failed);
  return { flushed, remaining: failed.length };
}
