import type { EntitlementTier, ProductMode } from '../types';

// ── Free Tier Limits ─────────────────────────────────────────────────

export const FREE_TIER_LIMITS = {
  workout_logs_per_month: 10,
  meal_logs_per_day: 3,
  ai_messages_per_day: 5,
} as const;

// ── Product Modes ────────────────────────────────────────────────────

export const PRODUCT_MODES: Record<ProductMode, { displayName: string; description: string }> = {
  workout_coach: {
    displayName: 'Workout Coach',
    description: 'AI-powered workout programming, tracking, and coaching',
  },
  nutrition_coach: {
    displayName: 'Nutrition Coach',
    description: 'AI-powered meal tracking, macro coaching, and supplement guidance',
  },
  full_health_coach: {
    displayName: 'Full Health Coach',
    description: 'Complete AI health coaching with workouts, nutrition, and lifestyle guidance',
  },
} as const;

// ── Muscle Groups ────────────────────────────────────────────────────

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
  'traps',
  'lats',
  'lower_back',
  'hip_flexors',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// ── Exercise Categories ──────────────────────────────────────────────

export const EXERCISE_CATEGORIES = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'cardio',
  'stretching',
  'other',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

// ── Meal Types ───────────────────────────────────────────────────────

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

// ── Macro Colors ─────────────────────────────────────────────────────

export const MACRO_COLORS = {
  protein: '#EF4444',  // red
  carbs: '#3B82F6',    // blue
  fat: '#F59E0B',      // amber
  fiber: '#10B981',    // green
} as const;

// ── App Config ───────────────────────────────────────────────────────

export const APP_CONFIG = {
  appName: 'Health Coach',
  supportEmail: 'support@healthcoach.app',
  privacyUrl: 'https://healthcoach.app/privacy',
  termsUrl: 'https://healthcoach.app/terms',
  maxFileUploadMB: 10,
  defaultTimezone: 'America/New_York',
} as const;

// ── Tier Feature Lists ───────────────────────────────────────────────

export const TIER_FEATURES: Record<EntitlementTier, string[]> = {
  free: [
    'Basic workout logging',
    'Basic meal logging',
    'Limited AI coaching',
  ],
  workout_coach: [
    'Unlimited workout logging',
    'AI workout programming',
    'Unlimited AI coaching (workout)',
    'Progress analytics',
    'PR tracking',
  ],
  nutrition_coach: [
    'Unlimited meal logging',
    'Photo meal logging',
    'AI macro coaching',
    'Unlimited AI coaching (nutrition)',
    'Barcode scanning',
    'Saved meals',
  ],
  full_health_coach: [
    'Everything in Workout Coach',
    'Everything in Nutrition Coach',
    'Cross-domain AI coaching',
    'Health integrations',
    'Priority support',
  ],
} as const;
