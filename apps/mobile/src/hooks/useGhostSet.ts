import { useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { CompletedSession, CompletedSet } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface GhostSetData {
  weight: number | null; // last session's weight for this set (null for bodyweight)
  reps: number | null; // last session's reps for this set
  durationSeconds: number | null; // last session's duration for time-based exercises
  date: string; // ISO string of when the ghost data is from
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Extract working-set data for a given exercise + set index from a completed session.
 * Falls back to the closest available set if the exact index is missing.
 */
function extractGhostFromSession(
  session: CompletedSession,
  exerciseId: string,
  setIndex: number,
): GhostSetData | null {
  const exerciseEntry = session.exercises.find(
    (e) => e.exerciseId === exerciseId,
  );
  if (!exerciseEntry) return null;

  const workingSets = exerciseEntry.sets.filter(
    (s: CompletedSet) =>
      s.setType === 'working' && (s.weight != null || s.reps != null || s.durationSeconds != null),
  );
  if (workingSets.length === 0) return null;

  // Prefer exact set index; fall back to closest available
  let matched: CompletedSet;
  if (setIndex < workingSets.length) {
    matched = workingSets[setIndex];
  } else {
    // Closest: clamp to the last working set
    matched = workingSets[workingSets.length - 1];
  }

  return {
    weight: matched.weight ?? null,
    reps: matched.reps ?? null,
    durationSeconds: matched.durationSeconds ?? null,
    date: session.completedAt,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Returns the "ghost" data (last session's weight/reps) for a given exercise
 * at a particular set index. Returns `null` when no history exists.
 *
 * The result is memoized against the exercise ID, set index, and history length
 * so it won't cause unnecessary re-renders.
 */
export function useGhostSet(
  exerciseId: string,
  setIndex: number,
): GhostSetData | null {
  const history = useWorkoutStore((s) => s.history);

  return useMemo(() => {
    if (history.length === 0) return null;

    // Sort newest-first
    const sorted = [...history].sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );

    // Find the most recent session that contains this exercise
    for (const session of sorted) {
      const ghost = extractGhostFromSession(session, exerciseId, setIndex);
      if (ghost) return ghost;
    }

    return null;
  }, [exerciseId, setIndex, history]);
}
