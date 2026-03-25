/**
 * Onboarding v2 — AI-Native Onboarding Types & Constants
 *
 * These types mirror the Supabase enums in 00008_onboarding_v2.sql
 * and define the detailed equipment model for the onboarding flow.
 */

import type { Gender, UnitPreference, Weekday } from '@health-coach/shared';
import type { Equipment } from './workout';

// ── Onboarding Enums ────────────────────────────────────────────────

export type FitnessGoal =
  | 'build_muscle'
  | 'lose_fat'
  | 'get_stronger'
  | 'stay_active'
  | 'athletic_performance';

export type ExperienceLevel =
  | 'beginner'
  | 'less_than_1_year'
  | '1_to_2_years'
  | '2_to_4_years'
  | '4_plus_years';

export type ConsistencyLevel =
  | 'never_consistent'
  | 'returning_from_break'
  | 'struggle_with_it'
  | 'very_consistent';

export type GymType =
  | 'large_gym'
  | 'small_gym'
  | 'garage_gym'
  | 'at_home'
  | 'no_equipment';

export type SessionDuration = '30_min' | '45_min' | '60_min' | '75_plus_min';

export type InjuryArea =
  | 'shoulders'
  | 'lower_back'
  | 'knees'
  | 'wrists'
  | 'neck'
  | 'hips'
  | 'elbows'
  | 'ankles';

export type AttributionSource =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'reddit'
  | 'friend'
  | 'app_store'
  | 'other';

export type ScheduleMode = 'days_per_week' | 'specific_days';

// ── Detailed Equipment Model ────────────────────────────────────────

export type EquipmentCategory =
  | 'small_weights'
  | 'bars_and_plates'
  | 'benches_and_racks'
  | 'cable_machines'
  | 'machines'
  | 'cardio'
  | 'other';

export interface WeightOptions {
  label: string;           // e.g., "Dumbbell Pairs", "Plate Weights"
  unit: string;            // "lb" or "kg"
  values: number[];        // available weight values
  defaultSelected: number[]; // which ones to pre-select
}

export interface DetailedEquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  /** Maps to the exercise-level Equipment type for filtering */
  mapsTo: Equipment;
  icon?: string;
  /** If set, this equipment supports weight/size selection */
  weightOptions?: WeightOptions;
}

// ── Onboarding Screen Steps ─────────────────────────────────────────

export type OnboardingStep =
  | 'health-sync'
  | 'goals'
  | 'schedule'
  | 'gym-type'
  | 'gym-search'
  | 'equipment'
  | 'notifications'
  | 'attribution'
  | 'generating';

/** Ordered steps (gym-search is conditional) */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  'health-sync',
  'goals',
  'schedule',
  'gym-type',
  'gym-search',  // conditional — only for large_gym
  'equipment',
  'notifications',
  'attribution',
  'generating',
];

/** Steps that count toward progress (excludes generating screen) */
export const PROGRESS_STEPS: OnboardingStep[] = [
  'health-sync',
  'goals',
  'schedule',
  'gym-type',
  'equipment',
  'notifications',
  'attribution',
];

// ── Display Constants ───────────────────────────────────────────────

export const FITNESS_GOAL_OPTIONS: {
  value: FitnessGoal;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: 'build_muscle', label: 'Build Muscle', description: 'Build size and strength through hypertrophy training', icon: 'barbell-outline' },
  { value: 'lose_fat', label: 'Lose Fat', description: 'Burn fat while preserving muscle mass', icon: 'flame-outline' },
  { value: 'get_stronger', label: 'Get Stronger', description: 'Focus on increasing strength and power', icon: 'fitness-outline' },
  { value: 'stay_active', label: 'Stay Active', description: 'Maintain fitness and overall health', icon: 'heart-outline' },
  { value: 'athletic_performance', label: 'Athletic Performance', description: 'Train for speed, agility, and sport performance', icon: 'trophy-outline' },
];

export const EXPERIENCE_LEVEL_OPTIONS: {
  value: ExperienceLevel;
  label: string;
}[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'less_than_1_year', label: '< 1 Year' },
  { value: '1_to_2_years', label: '1–2 Years' },
  { value: '2_to_4_years', label: '2–4 Years' },
  { value: '4_plus_years', label: '4+ Years' },
];

