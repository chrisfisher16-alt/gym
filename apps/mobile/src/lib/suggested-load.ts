import type { CompletedSession, LoadSuggestion, ExerciseLibraryEntry, ActiveExercise, TrackingMode, ExerciseDefaults } from '../types/workout';

/**
 * Progressive overload suggestion engine.
 *
 * Logic:
 * - Looks at the last session's performance for a given exercise
 * - If all target reps were hit → suggest small weight increase (2.5-5 lbs / 1-2.5 kg)
 * - If reps fell short → suggest same weight
 * - If reps significantly exceeded target → suggest bigger increase
 * - Returns human-readable explanation
 */

interface LastPerformance {
  weight: number;
  reps: number;
}

function parseTargetReps(targetReps: string): { min: number; max: number } {
  const parts = targetReps.split('-').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseInt(targetReps, 10);
  if (!isNaN(single)) {
    return { min: single, max: single };
  }
  return { min: 8, max: 12 }; // fallback
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export interface UserBodyMetrics {
  weightKg?: number;
  gender?: string;
  trainingExperience?: 'beginner' | 'intermediate' | 'advanced';
}

// Body-weight multipliers for beginner starting weights
// Format: [male_beginner, female_beginner, male_intermediate, female_intermediate]
const EXERCISE_MULTIPLIERS: Record<string, [number, number, number, number]> = {
  // Chest
  ex_bench_press: [0.5, 0.3, 0.75, 0.45],
  ex_incline_bench: [0.4, 0.25, 0.6, 0.4],
  ex_decline_bench: [0.45, 0.28, 0.65, 0.42],
  ex_db_bench_press: [0.15, 0.08, 0.22, 0.12],  // per dumbbell
  ex_incline_db_bench: [0.12, 0.07, 0.2, 0.1],
  ex_decline_db_bench: [0.12, 0.07, 0.2, 0.1],
  ex_db_flyes: [0.08, 0.05, 0.12, 0.08],
  ex_landmine_press: [0.2, 0.12, 0.3, 0.18],
  // Back
  ex_barbell_row: [0.4, 0.25, 0.6, 0.4],
  ex_pendlay_row: [0.35, 0.22, 0.55, 0.35],
  ex_db_row: [0.15, 0.08, 0.22, 0.12],
  ex_lat_pulldown: [0.4, 0.3, 0.6, 0.45],
  ex_seated_cable_row: [0.35, 0.25, 0.55, 0.4],
  ex_face_pull: [0.1, 0.07, 0.15, 0.1],
  ex_straight_arm_pulldown: [0.12, 0.08, 0.18, 0.12],
  ex_t_bar_row: [0.35, 0.2, 0.55, 0.35],
  // Shoulders
  ex_ohp: [0.3, 0.18, 0.5, 0.3],
  ex_db_shoulder_press: [0.1, 0.06, 0.18, 0.1],
  ex_lateral_raise: [0.05, 0.03, 0.08, 0.05],
  ex_front_raise: [0.05, 0.03, 0.08, 0.05],
  ex_rear_delt_fly: [0.05, 0.03, 0.08, 0.05],
  ex_arnold_press: [0.1, 0.06, 0.15, 0.08],
  ex_upright_row: [0.2, 0.12, 0.3, 0.2],
  ex_cable_lateral_raise: [0.05, 0.03, 0.08, 0.05],
  ex_shrugs: [0.25, 0.15, 0.4, 0.25],
  // Legs
  ex_barbell_squat: [0.6, 0.4, 0.9, 0.6],
  ex_front_squat: [0.45, 0.3, 0.7, 0.45],
  ex_leg_press: [1.0, 0.7, 1.5, 1.0],
  ex_romanian_deadlift: [0.4, 0.3, 0.65, 0.45],
  ex_deadlift: [0.6, 0.4, 1.0, 0.65],
  ex_sumo_deadlift: [0.6, 0.4, 1.0, 0.65],
  ex_goblet_squat: [0.15, 0.1, 0.25, 0.15],
  ex_leg_extension: [0.25, 0.18, 0.4, 0.28],
  ex_leg_curl: [0.2, 0.15, 0.35, 0.25],
  ex_hip_thrust: [0.5, 0.4, 0.8, 0.6],
  ex_bulgarian_split_squat: [0.1, 0.06, 0.15, 0.1], // per dumbbell
  ex_calf_raise: [0.3, 0.2, 0.5, 0.35],
  ex_hack_squat: [0.5, 0.35, 0.8, 0.55],
  ex_smith_squat: [0.4, 0.3, 0.65, 0.45],
  // Arms
  ex_barbell_curl: [0.2, 0.12, 0.3, 0.2],
  ex_db_curl: [0.06, 0.04, 0.1, 0.06],
  ex_hammer_curl: [0.07, 0.04, 0.12, 0.07],
  ex_preacher_curl: [0.15, 0.08, 0.25, 0.15],
  ex_cable_curl: [0.12, 0.08, 0.2, 0.12],
  ex_tricep_pushdown: [0.15, 0.1, 0.25, 0.15],
  ex_skull_crushers: [0.15, 0.08, 0.25, 0.15],
  ex_overhead_tricep_ext: [0.1, 0.06, 0.18, 0.1],
  ex_cable_overhead_ext: [0.1, 0.06, 0.18, 0.1],
  // Core (weighted)
  ex_cable_crunch: [0.2, 0.15, 0.35, 0.25],
  ex_cable_woodchop: [0.1, 0.07, 0.18, 0.12],
  ex_pallof_press: [0.08, 0.05, 0.12, 0.08],
};

// Default bodyweight exercise reps for beginners
const BODYWEIGHT_REPS: Record<string, [number, number, number, number]> = {
  // Format: [male_beginner, female_beginner, male_intermediate, female_intermediate]
  ex_push_up: [10, 5, 20, 12],
  ex_chest_dip: [6, 3, 12, 8],
  ex_pull_up: [4, 1, 10, 5],
  ex_chin_up: [5, 2, 12, 6],
  ex_inverted_row: [8, 5, 15, 10],
  ex_glute_bridge: [15, 12, 25, 20],
  ex_sissy_squat: [8, 5, 15, 10],
  ex_nordic_curl: [3, 1, 8, 4],
  ex_tricep_dip: [8, 4, 15, 10],
  ex_diamond_pushup: [6, 3, 15, 8],
  ex_dead_bug: [10, 8, 20, 15],
  ex_bird_dog: [10, 8, 15, 12],
  ex_hanging_leg_raise: [6, 3, 15, 8],
  ex_russian_twist: [15, 10, 25, 20],
  ex_ab_wheel: [5, 3, 12, 8],
  ex_bicycle_crunch: [15, 10, 25, 20],
  ex_v_up: [8, 5, 15, 10],
  ex_decline_crunch: [12, 8, 20, 15],
  ex_mountain_climber: [20, 15, 30, 25],
  ex_dragon_flag: [3, 1, 8, 4],
  ex_box_jump: [8, 6, 15, 10],
  ex_burpee: [8, 5, 15, 10],
  ex_leg_swings: [10, 10, 15, 15],
  ex_cat_cow: [10, 10, 15, 15],
  ex_walking_lunge_cooldown: [10, 8, 15, 12],
  ex_jump_rope: [30, 20, 60, 40], // count-based
};

export function getBeginnerSuggestion(
  exerciseId: string,
  targetReps: string,
  userMetrics: UserBodyMetrics,
  isBodyweight: boolean,
  isMetric: boolean,
): LoadSuggestion | null {
  const { weightKg, gender, trainingExperience } = userMetrics;

  // For bodyweight exercises, suggest reps
  if (isBodyweight) {
    const repsData = BODYWEIGHT_REPS[exerciseId];
    if (!repsData) {
      // Fallback: parse target reps
      const target = parseTargetReps(targetReps);
      return {
        suggestedWeight: 0,
        suggestedReps: target.min,
        explanation: 'Start with the target reps and build from there.',
        confidence: 'low',
      };
    }
    const isMale = gender !== 'female';
    const isIntermediate = trainingExperience === 'intermediate' || trainingExperience === 'advanced';
    const idx = (isMale ? 0 : 1) + (isIntermediate ? 2 : 0);
    const reps = repsData[idx];
    return {
      suggestedWeight: 0,
      suggestedReps: reps,
      explanation: `Starting suggestion: ${reps} reps based on your experience level.`,
      confidence: 'low',
    };
  }

  // For weighted exercises, need body weight
  if (!weightKg) return null;

  const multipliers = EXERCISE_MULTIPLIERS[exerciseId];
  if (!multipliers) {
    // Fallback: conservative estimate
    const target = parseTargetReps(targetReps);
    const fallbackWeight = roundToNearest(weightKg * 0.3, isMetric ? 2.5 : 5);
    const displayWeight = isMetric ? fallbackWeight : roundToNearest(fallbackWeight * 2.205, 5);
    return {
      suggestedWeight: displayWeight,
      suggestedReps: target.min,
      explanation: `Estimated starting weight. Adjust based on how it feels.`,
      confidence: 'low',
    };
  }

  const isMale = gender !== 'female';
  const isIntermediate = trainingExperience === 'intermediate' || trainingExperience === 'advanced';
  const idx = (isMale ? 0 : 1) + (isIntermediate ? 2 : 0);
  const multiplier = multipliers[idx];

  const target = parseTargetReps(targetReps);
  const rawWeight = weightKg * multiplier;
  const suggestedWeight = isMetric
    ? roundToNearest(rawWeight, 2.5)
    : roundToNearest(rawWeight * 2.205, 5);

  return {
    suggestedWeight,
    suggestedReps: target.min,
    explanation: `Starting suggestion based on your body weight. Adjust as needed.`,
    confidence: 'low',
  };
}

export function getSuggestedLoad(
  exerciseId: string,
  targetReps: string,
  targetSets: number,
  history: CompletedSession[],
  isMetric: boolean,
  userMetrics?: UserBodyMetrics,
  isBodyweight?: boolean,
  _allExercises?: ExerciseLibraryEntry[],
  _activeExercises?: ActiveExercise[],
): LoadSuggestion | null {
  // Find the most recent session containing this exercise
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  let lastSets: LastPerformance[] = [];
  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      lastSets = exerciseEntry.sets
        .filter((s) => s.setType === 'working' && s.weight != null && s.reps != null)
        .map((s) => ({ weight: s.weight!, reps: s.reps! }));
      break;
    }
  }

  if (lastSets.length === 0) {
    // No history - try beginner estimation if user metrics are available
    if (userMetrics) {
      return getBeginnerSuggestion(exerciseId, targetReps, userMetrics, !!isBodyweight, isMetric);
    }
    return null;
  }

  const target = parseTargetReps(targetReps);
  const lastWeight = lastSets[0].weight;
  const avgReps = lastSets.reduce((sum, s) => sum + s.reps, 0) / lastSets.length;
  const allHitTarget = lastSets.every((s) => s.reps >= target.max);
  const allExceeded = lastSets.every((s) => s.reps >= target.max + 2);
  const someShort = lastSets.some((s) => s.reps < target.min);

  const smallIncrement = isMetric ? 2.5 : 5;
  const bigIncrement = isMetric ? 5 : 10;
  const unit = isMetric ? 'kg' : 'lbs';

  const lastSummary = lastSets
    .map((s) => `${s.weight}${unit} × ${s.reps}`)
    .join(', ');

  if (allExceeded) {
    // Significantly exceeded - bigger increase
    const newWeight = roundToNearest(lastWeight + bigIncrement, smallIncrement);
    return {
      suggestedWeight: newWeight,
      suggestedReps: target.min,
      explanation: `You crushed all sets last time (${lastSummary}). Time to go heavier: ${newWeight}${unit} × ${target.min}.`,
      confidence: 'high',
    };
  }

  if (allHitTarget) {
    // Hit all target reps - small increase
    const newWeight = roundToNearest(lastWeight + smallIncrement, smallIncrement);
    return {
      suggestedWeight: newWeight,
      suggestedReps: target.min,
      explanation: `You hit all ${targetSets}×${target.max} at ${lastWeight}${unit} last time. Try ${newWeight}${unit} × ${target.min} today.`,
      confidence: 'high',
    };
  }

  if (someShort) {
    // Fell short - keep same weight
    return {
      suggestedWeight: lastWeight,
      suggestedReps: target.max,
      explanation: `Avg ${Math.round(avgReps)} reps last time at ${lastWeight}${unit}. Stay at ${lastWeight}${unit} and aim for ${target.max} reps.`,
      confidence: 'medium',
    };
  }

  // In between - keep same weight, aim for top of range
  return {
    suggestedWeight: lastWeight,
    suggestedReps: target.max,
    explanation: `Last: ${lastSummary}. Keep at ${lastWeight}${unit} and push for ${target.max} reps per set.`,
    confidence: 'medium',
  };
}

