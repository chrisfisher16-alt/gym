import type { MuscleGroup, Equipment } from '../types/workout';

// ── Types ───────────────────────────────────────────────────────────

export type MovementType = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'rotation' | 'isometric';

export interface ExerciseIllustration {
  muscleGroups: string[]; // primary muscles highlighted
  equipmentIcon: string; // Ionicons name
  movementType: MovementType;
  emoji: string; // fun emoji for the exercise
}

// ── Category Colors ─────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<MuscleGroup, { bg: string; text: string }> = {
  chest: { bg: '#DBEAFE', text: '#2563EB' }, // blue
  back: { bg: '#D1FAE5', text: '#059669' }, // green
  shoulders: { bg: '#FFEDD5', text: '#EA580C' }, // orange
  legs: { bg: '#EDE9FE', text: '#7C3AED' }, // purple
  arms: { bg: '#FEE2E2', text: '#DC2626' }, // red
  core: { bg: '#FEF9C3', text: '#CA8A04' }, // yellow
  cardio: { bg: '#FCE7F3', text: '#DB2777' }, // pink
  full_body: { bg: '#CCFBF1', text: '#0D9488' }, // teal
  warmup: { bg: '#FFF7ED', text: '#C2410C' }, // warm orange
  cooldown: { bg: '#F0F9FF', text: '#0369A1' }, // cool blue
};

export const CATEGORY_COLORS_DARK: Record<MuscleGroup, { bg: string; text: string }> = {
  chest: { bg: '#1E3A5F', text: '#60A5FA' },
  back: { bg: '#064E3B', text: '#34D399' },
  shoulders: { bg: '#7C2D12', text: '#FB923C' },
  legs: { bg: '#4C1D95', text: '#A78BFA' },
  arms: { bg: '#7F1D1D', text: '#F87171' },
  core: { bg: '#713F12', text: '#FACC15' },
  cardio: { bg: '#831843', text: '#F472B6' },
  full_body: { bg: '#134E4A', text: '#2DD4BF' },
  warmup: { bg: '#7C2D12', text: '#FDBA74' },
  cooldown: { bg: '#0C4A6E', text: '#7DD3FC' },
};

// ── Equipment Icons ─────────────────────────────────────────────────

export const EQUIPMENT_ILLUSTRATION_ICONS: Record<Equipment, string> = {
  barbell: 'barbell-outline',
  dumbbell: 'fitness-outline',
  machine: 'cog-outline',
  cable: 'git-pull-request-outline',
  bodyweight: 'body-outline',
  kettlebell: 'bowling-ball-outline',
  band: 'resize-outline',
};

// ── Muscle Group Indicator Icons ────────────────────────────────────

export const MUSCLE_INDICATOR_COLORS: Record<string, string> = {
  'Pectoralis Major': '#2563EB',
  'Upper Pectoralis Major': '#3B82F6',
  'Anterior Deltoid': '#EA580C',
  'Lateral Deltoid': '#F97316',
  'Posterior Deltoid': '#D97706',
  'Triceps': '#DC2626',
  'Biceps': '#EF4444',
  'Brachialis': '#F87171',
  'Forearms': '#FB923C',
  'Latissimus Dorsi': '#059669',
  'Trapezius': '#10B981',
  'Rhomboids': '#34D399',
  'Erector Spinae': '#6EE7B7',
  'Rear Deltoids': '#D97706',
  'Quadriceps': '#7C3AED',
  'Hamstrings': '#8B5CF6',
  'Glutes': '#A78BFA',
  'Calves': '#C4B5FD',
  'Hip Flexors': '#DDD6FE',
  'Abdominals': '#CA8A04',
  'Obliques': '#EAB308',
  'Core': '#FACC15',
  'Lower Back': '#A3E635',
  'Full Body': '#0D9488',
};

// ── Exercise Illustrations Map ──────────────────────────────────────

