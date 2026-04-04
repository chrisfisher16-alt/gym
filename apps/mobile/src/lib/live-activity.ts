import { Platform } from 'react-native';
import type { ActiveWorkoutSession } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

interface WorkoutActivityProps {
  exerciseName: string;
  setProgress: string;
  exerciseProgress: string;
  targetWeight: number;
  targetReps: number;
  unit: string;
  isResting: boolean;
  restSecondsRemaining: number;
  elapsedMinutes: number;
}

interface RestInfo {
  isResting: boolean;
  restSecondsRemaining: number;
}

// ── Lazy-loaded Live Activity factory ────────────────────────────────

type LiveActivityInstance = {
  update(props: WorkoutActivityProps): Promise<void>;
  end(policy?: 'default' | 'immediate'): Promise<void>;
};

type LiveActivityFactoryType = {
  start(props: WorkoutActivityProps, url?: string): LiveActivityInstance;
  getInstances(): LiveActivityInstance[];
};

let factory: LiveActivityFactoryType | null = null;
let currentActivity: LiveActivityInstance | null = null;

function getFactory(): LiveActivityFactoryType | null {
  if (Platform.OS !== 'ios') return null;
  if (factory) return factory;

  try {
    const { createLiveActivity } = require('expo-widgets');
    const layout = require('../../../widgets/workout-live-activity').default;
    factory = createLiveActivity('WorkoutLiveActivity', layout);
    return factory;
  } catch (e) {
    console.warn('[LiveActivity] factory init failed:', e);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildProps(
  session: ActiveWorkoutSession,
  unit: string,
  restInfo?: RestInfo,
): WorkoutActivityProps {
  const exercise = session.exercises[session.currentExerciseIndex];

  const completedSets = exercise
    ? exercise.sets.filter((s) => s.isCompleted).length
    : 0;
  const totalSets = exercise ? exercise.sets.length : 0;

  const completedExercises = session.exercises.filter(
    (e) => e.sets.every((s) => s.isCompleted) || e.isSkipped,
  ).length;
  const totalExercises = session.exercises.length;

  // Find next incomplete set to show target weight/reps
  const nextSet = exercise?.sets.find((s) => !s.isCompleted);

  const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  return {
    exerciseName: exercise?.exerciseName ?? session.name,
    setProgress: `${completedSets}/${totalSets} sets`,
    exerciseProgress: `${completedExercises}/${totalExercises}`,
    targetWeight: nextSet?.weight ?? 0,
    targetReps: nextSet?.reps ?? 0,
    unit,
    isResting: restInfo?.isResting ?? false,
    restSecondsRemaining: restInfo?.restSecondsRemaining ?? 0,
    elapsedMinutes,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Start a Live Activity when a workout begins.
 * No-ops gracefully on Android/web or if expo-widgets is unavailable.
 */
export function startWorkoutActivity(
  session: ActiveWorkoutSession,
  unit: string = 'lbs',
): void {
  try {
    const f = getFactory();
    if (!f) return;

    // End any stale activity from a previous session
    const existing = f.getInstances();
    for (const a of existing) {
      try { a.end('immediate'); } catch (e) { console.warn('[LiveActivity] end stale failed:', e); }
    }

    const props = buildProps(session, unit);
    currentActivity = f.start(props, 'formiq://workout');
  } catch (e) { console.warn('[LiveActivity] start failed:', e); }
}

/**
 * Update the Live Activity (set completed, exercise changed, rest timer tick).
 */
export function updateWorkoutActivity(
  session: ActiveWorkoutSession,
  unit: string = 'lbs',
  restInfo?: RestInfo,
): void {
  try {
    if (!currentActivity) return;
    const props = buildProps(session, unit, restInfo);
    currentActivity.update(props);
  } catch (e) { console.warn('[LiveActivity] update failed:', e); }
}

/**
 * End the Live Activity when the workout finishes or is cancelled.
 */
export function endWorkoutActivity(): void {
  try {
    if (!currentActivity) return;
    currentActivity.end('default');
    currentActivity = null;
  } catch (e) { console.warn('[LiveActivity] end failed:', e); }
}
