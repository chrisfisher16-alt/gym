-- =============================================================================
-- seed.sql
-- Seed data for AI Health Coach App
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Admin roles
-- ---------------------------------------------------------------------------
insert into admin_roles (id, name, permissions) values
  ('a0000000-0000-0000-0000-000000000001', 'founder', '["*"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000002', 'support', '["users.read","users.update","support_notes.create","support_notes.read","audit_logs.read"]'::jsonb);

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
insert into feature_flags (key, description, is_enabled, rollout_percentage, target_tiers) values
  ('ai_coach_enabled',         'Enable AI coach chat feature',         true,  100, '{free,workout_coach,nutrition_coach,full_health_coach}'),
  ('nutrition_module_enabled',  'Enable nutrition tracking module',     true,  100, '{nutrition_coach,full_health_coach}'),
  ('health_sync_enabled',      'Enable Apple Health / Google Fit sync', false, 0,   '{full_health_coach}'),
  ('photo_meal_logging',       'Enable photo-based meal logging',      true,  50,  '{nutrition_coach,full_health_coach}'),
  ('workout_ai_generation',    'Enable AI workout program generation', true,  100, '{workout_coach,full_health_coach}');

-- ---------------------------------------------------------------------------
-- Pricing config
-- ---------------------------------------------------------------------------
insert into pricing_config (plan_key, display_name, description, price_monthly_usd, price_yearly_usd, product_id_ios, product_id_android, features, is_active, sort_order) values
  (
    'workout_coach',
    'Workout Coach',
    'AI-powered workout programming, exercise tracking, and progress analytics.',
    9.99,
    79.99,
    'com.healthcoach.workout.monthly',
    'com.healthcoach.workout.monthly',
    '{
      "workout_logs_per_day": "unlimited",
      "ai_messages_per_day": 50,
      "meal_logs_per_day": 3,
      "custom_exercises": true,
      "workout_ai_generation": true,
      "progress_photos": false,
      "health_sync": false
    }'::jsonb,
    true,
    1
  ),
  (
    'nutrition_coach',
    'Nutrition Coach',
    'AI-powered meal tracking, macro coaching, photo meal logging, and supplement management.',
    9.99,
    79.99,
    'com.healthcoach.nutrition.monthly',
    'com.healthcoach.nutrition.monthly',
    '{
      "workout_logs_per_day": 3,
      "ai_messages_per_day": 50,
      "meal_logs_per_day": "unlimited",
      "custom_exercises": false,
      "workout_ai_generation": false,
      "photo_meal_logging": true,
      "saved_meals": true,
      "supplement_tracking": true,
      "health_sync": false
    }'::jsonb,
    true,
    2
  ),
  (
    'full_health_coach',
    'Full Health Coach',
    'Complete AI health coaching: workouts, nutrition, supplements, health sync, and unlimited AI guidance.',
    19.99,
    149.99,
    'com.healthcoach.full.monthly',
    'com.healthcoach.full.monthly',
    '{
      "workout_logs_per_day": "unlimited",
      "ai_messages_per_day": "unlimited",
      "meal_logs_per_day": "unlimited",
      "custom_exercises": true,
      "workout_ai_generation": true,
      "photo_meal_logging": true,
      "saved_meals": true,
      "supplement_tracking": true,
      "progress_photos": true,
      "health_sync": true,
      "priority_support": true
    }'::jsonb,
    true,
    3
  );

