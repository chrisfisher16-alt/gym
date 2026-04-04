import type {
  TrackingMode,
  WeightContext,
  ExerciseLibraryEntry,
  ActiveExercise,
} from '../types/workout';

/**
 * Infer a TrackingMode from legacy boolean flags.
 * Used for backward compatibility with exercises that haven't been classified yet.
 */
export function inferTrackingMode(
  exercise: Pick<ExerciseLibraryEntry | ActiveExercise, 'isTimeBased' | 'isBodyweight'> & { equipment?: string },
): TrackingMode {
  if (exercise.isTimeBased) return 'duration';
  if (exercise.isBodyweight) return 'bodyweight_reps';
  return 'weight_reps';
}

/**
 * Resolve the tracking mode for an exercise, preferring the explicit field
 * and falling back to legacy inference.
 */
export function resolveTrackingMode(
  exercise: Pick<ExerciseLibraryEntry | ActiveExercise, 'trackingMode' | 'isTimeBased' | 'isBodyweight'> & { equipment?: string },
): TrackingMode {
  return exercise.trackingMode ?? inferTrackingMode(exercise);
}

/** Describes which input fields a tracking mode renders */
export interface TrackingModeFields {
  hasWeight: boolean;
  hasReps: boolean;
  hasDuration: boolean;
  hasDistance: boolean;
  hasAddedWeight: boolean;  // bodyweight + optional extra weight toggle
  usesSecondaryMetrics: boolean;
}

/**
 * Returns which input fields should be displayed for a given tracking mode.
 */
export function getFieldsForMode(mode: TrackingMode): TrackingModeFields {
  switch (mode) {
    case 'weight_reps':
      return { hasWeight: true, hasReps: true, hasDuration: false, hasDistance: false, hasAddedWeight: false, usesSecondaryMetrics: false };
    case 'bodyweight_reps':
      return { hasWeight: false, hasReps: true, hasDuration: false, hasDistance: false, hasAddedWeight: true, usesSecondaryMetrics: false };
    case 'duration':
      return { hasWeight: false, hasReps: false, hasDuration: true, hasDistance: false, hasAddedWeight: false, usesSecondaryMetrics: false };
    case 'duration_distance':
      return { hasWeight: false, hasReps: false, hasDuration: true, hasDistance: true, hasAddedWeight: false, usesSecondaryMetrics: true };
    case 'duration_level':
      return { hasWeight: false, hasReps: false, hasDuration: true, hasDistance: false, hasAddedWeight: false, usesSecondaryMetrics: true };
    case 'distance_weight':
      return { hasWeight: true, hasReps: false, hasDuration: false, hasDistance: true, hasAddedWeight: false, usesSecondaryMetrics: false };
    case 'reps_only':
      return { hasWeight: false, hasReps: true, hasDuration: false, hasDistance: false, hasAddedWeight: false, usesSecondaryMetrics: false };
    default:
      return { hasWeight: true, hasReps: true, hasDuration: false, hasDistance: false, hasAddedWeight: false, usesSecondaryMetrics: false };
  }
}

/**
 * Returns a display-friendly name for a tracking mode.
 */
export function getTrackingModeLabel(mode: TrackingMode): string {
  const labels: Record<TrackingMode, string> = {
    weight_reps: 'Weight & Reps',
    bodyweight_reps: 'Bodyweight',
    duration: 'Timed',
    duration_distance: 'Cardio',
    duration_level: 'Machine Cardio',
    distance_weight: 'Loaded Carry',
    reps_only: 'Reps Only',
  };
  return labels[mode] ?? 'Weight & Reps';
}

/**
 * Returns an Ionicons icon name for a tracking mode.
 */
export function getTrackingModeIcon(mode: TrackingMode): string {
  const icons: Record<TrackingMode, string> = {
    weight_reps: 'barbell-outline',
    bodyweight_reps: 'body-outline',
    duration: 'timer-outline',
    duration_distance: 'walk-outline',
    duration_level: 'speedometer-outline',
    distance_weight: 'footsteps-outline',
    reps_only: 'repeat-outline',
  };
  return icons[mode] ?? 'barbell-outline';
}

/**
 * Returns true if the weight context should show a weight input field.
 */
export function weightContextHasInput(ctx: WeightContext | undefined): boolean {
  if (!ctx) return true;
  return ctx !== 'body_only';
}