export const CONSISTENCY_LEVEL_OPTIONS: {
  value: ConsistencyLevel;
  label: string;
}[] = [
  { value: 'never_consistent', label: 'Never been consistent' },
  { value: 'returning_from_break', label: 'Returning from a break' },
  { value: 'struggle_with_it', label: 'I struggle with it' },
  { value: 'very_consistent', label: 'Very consistent' },
];

export const GYM_TYPE_OPTIONS: {
  value: GymType;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: 'large_gym', label: 'Large Gym', description: 'Anytime, Planet Fitness, Equinox, etc.', icon: 'business-outline' },
  { value: 'small_gym', label: 'Small Gym', description: 'Compact public gyms', icon: 'storefront-outline' },
  { value: 'garage_gym', label: 'Garage Gym', description: 'Barbells, rack, dumbbells', icon: 'home-outline' },
  { value: 'at_home', label: 'At Home', description: 'Bands, dumbbells, limited equipment', icon: 'bed-outline' },
  { value: 'no_equipment', label: 'No Equipment', description: 'Bodyweight only', icon: 'body-outline' },
];

export const SESSION_DURATION_OPTIONS: {
  value: SessionDuration;
  label: string;
}[] = [
  { value: '30_min', label: '30 min' },
  { value: '45_min', label: '45 min' },
  { value: '60_min', label: '60 min' },
  { value: '75_plus_min', label: '75+ min' },
];

export const INJURY_AREA_OPTIONS: {
  value: InjuryArea;
  label: string;
  icon: string;
}[] = [
  { value: 'shoulders', label: 'Shoulders', icon: 'body-outline' },
  { value: 'lower_back', label: 'Lower Back', icon: 'body-outline' },
  { value: 'knees', label: 'Knees', icon: 'body-outline' },
  { value: 'wrists', label: 'Wrists', icon: 'hand-left-outline' },
  { value: 'neck', label: 'Neck', icon: 'body-outline' },
  { value: 'hips', label: 'Hips', icon: 'body-outline' },
  { value: 'elbows', label: 'Elbows', icon: 'body-outline' },
  { value: 'ankles', label: 'Ankles', icon: 'footsteps-outline' },
];

export const ATTRIBUTION_OPTIONS: {
  value: AttributionSource;
  label: string;
}[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'friend', label: 'Friend or Family' },
  { value: 'app_store', label: 'App Store' },
  { value: 'other', label: 'Other' },
];

