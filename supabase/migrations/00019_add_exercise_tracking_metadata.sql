-- ── Add exercise tracking metadata and expanded set log fields ──────
-- Supports the new tracking mode system: exercises declare what fields
-- the user logs (weight_reps, bodyweight_reps, duration, duration_distance,
-- duration_level, distance_weight, reps_only) along with weight context
-- and secondary metrics.

-- Add tracking metadata to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'weight_reps';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS weight_context text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_metrics jsonb DEFAULT '[]';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS defaults jsonb DEFAULT '{}';

-- Add secondary metric columns to set_logs
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS distance numeric(8,2);
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS distance_unit text CHECK (distance_unit IN ('miles', 'km', 'meters'));
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS incline numeric(4,1);
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS speed numeric(5,1);
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS speed_unit text CHECK (speed_unit IN ('mph', 'kph'));
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS level int;
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS calories int;
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS resistance int;

-- Add check constraints for the new columns
ALTER TABLE set_logs ADD CONSTRAINT set_logs_incline_range CHECK (incline IS NULL OR (incline >= 0 AND incline <= 40));
ALTER TABLE set_logs ADD CONSTRAINT set_logs_speed_range CHECK (speed IS NULL OR (speed >= 0 AND speed <= 50));
ALTER TABLE set_logs ADD CONSTRAINT set_logs_level_range CHECK (level IS NULL OR (level >= 1 AND level <= 25));
ALTER TABLE set_logs ADD CONSTRAINT set_logs_calories_nonneg CHECK (calories IS NULL OR calories >= 0);
ALTER TABLE set_logs ADD CONSTRAINT set_logs_resistance_range CHECK (resistance IS NULL OR (resistance >= 1 AND resistance <= 10));

-- Add check constraint for tracking_mode valid values
ALTER TABLE exercises ADD CONSTRAINT exercises_tracking_mode_valid CHECK (
  tracking_mode IN ('weight_reps', 'bodyweight_reps', 'duration', 'duration_distance', 'duration_level', 'distance_weight', 'reps_only')
);

-- Backfill tracking_mode for existing exercises based on legacy patterns
-- Time-based exercises
UPDATE exercises SET tracking_mode = 'duration'
WHERE tracking_mode = 'weight_reps'
  AND (name ILIKE '%plank%' OR name ILIKE '%hold%' OR name ILIKE '%dead hang%'
    OR name ILIKE '%wall sit%' OR name ILIKE '%l-sit%' OR name ILIKE '%battle rope%');

-- Bodyweight exercises
UPDATE exercises SET tracking_mode = 'bodyweight_reps'
WHERE tracking_mode = 'weight_reps'
  AND muscle_group = 'bodyweight';