-- ---------------------------------------------------------------------------
-- Exercise library
-- ---------------------------------------------------------------------------
insert into exercises (name, category, primary_muscles, secondary_muscles, equipment, instructions, is_custom) values
  -- Chest
  ('Barbell Bench Press',       'chest',     '{chest}',                    '{triceps,front_delts}',      'barbell',    'Lie on bench, lower bar to chest, press up to lockout.', false),
  ('Dumbbell Incline Press',    'chest',     '{upper_chest}',             '{triceps,front_delts}',      'dumbbells',  'Set bench to 30-45 degrees, press dumbbells from chest to lockout.', false),
  ('Cable Chest Fly',           'chest',     '{chest}',                    '{front_delts}',              'cable',      'Stand between cables, bring handles together in an arc at chest height.', false),

  -- Back
  ('Barbell Deadlift',          'back',      '{lower_back,glutes,hamstrings}', '{traps,forearms}',       'barbell',    'Hinge at hips, grip bar, drive through heels to stand.', false),
  ('Pull-Up',                   'back',      '{lats}',                    '{biceps,rear_delts}',        'pull_up_bar','Hang from bar, pull chin above bar, lower with control.', false),
  ('Seated Cable Row',          'back',      '{mid_back,lats}',           '{biceps,rear_delts}',        'cable',      'Sit at cable row, pull handle to lower chest, squeeze back.', false),

  -- Shoulders
  ('Overhead Press',            'shoulders', '{front_delts,side_delts}',  '{triceps,traps}',            'barbell',    'Press barbell from shoulder height to overhead lockout.', false),
  ('Lateral Raise',             'shoulders', '{side_delts}',              '{traps}',                    'dumbbells',  'Raise dumbbells out to sides until arms parallel to floor.', false),

  -- Legs
  ('Barbell Back Squat',        'legs',      '{quads,glutes}',            '{hamstrings,core}',          'barbell',    'Bar on upper back, squat to parallel or below, stand up.', false),
  ('Romanian Deadlift',         'legs',      '{hamstrings,glutes}',       '{lower_back}',               'barbell',    'Hinge at hips with slight knee bend, lower bar along legs.', false),
  ('Leg Press',                 'legs',      '{quads,glutes}',            '{hamstrings}',               'machine',    'Sit in leg press, lower platform to 90 degrees, press up.', false),
  ('Walking Lunges',            'legs',      '{quads,glutes}',            '{hamstrings,core}',          'dumbbells',  'Step forward into lunge, alternate legs while walking.', false),

  -- Arms
  ('Barbell Curl',              'arms',      '{biceps}',                  '{forearms}',                 'barbell',    'Curl bar from thighs to shoulders, keeping elbows stationary.', false),
  ('Tricep Dips',               'arms',      '{triceps}',                 '{chest,front_delts}',        'dip_bars',   'Lower body by bending elbows, press back up to lockout.', false),
  ('Hammer Curl',               'arms',      '{biceps,brachialis}',       '{forearms}',                 'dumbbells',  'Curl dumbbells with neutral grip, keeping elbows stationary.', false),

  -- Core
  ('Hanging Leg Raise',         'core',      '{lower_abs,hip_flexors}',   '{obliques}',                 'pull_up_bar','Hang from bar, raise legs to parallel or above.', false),
  ('Cable Woodchop',            'core',      '{obliques}',                '{core,shoulders}',           'cable',      'Rotate torso pulling cable from high to low across body.', false),
  ('Plank',                     'core',      '{core,transverse_abdominis}', '{shoulders,glutes}',       'bodyweight', 'Hold push-up position with forearms on ground, body straight.', false);

-- ---------------------------------------------------------------------------
-- Supplement catalog
-- ---------------------------------------------------------------------------
insert into supplement_catalog (name, category, description, default_dose, dose_unit) values
  ('Creatine Monohydrate', 'performance', 'Supports strength, power output, and muscle hydration.',           5,    'g'),
  ('Whey Protein',         'protein',     'Fast-digesting protein for post-workout recovery.',                25,   'g'),
  ('Vitamin D3',           'vitamin',     'Supports bone health, immune function, and mood.',                 2000, 'IU'),
  ('Omega-3 Fish Oil',     'fatty_acid',  'Supports heart health, joint function, and inflammation control.', 1000, 'mg'),
  ('Magnesium Glycinate',  'mineral',     'Supports sleep quality, muscle recovery, and stress management.',  400,  'mg'),
  ('Caffeine',             'performance', 'Enhances focus, energy, and exercise performance.',                200,  'mg');