/**
 * Get the last performance for an exercise from history.
 */
export function getLastPerformance(
  exerciseId: string,
  history: CompletedSession[],
  unit: string,
): string | null {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      const workingSets = exerciseEntry.sets.filter((s) => s.setType === 'working');
      if (workingSets.length === 0) return null;
      return workingSets
        .map((s) => `${s.weight ?? 0}${unit} × ${s.reps ?? 0}`)
        .join(', ');
    }
  }

  return null;
}

/**
 * Get previous set data for a specific set number of an exercise.
 */
export function getPreviousSetData(
  exerciseId: string,
  setNumber: number,
  history: CompletedSession[],
): { weight: number; reps: number } | null {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      const workingSets = exerciseEntry.sets.filter((s) => s.setType === 'working');
      const matchingSet = workingSets[setNumber - 1];
      if (matchingSet && matchingSet.weight != null && matchingSet.reps != null) {
        return { weight: matchingSet.weight, reps: matchingSet.reps };
      }
      return null;
    }
  }

  return null;
}

// ── Full Previous Set Data (all metric fields) ─────────────────────

export interface PreviousSetDataFull {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distance?: number;
  distanceUnit?: 'miles' | 'km' | 'meters';
  incline?: number;
  speed?: number;
  speedUnit?: 'mph' | 'kph';
  level?: number;
  calories?: number;
  resistance?: number;
}