export const DAY_PILLS: { value: Weekday; label: string; short: string }[] = [
  { value: 'monday', label: 'Monday', short: 'M' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tu' },
  { value: 'wednesday', label: 'Wednesday', short: 'W' },
  { value: 'thursday', label: 'Thursday', short: 'Th' },
  { value: 'friday', label: 'Friday', short: 'F' },
  { value: 'saturday', label: 'Saturday', short: 'Sa' },
  { value: 'sunday', label: 'Sunday', short: 'Su' },
];

// ── Detailed Equipment List ─────────────────────────────────────────

export const EQUIPMENT_CATALOG: DetailedEquipmentItem[] = [
  // Small Weights
  {
    id: 'dumbbells', name: 'Dumbbells', category: 'small_weights', mapsTo: 'dumbbell',
    weightOptions: {
      label: 'Dumbbell Pairs',
      unit: 'lb',
      values: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
      defaultSelected: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    },
  },
  {
    id: 'kettlebells', name: 'Kettlebells', category: 'small_weights', mapsTo: 'kettlebell',
    weightOptions: {
      label: 'Kettlebell Weights',
      unit: 'lb',
      values: [10, 15, 20, 25, 30, 35, 40, 45, 50, 53, 62, 70, 80, 97, 106],
      defaultSelected: [15, 20, 25, 30, 35, 40],
    },
  },
  { id: 'medicine_ball', name: 'Medicine Ball', category: 'small_weights', mapsTo: 'dumbbell' },
  { id: 'resistance_bands', name: 'Resistance Bands', category: 'small_weights', mapsTo: 'band' },
  { id: 'ankle_weights', name: 'Ankle Weights', category: 'small_weights', mapsTo: 'band' },

  // Bars & Plates
  {
    id: 'barbell', name: 'Barbell', category: 'bars_and_plates', mapsTo: 'barbell',
    weightOptions: {
      label: 'Barbell',
      unit: 'lb',
      values: [45],
      defaultSelected: [45],
    },
  },
  { id: 'ez_bar', name: 'EZ Curl Bar', category: 'bars_and_plates', mapsTo: 'barbell' },
  { id: 'trap_bar', name: 'Trap / Hex Bar', category: 'bars_and_plates', mapsTo: 'barbell' },
  {
    id: 'weight_plates', name: 'Weight Plates', category: 'bars_and_plates', mapsTo: 'barbell',
    weightOptions: {
      label: 'Plate Pairs',
      unit: 'lb',
      values: [2.5, 5, 10, 25, 35, 45],
      defaultSelected: [2.5, 5, 10, 25, 35, 45],
    },
  },
  { id: 'smith_machine', name: 'Smith Machine', category: 'bars_and_plates', mapsTo: 'machine' },

  // Benches & Racks
  { id: 'flat_bench', name: 'Flat Bench', category: 'benches_and_racks', mapsTo: 'barbell' },
  { id: 'incline_bench', name: 'Incline Bench', category: 'benches_and_racks', mapsTo: 'barbell' },
  { id: 'decline_bench', name: 'Decline Bench', category: 'benches_and_racks', mapsTo: 'barbell' },
  { id: 'squat_rack', name: 'Squat Rack / Power Rack', category: 'benches_and_racks', mapsTo: 'barbell' },
  { id: 'pull_up_bar', name: 'Pull-Up Bar', category: 'benches_and_racks', mapsTo: 'bodyweight' },
  { id: 'dip_station', name: 'Dip Station', category: 'benches_and_racks', mapsTo: 'bodyweight' },
  { id: 'preacher_curl_bench', name: 'Preacher Curl Bench', category: 'benches_and_racks', mapsTo: 'barbell' },

  // Cable Machines
  { id: 'cable_crossover', name: 'Cable Crossover', category: 'cable_machines', mapsTo: 'cable' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', category: 'cable_machines', mapsTo: 'cable' },
  { id: 'seated_cable_row', name: 'Seated Cable Row', category: 'cable_machines', mapsTo: 'cable' },
  { id: 'cable_tower', name: 'Cable Tower (Single)', category: 'cable_machines', mapsTo: 'cable' },

  // Machines
  { id: 'leg_press', name: 'Leg Press', category: 'machines', mapsTo: 'machine' },
  { id: 'leg_extension', name: 'Leg Extension', category: 'machines', mapsTo: 'machine' },
  { id: 'leg_curl', name: 'Leg Curl', category: 'machines', mapsTo: 'machine' },
  { id: 'hack_squat', name: 'Hack Squat', category: 'machines', mapsTo: 'machine' },
  { id: 'chest_press_machine', name: 'Chest Press Machine', category: 'machines', mapsTo: 'machine' },
  { id: 'shoulder_press_machine', name: 'Shoulder Press Machine', category: 'machines', mapsTo: 'machine' },
  { id: 'pec_deck', name: 'Pec Deck / Fly Machine', category: 'machines', mapsTo: 'machine' },
  { id: 'calf_raise_machine', name: 'Calf Raise Machine', category: 'machines', mapsTo: 'machine' },
  { id: 'assisted_dip_chinup', name: 'Assisted Dip / Chin-Up', category: 'machines', mapsTo: 'machine' },
  { id: 'ab_crunch_machine', name: 'Ab Crunch Machine', category: 'machines', mapsTo: 'machine' },

  // Cardio
  { id: 'treadmill', name: 'Treadmill', category: 'cardio', mapsTo: 'bodyweight' },
  { id: 'stationary_bike', name: 'Stationary Bike', category: 'cardio', mapsTo: 'bodyweight' },
  { id: 'rowing_machine', name: 'Rowing Machine', category: 'cardio', mapsTo: 'bodyweight' },
  { id: 'stair_climber', name: 'Stair Climber', category: 'cardio', mapsTo: 'bodyweight' },
  { id: 'elliptical', name: 'Elliptical', category: 'cardio', mapsTo: 'bodyweight' },

  // Other
  { id: 'trx_suspension', name: 'TRX / Suspension Trainer', category: 'other', mapsTo: 'band' },
  { id: 'foam_roller', name: 'Foam Roller', category: 'other', mapsTo: 'bodyweight' },
  { id: 'ab_wheel', name: 'Ab Wheel', category: 'other', mapsTo: 'bodyweight' },
  { id: 'battle_ropes', name: 'Battle Ropes', category: 'other', mapsTo: 'bodyweight' },
  { id: 'plyo_box', name: 'Plyo Box', category: 'other', mapsTo: 'bodyweight' },
  { id: 'landmine', name: 'Landmine Attachment', category: 'other', mapsTo: 'barbell' },
];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  small_weights: 'Small Weights',
  bars_and_plates: 'Bars & Plates',
  benches_and_racks: 'Benches & Racks',
  cable_machines: 'Cable Machines',
  machines: 'Machines',
  cardio: 'Cardio',
  other: 'Other',
};

// ── Equipment Presets by Gym Type ────────────────────────────────────

/** Returns the IDs of equipment that should be pre-checked for a given gym type */
export function getEquipmentPreset(gymType: GymType): string[] {
  switch (gymType) {
    case 'large_gym':
      // Everything available
      return EQUIPMENT_CATALOG.map((e) => e.id);

    case 'small_gym':
      // Most things except specialized machines
      return EQUIPMENT_CATALOG
        .filter((e) => !['hack_squat', 'assisted_dip_chinup', 'ab_crunch_machine', 'battle_ropes', 'landmine', 'trap_bar', 'preacher_curl_bench'].includes(e.id))
        .map((e) => e.id);

    case 'garage_gym':
      return [
        'dumbbells', 'kettlebells', 'resistance_bands',
        'barbell', 'ez_bar', 'weight_plates',
        'flat_bench', 'incline_bench', 'squat_rack', 'pull_up_bar', 'dip_station',
        'foam_roller', 'ab_wheel', 'plyo_box',
      ];

    case 'at_home':
      return [
        'dumbbells', 'resistance_bands', 'kettlebells',
        'pull_up_bar',
        'foam_roller', 'ab_wheel',
      ];

    case 'no_equipment':
      return [];

    default:
      return EQUIPMENT_CATALOG.map((e) => e.id);
  }
}

/** Map detailed equipment selection to the exercise-level Equipment types for filtering */
export function mapEquipmentToExerciseTypes(selectedIds: string[]): Equipment[] {
  const types = new Set<Equipment>();
  // Always include bodyweight
  types.add('bodyweight');

  for (const id of selectedIds) {
    const item = EQUIPMENT_CATALOG.find((e) => e.id === id);
    if (item) {
      types.add(item.mapsTo);
    }
  }

  return Array.from(types);
}

// ── Smart Defaults (for skipped steps) ──────────────────────────────

export const ONBOARDING_DEFAULTS = {
  fitnessGoal: 'build_muscle' as FitnessGoal,
  experienceLevel: '1_to_2_years' as ExperienceLevel,
  consistencyLevel: 'struggle_with_it' as ConsistencyLevel,
  gymType: 'large_gym' as GymType,
  trainingDaysPerWeek: 3,
  sessionDuration: '60_min' as SessionDuration,
  injuries: [] as InjuryArea[],
  notificationTime: '09:00',
  notificationsEnabled: false,
} as const;

// ── Goal-to-Program Mapping ─────────────────────────────────────────

export interface ProgramRecommendation {
  name: string;
  description: string;
  style: string;
  daysPerWeek: number;
  estimatedMinutes: number;
  repRangeNote: string;
}

/** Generate a program recommendation based on onboarding data */
export function getRecommendedProgram(
  goal: FitnessGoal,
  experience: ExperienceLevel,
  daysPerWeek: number,
): ProgramRecommendation {
  const isAdvanced = experience === '2_to_4_years' || experience === '4_plus_years';
  const isBeginnerish = experience === 'beginner' || experience === 'less_than_1_year';

  if (daysPerWeek <= 2) {
    return {
      name: 'Full Body Foundation',
      description: 'Hit every muscle group each session for maximum efficiency.',
      style: 'Full Body',
      daysPerWeek,
      estimatedMinutes: 50,
      repRangeNote: goal === 'get_stronger' ? '3-6 reps, heavy compound lifts' : '8-12 reps, balanced volume',
    };
  }

  if (daysPerWeek === 3) {
    if (goal === 'get_stronger') {
      return {
        name: isAdvanced ? 'Strength & Power 3-Day' : 'Starting Strength',
        description: isAdvanced
          ? 'Periodized strength program with compound focus.'
          : 'Learn the big lifts with progressive overload.',
        style: 'Full Body / Strength',
        daysPerWeek: 3,
        estimatedMinutes: isAdvanced ? 65 : 50,
        repRangeNote: '3-6 reps, compound-focused',
      };
    }
    return {
      name: isBeginnerish ? 'Full Body Starter' : 'Push / Pull / Legs',
      description: isBeginnerish
        ? 'Three balanced sessions per week to build your foundation.'
        : 'One push day, one pull day, one leg day — efficient and proven.',
      style: isBeginnerish ? 'Full Body' : 'Push / Pull / Legs',
      daysPerWeek: 3,
      estimatedMinutes: 55,
      repRangeNote: goal === 'lose_fat' ? '10-15 reps with shorter rest' : '8-12 reps for hypertrophy',
    };
  }

  if (daysPerWeek === 4) {
    if (goal === 'get_stronger') {
      return {
        name: 'Upper / Lower Strength',
        description: 'Four-day split balancing heavy compounds and accessory work.',
        style: 'Upper / Lower',
        daysPerWeek: 4,
        estimatedMinutes: 60,
        repRangeNote: '3-6 reps on compounds, 8-12 on accessories',
      };
    }
    return {
      name: isAdvanced ? 'Upper / Lower Hypertrophy' : 'Upper / Lower Split',
      description: 'Two upper days, two lower days. Great balance of volume and recovery.',
      style: 'Upper / Lower',
      daysPerWeek: 4,
      estimatedMinutes: 55,
      repRangeNote: goal === 'lose_fat' ? '10-15 reps, circuit-style finishers' : '8-12 reps, progressive overload',
    };
  }

  if (daysPerWeek === 5) {
    return {
      name: isAdvanced ? '5-Day Hypertrophy Split' : 'Push / Pull / Legs + Upper / Lower',
      description: isAdvanced
        ? 'High-volume split for experienced lifters.'
        : 'Five days of focused training with dedicated muscle group sessions.',
      style: isAdvanced ? 'Bro Split' : 'PPL + UL Hybrid',
      daysPerWeek: 5,
      estimatedMinutes: 60,
      repRangeNote: goal === 'get_stronger' ? '4-8 reps, periodized intensity' : '8-15 reps, volume-focused',
    };
  }

  // 6 days
  return {
    name: 'Push / Pull / Legs x2',
    description: 'Six-day PPL rotation — each muscle group trained twice per week.',
    style: 'Push / Pull / Legs',
    daysPerWeek: 6,
    estimatedMinutes: 55,
    repRangeNote: goal === 'get_stronger' ? 'Heavy/light periodization' : '8-12 reps with progressive overload',
  };
}

// ── Onboarding State Shape ──────────────────────────────────────────

export interface OnboardingData {
  // Screen 2: Health Sync
  healthSyncEnabled: boolean;
  gender: Gender | null;
  dateOfBirth: string;
  heightCm: number | null;
  weightKg: number | null;
  unitPreference: UnitPreference;

  // Screen 3: Goal + Experience + Injuries
  fitnessGoal: FitnessGoal | null;
  experienceLevel: ExperienceLevel | null;
  injuries: InjuryArea[];

  // Screen 4: Schedule + Consistency + Duration
  scheduleMode: ScheduleMode;
  trainingDaysPerWeek: number | null;
  specificTrainingDays: Weekday[];
  consistencyLevel: ConsistencyLevel | null;
  sessionDuration: SessionDuration | null;

  // Screen 5: Gym Type
  gymType: GymType | null;

  // Screen 6: Gym Search
  gymName: string;

  // Screen 7: Equipment
  selectedEquipment: string[];
  /** Per-equipment selected weights: equipmentId -> selected weight values */
  equipmentWeights: Record<string, number[]>;

  // Screen 8: Notifications
  notificationsEnabled: boolean;
  notificationTime: string;

  // Screen 9: Attribution
  attributionSource: AttributionSource | null;
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  healthSyncEnabled: false,
  gender: null,
  dateOfBirth: '',
  heightCm: null,
  weightKg: null,
  unitPreference: 'imperial',

  fitnessGoal: null,
  experienceLevel: null,
  injuries: [],

  scheduleMode: 'days_per_week',
  trainingDaysPerWeek: null,
  specificTrainingDays: [],
  consistencyLevel: null,
  sessionDuration: null,

  gymType: null,
  gymName: '',

  selectedEquipment: [],
  equipmentWeights: {},

  notificationsEnabled: false,
  notificationTime: '09:00',

  attributionSource: null,
};
