import { z } from 'zod';

// ── Shared primitives ────────────────────────────────────────────────

const goalTypeSchema = z.enum(['lose_fat', 'build_muscle', 'maintain', 'recomp', 'strength', 'endurance']);
const genderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const unitPreferenceSchema = z.enum(['metric', 'imperial']);
const productModeSchema = z.enum(['workout_coach', 'nutrition_coach', 'full_health_coach']);
const coachToneSchema = z.enum(['direct', 'balanced', 'encouraging']);
const setTypeSchema = z.enum(['warmup', 'working', 'drop', 'failure']);
const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const mealSourceSchema = z.enum(['manual', 'text_parse', 'photo', 'barcode', 'quick_add', 'saved_meal']);

// ── Profile ──────────────────────────────────────────────────────────

export const profileSchema = z.object({
  display_name: z.string().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: genderSchema.optional(),
  height_cm: z.number().min(50).max(300).optional(),
  weight_kg: z.number().min(20).max(500).optional(),
  unit_preference: unitPreferenceSchema.default('imperial'),
  avatar_url: z.string().url().optional(),
  timezone: z.string().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// ── Goals ────────────────────────────────────────────────────────────

export const goalsSchema = z.object({
  goal_type: goalTypeSchema,
  target_weight_kg: z.number().min(20).max(500).optional(),
  target_calories: z.number().min(500).max(10000).optional(),
  activity_level: z.number().int().min(1).max(5),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type GoalsInput = z.infer<typeof goalsSchema>;

// ── Coach Preferences ────────────────────────────────────────────────

export const coachPreferencesSchema = z.object({
  product_mode: productModeSchema,
  coach_tone: coachToneSchema.default('balanced'),
  focus_areas: z.array(z.string()).default([]),
});

export type CoachPreferencesInput = z.infer<typeof coachPreferencesSchema>;

// ── Workout Session & Sets ───────────────────────────────────────────

export const setLogSchema = z.object({
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1),
  set_type: setTypeSchema.default('working'),
  weight_kg: z.number().min(0).optional(),
  reps: z.number().int().min(0).optional(),
  duration_seconds: z.number().int().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  is_pr: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export type SetLogInput = z.infer<typeof setLogSchema>;

export const workoutSessionSchema = z.object({
  program_id: z.string().uuid().optional(),
  day_id: z.string().uuid().optional(),
  sets: z.array(setLogSchema).min(1),
  notes: z.string().max(1000).optional(),
});

export type WorkoutSessionInput = z.infer<typeof workoutSessionSchema>;

// ── Meal Log & Items ─────────────────────────────────────────────────

export const mealItemSchema = z.object({
  name: z.string().min(1).max(200),
  serving_size: z.string().min(1).max(100),
  servings: z.number().min(0.1).max(100),
  calories: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0).default(0),
  barcode: z.string().optional(),
});

export type MealItemInput = z.infer<typeof mealItemSchema>;

export const mealLogSchema = z.object({
  meal_type: mealTypeSchema,
  source: mealSourceSchema.default('manual'),
  items: z.array(mealItemSchema).min(1),
  photo_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

export type MealLogInput = z.infer<typeof mealLogSchema>;

// ── Auth ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ── Onboarding ───────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  name: z.string().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  gender: genderSchema,
  height_cm: z.number().min(50).max(300),
  weight_kg: z.number().min(20).max(500),
  goals: z.object({
    goal_type: goalTypeSchema,
    activity_level: z.number().int().min(1).max(5),
    target_weight_kg: z.number().min(20).max(500).optional(),
  }),
  product_mode: productModeSchema,
  coach_tone: coachToneSchema.default('balanced'),
  unit_preference: unitPreferenceSchema.default('imperial'),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