/**
 * Get full previous set data for a specific set number of an exercise.
 * Unlike getPreviousSetData, returns all metric fields from the CompletedSet.
 */
export function getPreviousSetDataFull(
  exerciseId: string,
  setNumber: number,
  history: CompletedSession[],
): PreviousSetDataFull | null {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      const workingSets = exerciseEntry.sets.filter((s) => s.setType === 'working');
      const matchingSet = workingSets[setNumber - 1];
      if (!matchingSet) return null;

      const result: PreviousSetDataFull = {};
      if (matchingSet.weight != null) result.weight = matchingSet.weight;
      if (matchingSet.reps != null) result.reps = matchingSet.reps;
      if (matchingSet.durationSeconds != null) result.durationSeconds = matchingSet.durationSeconds;
      if (matchingSet.distance != null) result.distance = matchingSet.distance;
      if (matchingSet.distanceUnit != null) result.distanceUnit = matchingSet.distanceUnit;
      if (matchingSet.incline != null) result.incline = matchingSet.incline;
      if (matchingSet.speed != null) result.speed = matchingSet.speed;
      if (matchingSet.speedUnit != null) result.speedUnit = matchingSet.speedUnit;
      if (matchingSet.level != null) result.level = matchingSet.level;
      if (matchingSet.calories != null) result.calories = matchingSet.calories;
      if (matchingSet.resistance != null) result.resistance = matchingSet.resistance;

      // Return null only if no fields were populated
      if (Object.keys(result).length === 0) return null;
      return result;
    }
  }

  return null;
}

