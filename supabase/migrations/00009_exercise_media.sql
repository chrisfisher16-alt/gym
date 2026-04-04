-- =============================================================================
-- 00009_exercise_media.sql
-- Add media and muscle diagram columns to exercises table
-- =============================================================================

-- Add media URL columns
alter table exercises add column if not exists thumbnail_url text;
alter table exercises add column if not exists hero_image_url text;
alter table exercises add column if not exists video_url text;

-- Add muscle diagram data as JSONB
-- Structure: { "primaryMuscles": [{ "muscle": "...", "opacity": 1.0 }], "secondaryMuscles": [{ "muscle": "...", "opacity": 0.4 }] }
alter table exercises add column if not exists muscle_diagram_data jsonb;

-- Index for exercises that have video content (useful for filtering)
create index if not exists idx_exercises_has_video
  on exercises (id) where video_url is not null;

-- GIN index on muscle_diagram_data for querying by muscle
create index if not exists idx_exercises_muscle_diagram
  on exercises using gin (muscle_diagram_data);

-- Existing RLS policies on exercises already allow:
--   "Anyone can view global exercises" → SELECT where is_custom = false
--   "Users can view own custom exercises" → SELECT where created_by = auth.uid()
-- These cover the new columns automatically since they're row-level policies.
-- No additional RLS changes needed.