export const EXERCISE_ILLUSTRATIONS: Record<string, ExerciseIllustration> = {
  // CHEST
  ex_bench_press: { muscleGroups: ['Pectoralis Major', 'Triceps'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '🏋️' },
  ex_incline_bench: { muscleGroups: ['Upper Pectoralis Major', 'Triceps'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '📐' },
  ex_db_bench_press: { muscleGroups: ['Pectoralis Major', 'Triceps'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '💪' },
  ex_db_flyes: { muscleGroups: ['Pectoralis Major'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '🦅' },
  ex_cable_crossover: { muscleGroups: ['Pectoralis Major'], equipmentIcon: 'git-pull-request-outline', movementType: 'push', emoji: '✖️' },
  ex_push_up: { muscleGroups: ['Pectoralis Major', 'Triceps'], equipmentIcon: 'body-outline', movementType: 'push', emoji: '🫸' },
  ex_chest_dip: { muscleGroups: ['Pectoralis Major', 'Triceps'], equipmentIcon: 'body-outline', movementType: 'push', emoji: '⬇️' },

  // BACK
  ex_barbell_row: { muscleGroups: ['Latissimus Dorsi', 'Rhomboids'], equipmentIcon: 'barbell-outline', movementType: 'pull', emoji: '🚣' },
  ex_deadlift: { muscleGroups: ['Erector Spinae', 'Glutes', 'Hamstrings'], equipmentIcon: 'barbell-outline', movementType: 'hinge', emoji: '🏗️' },
  ex_pull_up: { muscleGroups: ['Latissimus Dorsi', 'Biceps'], equipmentIcon: 'body-outline', movementType: 'pull', emoji: '🧗' },
  ex_lat_pulldown: { muscleGroups: ['Latissimus Dorsi', 'Biceps'], equipmentIcon: 'cog-outline', movementType: 'pull', emoji: '⬇️' },
  ex_seated_cable_row: { muscleGroups: ['Latissimus Dorsi', 'Rhomboids'], equipmentIcon: 'git-pull-request-outline', movementType: 'pull', emoji: '🚣' },
  ex_db_row: { muscleGroups: ['Latissimus Dorsi', 'Rhomboids'], equipmentIcon: 'fitness-outline', movementType: 'pull', emoji: '💪' },
  ex_face_pull: { muscleGroups: ['Rear Deltoids', 'Trapezius'], equipmentIcon: 'git-pull-request-outline', movementType: 'pull', emoji: '🎯' },

  // SHOULDERS
  ex_ohp: { muscleGroups: ['Anterior Deltoid', 'Triceps'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '🏋️' },
  ex_db_shoulder_press: { muscleGroups: ['Anterior Deltoid', 'Triceps'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '⬆️' },
  ex_lateral_raise: { muscleGroups: ['Lateral Deltoid'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '🪽' },
  ex_front_raise: { muscleGroups: ['Anterior Deltoid'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '🙌' },
  ex_reverse_fly: { muscleGroups: ['Posterior Deltoid', 'Rhomboids'], equipmentIcon: 'fitness-outline', movementType: 'pull', emoji: '🦅' },

  // LEGS
  ex_squat: { muscleGroups: ['Quadriceps', 'Glutes'], equipmentIcon: 'barbell-outline', movementType: 'squat', emoji: '🦵' },
  ex_front_squat: { muscleGroups: ['Quadriceps', 'Core'], equipmentIcon: 'barbell-outline', movementType: 'squat', emoji: '🏋️' },
  ex_leg_press: { muscleGroups: ['Quadriceps', 'Glutes'], equipmentIcon: 'cog-outline', movementType: 'squat', emoji: '🦿' },
  ex_romanian_deadlift: { muscleGroups: ['Hamstrings', 'Glutes'], equipmentIcon: 'barbell-outline', movementType: 'hinge', emoji: '🏗️' },
  ex_leg_curl: { muscleGroups: ['Hamstrings'], equipmentIcon: 'cog-outline', movementType: 'pull', emoji: '🦵' },
  ex_leg_extension: { muscleGroups: ['Quadriceps'], equipmentIcon: 'cog-outline', movementType: 'push', emoji: '🦵' },
  ex_lunge: { muscleGroups: ['Quadriceps', 'Glutes'], equipmentIcon: 'fitness-outline', movementType: 'squat', emoji: '🚶' },
  ex_calf_raise: { muscleGroups: ['Calves'], equipmentIcon: 'cog-outline', movementType: 'push', emoji: '🦶' },
  ex_bulgarian_split_squat: { muscleGroups: ['Quadriceps', 'Glutes'], equipmentIcon: 'fitness-outline', movementType: 'squat', emoji: '🇧🇬' },

  // ARMS
  ex_barbell_curl: { muscleGroups: ['Biceps'], equipmentIcon: 'barbell-outline', movementType: 'pull', emoji: '💪' },
  ex_db_curl: { muscleGroups: ['Biceps'], equipmentIcon: 'fitness-outline', movementType: 'pull', emoji: '💪' },
  ex_hammer_curl: { muscleGroups: ['Biceps', 'Brachialis'], equipmentIcon: 'fitness-outline', movementType: 'pull', emoji: '🔨' },
  ex_tricep_pushdown: { muscleGroups: ['Triceps'], equipmentIcon: 'git-pull-request-outline', movementType: 'push', emoji: '⬇️' },
  ex_skull_crusher: { muscleGroups: ['Triceps'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '💀' },
  ex_overhead_tricep_ext: { muscleGroups: ['Triceps'], equipmentIcon: 'fitness-outline', movementType: 'push', emoji: '🙆' },

  // CORE
  ex_plank: { muscleGroups: ['Core', 'Abdominals'], equipmentIcon: 'body-outline', movementType: 'isometric', emoji: '🧘' },
  ex_wall_sit: { muscleGroups: ['Quadriceps', 'Core'], equipmentIcon: 'body-outline', movementType: 'isometric', emoji: '🧱' },
  ex_dead_hang: { muscleGroups: ['Forearms', 'Core'], equipmentIcon: 'body-outline', movementType: 'isometric', emoji: '🙈' },
  ex_hanging_leg_raise: { muscleGroups: ['Abdominals', 'Hip Flexors'], equipmentIcon: 'body-outline', movementType: 'pull', emoji: '🦵' },
  ex_cable_crunch: { muscleGroups: ['Abdominals'], equipmentIcon: 'git-pull-request-outline', movementType: 'pull', emoji: '🧎' },
  ex_russian_twist: { muscleGroups: ['Obliques', 'Core'], equipmentIcon: 'body-outline', movementType: 'rotation', emoji: '🌀' },
  ex_ab_wheel: { muscleGroups: ['Abdominals', 'Core'], equipmentIcon: 'body-outline', movementType: 'push', emoji: '🛞' },

  // CARDIO / FULL BODY
  ex_treadmill_run: { muscleGroups: ['Full Body'], equipmentIcon: 'cog-outline', movementType: 'carry', emoji: '🏃' },
  ex_rowing_machine: { muscleGroups: ['Full Body'], equipmentIcon: 'cog-outline', movementType: 'pull', emoji: '🚣' },
  ex_clean_and_press: { muscleGroups: ['Full Body'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '🏋️' },
  ex_kettlebell_swing: { muscleGroups: ['Glutes', 'Hamstrings', 'Core'], equipmentIcon: 'bowling-ball-outline', movementType: 'hinge', emoji: '🔔' },
  ex_burpee: { muscleGroups: ['Full Body'], equipmentIcon: 'body-outline', movementType: 'push', emoji: '🤸' },
  ex_thruster: { muscleGroups: ['Quadriceps', 'Anterior Deltoid'], equipmentIcon: 'barbell-outline', movementType: 'push', emoji: '🚀' },
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Get illustration data for an exercise. Falls back to a generic illustration
 * based on equipment and category if no specific mapping exists.
 */
export function getExerciseIllustration(
  exerciseId: string,
  category?: MuscleGroup,
  equipment?: Equipment,
  primaryMuscles?: string[],
): ExerciseIllustration {
  const specific = EXERCISE_ILLUSTRATIONS[exerciseId];
  if (specific) return specific;

  // Fallback: derive from exercise properties
  return {
    muscleGroups: primaryMuscles ?? [],
    equipmentIcon: equipment ? EQUIPMENT_ILLUSTRATION_ICONS[equipment] : 'barbell-outline',
    movementType: guessMovementType(category, equipment),
    emoji: '🏋️',
  };
}

function guessMovementType(category?: MuscleGroup, equipment?: Equipment): MovementType {
  if (category === 'core') return 'isometric';
  if (category === 'cardio') return 'carry';
  if (category === 'back') return 'pull';
  if (category === 'chest' || category === 'shoulders') return 'push';
  if (category === 'legs') return 'squat';
  if (category === 'arms') {
    return equipment === 'cable' ? 'push' : 'pull';
  }
  return 'push';
}

/**
 * Get a muscle color for a muscle group name.
 */
export function getMuscleColor(muscleName: string): string {
  return MUSCLE_INDICATOR_COLORS[muscleName] ?? '#9CA3AF';
}
