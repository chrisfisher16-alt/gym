import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompletedSession, PersonalRecord } from '../types/workout';

/**
 * Local workout database operations.
 * Currently uses AsyncStorage. Will connect to Supabase later.
 */

const SYNC_QUEUE_KEY = '@workout/sync_queue';

interface SyncQueueItem {
  id: string;
  type: 'session_completed' | 'exercise_created' | 'program_created' | 'program_updated';
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

// ── Sync Queue (Stub) ───────────────────────────────────────────────

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = existing ? JSON.parse(existing) : [];

    queue.push({
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Silently fail - sync is best-effort
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const queue = await getSyncQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
}

// ── PR Calculation ──────────────────────────────────────────────────

export function calculatePRsFromHistory(
  history: CompletedSession[],
): Record<string, PersonalRecord> {
  const records: Record<string, PersonalRecord> = {};

  for (const session of history) {
    for (const exercise of session.exercises) {
      for (const setData of exercise.sets) {
        if (setData.setType === 'warmup' || !setData.weight || !setData.reps) continue;

        const current = records[exercise.exerciseId] ?? {
          exerciseId: exercise.exerciseId,
          heaviestWeight: null,
          mostReps: null,
          highestVolume: null,
        };

        const volume = setData.weight * setData.reps;

        if (!current.heaviestWeight || setData.weight > current.heaviestWeight.weight) {
          current.heaviestWeight = {
            weight: setData.weight,
            reps: setData.reps,
            date: setData.completedAt,
          };
        }

        if (
          !current.mostReps ||
          (setData.weight >= current.mostReps.weight && setData.reps > current.mostReps.reps)
        ) {
          current.mostReps = {
            weight: setData.weight,
            reps: setData.reps,
            date: setData.completedAt,
          };
        }

        if (!current.highestVolume || volume > current.highestVolume.volume) {
          current.highestVolume = {
            weight: setData.weight,
            reps: setData.reps,
            volume,
            date: setData.completedAt,
          };
        }

        records[exercise.exerciseId] = current;
      }
    }
  }

  return records;
}

// ── Volume Calculation ──────────────────────────────────────────────

export function calculateTotalVolumeForExercise(
  exerciseId: string,
  history: CompletedSession[],
): { date: string; volume: number }[] {
  const dataPoints: { date: string; volume: number }[] = [];

  for (const session of history) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) continue;

    let sessionVolume = 0;
    for (const setData of exercise.sets) {
      if (setData.setType === 'warmup') continue;
      sessionVolume += (setData.weight ?? 0) * (setData.reps ?? 0);
    }

    if (sessionVolume > 0) {
      dataPoints.push({
        date: session.completedAt,
        volume: sessionVolume,
      });
    }
  }

  return dataPoints.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Exercise History ────────────────────────────────────────────────

export function getExerciseHistory(
  exerciseId: string,
  history: CompletedSession[],
  limit: number = 10,
): Array<{
  sessionId: string;
  sessionName: string;
  date: string;
  sets: Array<{
    weight?: number;
    reps?: number;
    rpe?: number;
    setType: string;
    isPR: boolean;
  }>;
}> {
  const results: Array<{
    sessionId: string;
    sessionName: string;
    date: string;
    sets: Array<{
      weight?: number;
      reps?: number;
      rpe?: number;
      setType: string;
      isPR: boolean;
    }>;
  }> = [];

  const sorted = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sorted) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) continue;

    results.push({
      sessionId: session.id,
      sessionName: session.name,
      date: session.completedAt,
      sets: exercise.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        setType: s.setType,
        isPR: s.isPR,
      })),
    });

    if (results.length >= limit) break;
  }

  return results;
}
