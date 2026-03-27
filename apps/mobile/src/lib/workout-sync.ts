// ── Workout History Sync ──────────────────────────────────────────────
// Maps between local CompletedSession format and Supabase workout_sessions
// columns. Enqueues completed workouts for sync and merges remote history.
//
// All operations are offline-safe — sync failures are silent and never block UI.

import { enqueue, pullWorkoutSessions } from './supabase-sync';
import { isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../stores/auth-store';
import { useWorkoutStore } from '../stores/workout-store';
import type {
  CompletedSession,
  CompletedExercise,
  CompletedSet,
} from '../types/workout';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Guard flag to prevent the store-bridge subscription from re-enqueuing
 * sessions that were just merged from remote.
 */
let _mergeInProgress = false;
export function isMergeInProgress(): boolean {
  return _mergeInProgress;
}

// ── Types ────────────────────────────────────────────────────────────

/** Shape of a workout_sessions row from Supabase (with nested set_logs). */
interface RemoteWorkoutSession {
  id: string;
  user_id: string;
  program_id: string | null;
  workout_day_id: string | null;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  mood_rating: number | null;
  local_id: string | null;
  created_at: string;
  set_logs?: RemoteSetLog[];
}

interface RemoteSetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  is_pr: boolean;
  notes: string | null;
  created_at: string;
}

// ── Enqueue Workout for Sync ─────────────────────────────────────────

/**
 * Enqueues a completed workout session for Supabase sync.
 * Maps local CompletedSession fields to the workout_sessions table columns,
 * then enqueues each exercise's set_logs separately.
 *
 * Non-blocking — failures are silently caught.
 */
export async function enqueueWorkoutSession(
  session: CompletedSession,
): Promise<void> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Enqueue the session row
    await enqueue('session_complete', 'workout_sessions', 'upsert', {
      id: session.id,
      user_id: user.id,
      program_id: session.programId ?? null,
      workout_day_id: session.dayId ?? null,
      name: session.name,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      duration_seconds: session.durationSeconds,
      notes: session.notes || null,
      mood_rating: session.mood ?? null,
      local_id: session.id,
      is_synced: true,
    });

    // Enqueue each set_log
    for (const exercise of session.exercises) {
      for (const s of exercise.sets) {
        await enqueue('set_log', 'set_logs', 'upsert', {
          id: s.id,
          session_id: session.id,
          exercise_id: exercise.exerciseId,
          set_number: s.setNumber,
          set_type: s.setType,
          weight_kg: s.weight ?? null,
          reps: s.reps ?? null,
          rpe: s.rpe ?? null,
          duration_seconds: s.durationSeconds ?? null,
          is_pr: s.isPR,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to enqueue workout session for sync:', err);
  }
}

// ── Map Remote → Local ───────────────────────────────────────────────

/**
 * Convert a Supabase workout_sessions row (with nested set_logs) into
 * a local CompletedSession.
 */
function mapRemoteToLocal(row: RemoteWorkoutSession): CompletedSession {
  const setLogs = row.set_logs ?? [];

  // Group set_logs by exercise_id
  const exerciseMap = new Map<string, RemoteSetLog[]>();
  for (const log of setLogs) {
    const existing = exerciseMap.get(log.exercise_id) ?? [];
    existing.push(log);
    exerciseMap.set(log.exercise_id, existing);
  }

  const exercises: CompletedExercise[] = [];
  for (const [exerciseId, logs] of exerciseMap) {
    const sortedLogs = logs.sort((a, b) => a.set_number - b.set_number);
    const sets: CompletedSet[] = sortedLogs.map((log) => ({
      id: log.id,
      setNumber: log.set_number,
      setType: log.set_type as CompletedSet['setType'],
      weight: log.weight_kg ?? undefined,
      reps: log.reps ?? undefined,
      durationSeconds: log.duration_seconds ?? undefined,
      rpe: log.rpe ?? undefined,
      isPR: log.is_pr,
      completedAt: log.created_at,
    }));

    exercises.push({
      exerciseId,
      exerciseName: '', // Remote doesn't carry name; will be resolved by UI
      sets,
    });
  }

  // Compute totals from sets
  let totalVolume = 0;
  let totalSets = 0;
  let prCount = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      totalSets++;
      if (s.weight && s.reps) {
        totalVolume += s.weight * s.reps;
      }
      if (s.isPR) prCount++;
    }
  }

  return {
    id: row.local_id ?? row.id,
    userId: row.user_id,
    programId: row.program_id ?? undefined,
    dayId: row.workout_day_id ?? undefined,
    name: row.name ?? 'Workout',
    startedAt: row.started_at,
    completedAt: row.completed_at ?? row.started_at,
    durationSeconds: row.duration_seconds ?? 0,
    exercises,
    totalVolume,
    totalSets,
    prCount,
    notes: row.notes ?? '',
    mood: row.mood_rating ?? undefined,
  };
}

// ── Merge Workout History ────────────────────────────────────────────

/**
 * Fetches remote workout history from Supabase and merges with local history.
 * Uses latest-write-wins by session ID:
 * - Remote only → pull into local
 * - Local only → already queued for sync
 * - Both exist → keep the one with the later completedAt
 *
 * Non-blocking, called on app init when authenticated.
 */
export async function mergeWorkoutHistory(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const user = useAuthStore.getState().user;
  if (!user) return;

  _mergeInProgress = true;
  try {
    const remoteRows = await pullWorkoutSessions(user.id);
    if (!remoteRows || remoteRows.length === 0) return;

    const remoteSessions = (remoteRows as RemoteWorkoutSession[])
      .filter((r) => r.completed_at != null)
      .map(mapRemoteToLocal);

    const local = useWorkoutStore.getState().history;

    const merged = mergeByLatestWrite(local, remoteSessions);

    // Only update if there are actual changes
    if (merged.length !== local.length || hasNewSessions(local, merged)) {
      useWorkoutStore.setState({ history: merged });

      // Persist merged history
      AsyncStorage.setItem(
        '@workout/history',
        JSON.stringify(merged),
      ).catch((e) => console.warn('[WorkoutSync] persist merged history failed:', e));
    }
  } catch (err) {
    console.warn('Workout history merge failed (non-fatal):', err);
  } finally {
    // Reset after a tick so the store subscription can skip this update
    setTimeout(() => {
      _mergeInProgress = false;
    }, 100);
  }
}

/**
 * Merge two session arrays by latest-write-wins on session ID.
 * Sessions that exist only in one source are kept as-is.
 * Sessions that exist in both sources keep the one with the later completedAt.
 */
function mergeByLatestWrite(
  local: CompletedSession[],
  remote: CompletedSession[],
): CompletedSession[] {
  const merged = new Map<string, CompletedSession>();

  // Start with local sessions
  for (const session of local) {
    merged.set(session.id, session);
  }

  // Merge remote — latest-write-wins
  for (const session of remote) {
    const existing = merged.get(session.id);
    if (!existing) {
      // Remote only — pull in
      merged.set(session.id, session);
    } else {
      // Both exist — keep the one with the later completedAt
      const existingTime = new Date(existing.completedAt).getTime();
      const remoteTime = new Date(session.completedAt).getTime();
      if (remoteTime > existingTime) {
        merged.set(session.id, session);
      }
    }
  }

  // Sort by completedAt descending (most recent first)
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

/** Check whether the merged list has sessions not in the original. */
function hasNewSessions(
  original: CompletedSession[],
  merged: CompletedSession[],
): boolean {
  const originalIds = new Set(original.map((s) => s.id));
  return merged.some((s) => !originalIds.has(s.id));
}
