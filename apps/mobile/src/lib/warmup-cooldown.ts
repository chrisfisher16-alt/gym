import type { MuscleGroup, ActiveExercise } from '../types/workout';
import type { ExerciseLibraryEntry } from '../types/workout';

// ── Warmup Mapping ──────────────────────────────────────────────────
// Maps workout focus areas to the most relevant warmup exercise IDs

const UPPER_BODY_WARMUPS = [
  'ex_arm_circles',
  'ex_cat_cow',
  'ex_worlds_greatest_stretch',
  'ex_jumping_jacks',
];

const LOWER_BODY_WARMUPS = [
  'ex_leg_swings',
  'ex_hip_circles',
  'ex_high_knees',
  'ex_butt_kicks',
  'ex_worlds_greatest_stretch',
];

const FULL_BODY_WARMUPS = [
  'ex_jumping_jacks',
  'ex_arm_circles',
  'ex_leg_swings',
  'ex_hip_circles',
  'ex_worlds_greatest_stretch',
];

const WARMUP_MAP: Record<string, string[]> = {
  chest: UPPER_BODY_WARMUPS,
  back: UPPER_BODY_WARMUPS,
  shoulders: UPPER_BODY_WARMUPS,
  arms: UPPER_BODY_WARMUPS,
  legs: LOWER_BODY_WARMUPS,
  core: FULL_BODY_WARMUPS,
  cardio: FULL_BODY_WARMUPS,
  full_body: FULL_BODY_WARMUPS,
};

// ── Cooldown Mapping ────────────────────────────────────────────────

const UPPER_BODY_COOLDOWNS = [
  'ex_shoulder_stretch',
  'ex_childs_pose',
  'ex_deep_breathing',
];

const LOWER_BODY_COOLDOWNS = [
  'ex_standing_quad_stretch',
  'ex_hamstring_stretch',
  'ex_pigeon_pose',
  'ex_deep_breathing',
];

const FULL_BODY_COOLDOWNS = [
  'ex_childs_pose',
  'ex_hamstring_stretch',
  'ex_shoulder_stretch',
  'ex_deep_breathing',
];

const COOLDOWN_MAP: Record<string, string[]> = {
  chest: UPPER_BODY_COOLDOWNS,
  back: UPPER_BODY_COOLDOWNS,
  shoulders: UPPER_BODY_COOLDOWNS,
  arms: UPPER_BODY_COOLDOWNS,
  legs: LOWER_BODY_COOLDOWNS,
  core: FULL_BODY_COOLDOWNS,
  cardio: FULL_BODY_COOLDOWNS,
  full_body: FULL_BODY_COOLDOWNS,
};

/**
 * Determine the dominant focus area(s) of a workout by counting
 * the exercise categories present.
 */
export function getWorkoutFocus(
  exercises: ActiveExercise[],
  library: ExerciseLibraryEntry[],
): MuscleGroup {
  const counts: Record<string, number> = {};
  for (const ae of exercises) {
    if (ae.isSkipped) continue;
    const lib = library.find((e) => e.id === ae.exerciseId);
    if (!lib || lib.category === 'warmup' || lib.category === 'cooldown') continue;
    counts[lib.category] = (counts[lib.category] || 0) + 1;
  }

  // Find the most common category
  let max = 0;
  let dominant: MuscleGroup = 'full_body';
  for (const [cat, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      dominant = cat as MuscleGroup;
    }
  }

  // If it's a mixed workout (no single category > 50%), call it full_body
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0 && max / total <= 0.5) {
    dominant = 'full_body';
  }

  return dominant;
}

/**
 * Get contextual warmup exercise IDs based on the workout's focus.
 */
export function getWarmupExerciseIds(focus: MuscleGroup): string[] {
  return WARMUP_MAP[focus] ?? FULL_BODY_WARMUPS;
}

/**
 * Get contextual cooldown exercise IDs based on the workout's focus.
 */
export function getCooldownExerciseIds(focus: MuscleGroup): string[] {
  return COOLDOWN_MAP[focus] ?? FULL_BODY_COOLDOWNS;
}

/**
 * Check whether the workout already has warmup exercises.
 */
export function hasWarmupExercises(
  exercises: ActiveExercise[],
  library: ExerciseLibraryEntry[],
): boolean {
  return exercises.some((ae) => {
    const lib = library.find((e) => e.id === ae.exerciseId);
    return lib?.category === 'warmup';
  });
}

/**
 * Get a human-readable warmup description based on the focus.
 */
export function getWarmupDescription(focus: MuscleGroup): string {
  switch (focus) {
    case 'chest':
    case 'shoulders':
    case 'arms':
      return 'Upper body warm-up: arm circles, shoulder mobility, and light movement to prep your joints.';
    case 'back':
      return 'Upper body warm-up: arm circles, cat-cow, and thoracic mobility to prep your back.';
    case 'legs':
      return 'Lower body warm-up: leg swings, hip circles, and dynamic stretches to prep your legs.';
    default:
      return 'Full body warm-up: jumping jacks, dynamic stretches, and mobility work to get the blood flowing.';
  }
}

/**
 * Get a human-readable cooldown description based on the focus.
 */
export function getCooldownDescription(focus: MuscleGroup): string {
  switch (focus) {
    case 'chest':
    case 'shoulders':
    case 'arms':
    case 'back':
      return 'Cool-down: shoulder stretches, child\'s pose, and deep breathing to wind down.';
    case 'legs':
      return 'Cool-down: quad stretches, hamstring stretches, and hip openers to aid recovery.';
    default:
      return 'Cool-down: full body stretches and deep breathing to help your muscles recover.';
  }
}
