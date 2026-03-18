-- =============================================================================
-- 00002_user_health_preferences.sql
-- Add structured health goals and preferences to user profiles.
-- Stored as JSONB for flexibility — consumed by coach, recipes, grocery, workouts.
-- =============================================================================

-- Add a preferences JSONB column to profiles for structured goal/constraint data.
-- This column stores the HealthGoalsAndPreferences shape:
-- {
--   "health_goals": ["lose_weight", "gain_muscle", ...],
--   "health_goal_description": "free text",
--   "allergies": ["Peanuts", "Dairy", ...],
--   "dietary_preferences": ["vegetarian", "gluten_free", ...],
--   "cooking_skill_level": "beginner" | "intermediate" | "advanced",
--   "cooking_equipment": ["microwave", "oven", ...],
--   "preferred_workout_days": ["monday", "wednesday", "friday"],
--   "fitness_equipment": ["Full Gym", "Dumbbells Only", ...]
-- }

alter table profiles
  add column if not exists preferences jsonb not null default '{}';

comment on column profiles.preferences is
  'Structured health goals, allergies, dietary/cooking preferences, and fitness constraints. Consumed by AI coach, recipe suggestions, grocery lists, and workout programming.';

-- Index for querying users by specific allergy (for admin/analytics)
create index if not exists idx_profiles_preferences_gin
  on profiles using gin (preferences);
