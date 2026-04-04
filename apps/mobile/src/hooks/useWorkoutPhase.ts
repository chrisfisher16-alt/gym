import { useEffect, useRef, useState } from 'react';
import { useWorkoutStore } from '../stores/workout-store';

export type WorkoutPhase =
  | 'idle'
  | 'active_set'
  | 'resting'
  | 'pr_achieved'
  | 'workout_complete';

/**
 * Determines the current workout phase for ambient status bar display.
 *
 * Phase priority (highest to lowest):
 * 1. workout_complete — session just ended (3s then idle)
 * 2. pr_achieved — PR just hit (2s then back to active_set)
 * 3. resting — rest timer is running
 * 4. active_set — workout active, not resting
 * 5. idle — no active session
 */
export function useWorkoutPhase(): WorkoutPhase {
  const activeSession = useWorkoutStore((s) => s.activeSession);

  // Track whether a workout was just completed
  const [justCompleted, setJustCompleted] = useState(false);
  const prevSessionRef = useRef(activeSession);

  // Track PR flash state
  const [prFlash, setPrFlash] = useState(false);
  const lastPrTimestampRef = useRef<string | null>(null);

  // Detect workout completion: session went from truthy to null
  useEffect(() => {
    if (prevSessionRef.current && !activeSession) {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 3000);
      return () => clearTimeout(timer);
    }
    prevSessionRef.current = activeSession;
  }, [activeSession]);

  // Detect new PRs by scanning completed sets for isPR with recent completedAt
  useEffect(() => {
    if (!activeSession) return;

    let latestPrTimestamp: string | null = null;
    for (const exercise of activeSession.exercises) {
      for (const set of exercise.sets) {
        if (set.isPR && set.completedAt) {
          if (!latestPrTimestamp || set.completedAt > latestPrTimestamp) {
            latestPrTimestamp = set.completedAt;
          }
        }
      }
    }

    // If we found a PR timestamp that's newer than what we've seen before, trigger flash
    if (latestPrTimestamp && latestPrTimestamp !== lastPrTimestampRef.current) {
      lastPrTimestampRef.current = latestPrTimestamp;
      setPrFlash(true);
      const timer = setTimeout(() => setPrFlash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeSession]);

  // Determine phase
  if (justCompleted) return 'workout_complete';
  if (!activeSession) return 'idle';
  if (prFlash) return 'pr_achieved';

  // Check if rest timer is running
  if (activeSession.restTimerEndAt) {
    const endTime = new Date(activeSession.restTimerEndAt).getTime();
    if (endTime > Date.now()) {
      return 'resting';
    }
  }

  return 'active_set';
}