// ── Full Suggestion Engine (multi-mode) ─────────────────────────────

export interface FullSuggestion {
  // Standard
  suggestedWeight?: number;
  suggestedReps?: number;
  // Duration
  suggestedDurationSeconds?: number;
  // Distance
  suggestedDistance?: number;
  suggestedDistanceUnit?: 'miles' | 'km' | 'meters';
  // Secondary metrics
  suggestedIncline?: number;
  suggestedSpeed?: number;
  suggestedLevel?: number;
  suggestedResistance?: number;
  // Meta
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'history' | 'exercise_default';
}

/**
 * Helper: find the most recent session's working sets for an exercise.
 */
function findLastWorkingSets(exerciseId: string, history: CompletedSession[]) {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      return exerciseEntry.sets.filter((s) => s.setType === 'working');
    }
  }
  return null;
}

/**
 * Multi-mode suggestion engine.
 * Provides progression suggestions for all tracking modes, not just weight_reps.
 */
export function getFullSuggestion(
  exerciseId: string,
  trackingMode: TrackingMode,
  defaults: ExerciseDefaults | undefined,
  history: CompletedSession[],
  isMetric: boolean,
): FullSuggestion | null {
  const lastSets = findLastWorkingSets(exerciseId, history);

  switch (trackingMode) {
    case 'weight_reps': {
      // Delegate to existing getSuggestedLoad and map the result
      const targetReps = defaults?.reps ?? '8-12';
      const targetSetsCount = defaults?.sets ?? 3;
      const existing = getSuggestedLoad(
        exerciseId,
        targetReps,
        targetSetsCount,
        history,
        isMetric,
      );
      if (!existing) return null;
      return {
        suggestedWeight: existing.suggestedWeight,
        suggestedReps: existing.suggestedReps,
        explanation: existing.explanation,
        confidence: existing.confidence,
        source: 'history',
      };
    }

    case 'duration': {
      if (lastSets && lastSets.length > 0) {
        const lastDuration = lastSets[0].durationSeconds;
        if (lastDuration != null) {
          const targetDuration = defaults?.durationSeconds ?? lastDuration;
          if (lastDuration >= targetDuration) {
            // Hit or exceeded target — suggest +10-15s (cap at +30s)
            const increase = Math.min(15, 30);
            const suggested = lastDuration + increase;
            return {
              suggestedDurationSeconds: suggested,
              explanation: `You held ${lastDuration}s last time (target: ${targetDuration}s). Try ${suggested}s today.`,
              confidence: 'high',
              source: 'history',
            };
          }
          // Didn't hit target — suggest same
          return {
            suggestedDurationSeconds: targetDuration,
            explanation: `You held ${lastDuration}s last time. Aim for ${targetDuration}s again.`,
            confidence: 'medium',
            source: 'history',
          };
        }
      }
      // No history — use defaults
      if (defaults?.durationSeconds) {
        return {
          suggestedDurationSeconds: defaults.durationSeconds,
          explanation: `Start with ${defaults.durationSeconds}s and build from there.`,
          confidence: 'low',
          source: 'exercise_default',
        };
      }
      return null;
    }

    case 'bodyweight_reps':
    case 'reps_only': {
      if (lastSets && lastSets.length > 0) {
        const avgReps =
          lastSets.reduce((sum, s) => sum + (s.reps ?? 0), 0) / lastSets.length;
        const target = parseTargetReps(defaults?.reps ?? '8-12');

        if (avgReps >= target.max) {
          // Exceeded target — suggest +1-2 reps
          const suggestedReps = Math.round(avgReps) + 1;
          return {
            suggestedReps,
            suggestedWeight: trackingMode === 'bodyweight_reps' ? 0 : undefined,
            explanation: `Avg ${Math.round(avgReps)} reps last time (target: ${target.max}). Push for ${suggestedReps} today.`,
            confidence: 'high',
            source: 'history',
          };
        }
        // Below target — keep aiming for target max
        return {
          suggestedReps: target.max,
          suggestedWeight: trackingMode === 'bodyweight_reps' ? 0 : undefined,
          explanation: `Avg ${Math.round(avgReps)} reps last time. Aim for ${target.max} reps.`,
          confidence: 'medium',
          source: 'history',
        };
      }
      // No history — use defaults
      const target = parseTargetReps(defaults?.reps ?? '8-12');
      return {
        suggestedReps: target.min,
        suggestedWeight: trackingMode === 'bodyweight_reps' ? 0 : undefined,
        explanation: `Start with ${target.min} reps and build up.`,
        confidence: 'low',
        source: 'exercise_default',
      };
    }

    case 'duration_distance': {
      if (lastSets && lastSets.length > 0) {
        const lastSet = lastSets[0];
        const lastDist = lastSet.distance;
        const lastDuration = lastSet.durationSeconds;
        const unit = lastSet.distanceUnit ?? defaults?.distanceUnit ?? 'miles';
        const targetDist = defaults?.distanceValue ?? lastDist;

        if (lastDist != null && targetDist != null && lastDist >= targetDist) {
          // Hit distance target — suggest +5%
          const suggestedDist = Math.round(lastDist * 1.05 * 100) / 100;
          return {
            suggestedDistance: suggestedDist,
            suggestedDistanceUnit: unit,
            suggestedDurationSeconds: lastDuration ?? defaults?.durationSeconds,
            explanation: `You covered ${lastDist} ${unit} last time. Try ${suggestedDist} ${unit} today.`,
            confidence: 'high',
            source: 'history',
          };
        }
        // Didn't hit target or no target — keep same
        return {
          suggestedDistance: targetDist ?? lastDist,
          suggestedDistanceUnit: unit,
          suggestedDurationSeconds: lastDuration ?? defaults?.durationSeconds,
          explanation: lastDist != null
            ? `You covered ${lastDist} ${unit} last time. Aim for ${targetDist} ${unit}.`
            : 'Keep at the same distance and push for consistency.',
          confidence: 'medium',
          source: 'history',
        };
      }
      // No history — use defaults
      if (defaults?.distanceValue) {
        return {
          suggestedDistance: defaults.distanceValue,
          suggestedDistanceUnit: defaults.distanceUnit ?? 'miles',
          suggestedDurationSeconds: defaults.durationSeconds,
          explanation: `Start with ${defaults.distanceValue} ${defaults.distanceUnit ?? 'miles'}.`,
          confidence: 'low',
          source: 'exercise_default',
        };
      }
      return null;
    }

    case 'duration_level': {
      if (lastSets && lastSets.length > 0) {
        const lastSet = lastSets[0];
        const lastLevel = lastSet.level;
        const lastDuration = lastSet.durationSeconds;

        if (lastLevel != null) {
          // Completed — suggest +1 level
          const suggestedLevel = lastLevel + 1;
          return {
            suggestedLevel,
            suggestedDurationSeconds: lastDuration ?? defaults?.durationSeconds,
            explanation: `You completed level ${lastLevel} last time. Try level ${suggestedLevel} today.`,
            confidence: 'high',
            source: 'history',
          };
        }
        if (lastDuration != null) {
          return {
            suggestedDurationSeconds: lastDuration,
            suggestedLevel: defaults?.secondaryDefaults?.level,
            explanation: `Keep the same settings and build consistency.`,
            confidence: 'medium',
            source: 'history',
          };
        }
      }
      // No history — use defaults
      return {
        suggestedDurationSeconds: defaults?.durationSeconds,
        suggestedLevel: defaults?.secondaryDefaults?.level,
        explanation: defaults?.durationSeconds
          ? `Start with ${defaults.durationSeconds}s at level ${defaults.secondaryDefaults?.level ?? 1}.`
          : 'Start at a comfortable level.',
        confidence: 'low',
        source: 'exercise_default',
      };
    }

    case 'distance_weight': {
      if (lastSets && lastSets.length > 0) {
        const lastSet = lastSets[0];
        const lastDist = lastSet.distance;
        const lastWeight = lastSet.weight;
        const unit = lastSet.distanceUnit ?? defaults?.distanceUnit ?? 'meters';
        const weightIncrement = isMetric ? 2.5 : 5;
        const distIncrement = 5; // 5 meters

        if (lastDist != null && lastWeight != null) {
          const targetDist = defaults?.distanceValue ?? lastDist;
          if (lastDist >= targetDist) {
            // Hit distance — suggest +weight or +distance
            const suggestedWeight = roundToNearest(lastWeight + weightIncrement, weightIncrement);
            return {
              suggestedWeight,
              suggestedDistance: lastDist,
              suggestedDistanceUnit: unit,
              explanation: `You carried ${lastWeight}${isMetric ? 'kg' : 'lbs'} for ${lastDist}${unit} last time. Try ${suggestedWeight}${isMetric ? 'kg' : 'lbs'} today.`,
              confidence: 'high',
              source: 'history',
            };
          }
          // Didn't hit distance — suggest more distance at same weight
          const suggestedDist = lastDist + distIncrement;
          return {
            suggestedWeight: lastWeight,
            suggestedDistance: suggestedDist,
            suggestedDistanceUnit: unit,
            explanation: `You carried ${lastWeight}${isMetric ? 'kg' : 'lbs'} for ${lastDist}${unit}. Aim for ${suggestedDist}${unit} today.`,
            confidence: 'medium',
            source: 'history',
          };
        }
      }
      // No history — use defaults
      if (defaults?.distanceValue) {
        return {
          suggestedDistance: defaults.distanceValue,
          suggestedDistanceUnit: defaults.distanceUnit ?? 'meters',
          explanation: `Start with ${defaults.distanceValue} ${defaults.distanceUnit ?? 'meters'}.`,
          confidence: 'low',
          source: 'exercise_default',
        };
      }
      return null;
    }

    default:
      return null;
  }
}
