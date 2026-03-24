-- =============================================================================
-- seed-demo.sql
-- Comprehensive demo seed data for FormIQ Phase 10
-- Creates a full demo user (Chris) with 3 weeks of workout history,
-- nutrition logs, hydration, PRs, body measurements, achievements, and streaks.
--
-- USAGE: Run after the auth user is created. Replace the UUID below with the
-- actual auth.users.id for the demo user.
-- =============================================================================

-- We use a fixed UUID so we can reference it throughout.
-- In production, the handle_new_user trigger creates the profile automatically.
-- For seeding, we insert directly.

do $$
declare
  demo_uid uuid := '00000000-0000-0000-0000-000000000001';
  -- Exercise IDs (looked up dynamically)
  ex_bench uuid;
  ex_incline uuid;
  ex_cable_fly uuid;
  ex_ohp uuid;
  ex_lat_raise uuid;
  ex_squat uuid;
  ex_rdl uuid;
  ex_leg_press uuid;
  ex_deadlift uuid;
  ex_pullup uuid;
  ex_seated_row uuid;
  ex_barbell_curl uuid;
  ex_tricep_dips uuid;
  ex_leg_raise uuid;
  ex_barbell_row uuid;
  ex_lat_pulldown uuid;
  ex_face_pull uuid;
  ex_hip_thrust uuid;
  -- Program and day IDs
  prog_id uuid;
  push_day_id uuid;
  pull_day_id uuid;
  legs_day_id uuid;
  push2_day_id uuid;
  -- Session IDs
  s_id uuid;
  -- Nutrition day log IDs
  ndl_id uuid;
begin

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 0. Look up exercise IDs
  -- ═══════════════════════════════════════════════════════════════════════════
  select id into ex_bench from exercises where name = 'Barbell Bench Press' limit 1;
  select id into ex_incline from exercises where name = 'Dumbbell Incline Press' limit 1;
  select id into ex_cable_fly from exercises where name = 'Cable Chest Fly' limit 1;
  select id into ex_ohp from exercises where name = 'Overhead Press' limit 1;
  select id into ex_lat_raise from exercises where name = 'Lateral Raise' limit 1;
  select id into ex_squat from exercises where name = 'Barbell Back Squat' limit 1;
  select id into ex_rdl from exercises where name = 'Romanian Deadlift' limit 1;
  select id into ex_leg_press from exercises where name = 'Leg Press' limit 1;
  select id into ex_deadlift from exercises where name = 'Barbell Deadlift' limit 1;
  select id into ex_pullup from exercises where name = 'Pull-Up' limit 1;
  select id into ex_seated_row from exercises where name = 'Seated Cable Row' limit 1;
  select id into ex_barbell_curl from exercises where name = 'Barbell Curl' limit 1;
  select id into ex_tricep_dips from exercises where name = 'Tricep Dips' limit 1;
  select id into ex_leg_raise from exercises where name = 'Hanging Leg Raise' limit 1;
  select id into ex_barbell_row from exercises where name = 'Barbell Row' limit 1;
  select id into ex_lat_pulldown from exercises where name = 'Lat Pulldown' limit 1;
  select id into ex_face_pull from exercises where name = 'Face Pull' limit 1;
  select id into ex_hip_thrust from exercises where name = 'Hip Thrust' limit 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1. Profile (update if trigger already created it)
  -- ═══════════════════════════════════════════════════════════════════════════
  update profiles set
    display_name = 'Chris',
    unit_preference = 'metric',
    theme_preference = 'dark',
    rest_timer_default = 120,
    weight_kg = 82.5,
    height_cm = 180.0,
    gender = 'male',
    onboarding_completed = true,
    product_mode = 'full_health_coach'
  where id = demo_uid;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 2. Program: Push Pull Legs (8 weeks, 4 days/week)
  -- ═══════════════════════════════════════════════════════════════════════════
  prog_id := gen_random_uuid();
  insert into workout_programs (id, user_id, name, description, weeks, days_per_week, difficulty, is_active)
  values (prog_id, demo_uid, 'Push Pull Legs', 'Classic PPL split — chest/shoulders/triceps, back/biceps, legs. 4 sessions per week with progressive overload.', 8, 4, 'intermediate', true);

  -- Day 1: Push
  push_day_id := gen_random_uuid();
  insert into workout_days (id, program_id, day_number, name, focus, exercises)
  values (push_day_id, prog_id, 1, 'Push Day', 'Chest, Shoulders, Triceps', jsonb_build_array(
    jsonb_build_object('exerciseId', ex_bench, 'sets', 4, 'reps', 8, 'order', 1),
    jsonb_build_object('exerciseId', ex_incline, 'sets', 3, 'reps', 10, 'order', 2),
    jsonb_build_object('exerciseId', ex_ohp, 'sets', 3, 'reps', 8, 'order', 3),
    jsonb_build_object('exerciseId', ex_lat_raise, 'sets', 3, 'reps', 15, 'order', 4),
    jsonb_build_object('exerciseId', ex_cable_fly, 'sets', 3, 'reps', 12, 'order', 5),
    jsonb_build_object('exerciseId', ex_tricep_dips, 'sets', 3, 'reps', 10, 'order', 6)
  ));

  -- Day 2: Pull
  pull_day_id := gen_random_uuid();
  insert into workout_days (id, program_id, day_number, name, focus, exercises)
  values (pull_day_id, prog_id, 2, 'Pull Day', 'Back, Biceps', jsonb_build_array(
    jsonb_build_object('exerciseId', ex_deadlift, 'sets', 3, 'reps', 5, 'order', 1),
    jsonb_build_object('exerciseId', ex_pullup, 'sets', 4, 'reps', 8, 'order', 2),
    jsonb_build_object('exerciseId', ex_barbell_row, 'sets', 3, 'reps', 8, 'order', 3),
    jsonb_build_object('exerciseId', ex_seated_row, 'sets', 3, 'reps', 10, 'order', 4),
    jsonb_build_object('exerciseId', ex_face_pull, 'sets', 3, 'reps', 15, 'order', 5),
    jsonb_build_object('exerciseId', ex_barbell_curl, 'sets', 3, 'reps', 10, 'order', 6)
  ));

  -- Day 3: Legs
  legs_day_id := gen_random_uuid();
  insert into workout_days (id, program_id, day_number, name, focus, exercises)
  values (legs_day_id, prog_id, 3, 'Leg Day', 'Quads, Hamstrings, Glutes', jsonb_build_array(
    jsonb_build_object('exerciseId', ex_squat, 'sets', 4, 'reps', 6, 'order', 1),
    jsonb_build_object('exerciseId', ex_rdl, 'sets', 3, 'reps', 8, 'order', 2),
    jsonb_build_object('exerciseId', ex_leg_press, 'sets', 3, 'reps', 10, 'order', 3),
    jsonb_build_object('exerciseId', ex_hip_thrust, 'sets', 3, 'reps', 10, 'order', 4),
    jsonb_build_object('exerciseId', ex_leg_raise, 'sets', 3, 'reps', 12, 'order', 5)
  ));

  -- Day 4: Push 2 (lighter)
  push2_day_id := gen_random_uuid();
  insert into workout_days (id, program_id, day_number, name, focus, exercises)
  values (push2_day_id, prog_id, 4, 'Push Day B', 'Shoulders, Chest (lighter)', jsonb_build_array(
    jsonb_build_object('exerciseId', ex_ohp, 'sets', 4, 'reps', 6, 'order', 1),
    jsonb_build_object('exerciseId', ex_incline, 'sets', 3, 'reps', 10, 'order', 2),
    jsonb_build_object('exerciseId', ex_cable_fly, 'sets', 3, 'reps', 12, 'order', 3),
    jsonb_build_object('exerciseId', ex_lat_raise, 'sets', 4, 'reps', 15, 'order', 4),
    jsonb_build_object('exerciseId', ex_tricep_dips, 'sets', 3, 'reps', 12, 'order', 5)
  ));

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 3. Workout Sessions — 15 sessions over ~3 weeks
  -- ═══════════════════════════════════════════════════════════════════════════

  -- ─── Week 1 ───

  -- W1 Mon: Push
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push_day_id, 'Push Day', now() - interval '20 days' + time '07:00', now() - interval '20 days' + time '07:52', 3120, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_bench, 1, 'working', 90.0, 8), (s_id, ex_bench, 2, 'working', 90.0, 8),
    (s_id, ex_bench, 3, 'working', 90.0, 7), (s_id, ex_bench, 4, 'working', 90.0, 6),
    (s_id, ex_incline, 1, 'working', 30.0, 10), (s_id, ex_incline, 2, 'working', 30.0, 10),
    (s_id, ex_incline, 3, 'working', 30.0, 9),
    (s_id, ex_ohp, 1, 'working', 55.0, 8), (s_id, ex_ohp, 2, 'working', 55.0, 7),
    (s_id, ex_ohp, 3, 'working', 55.0, 6),
    (s_id, ex_lat_raise, 1, 'working', 12.0, 15), (s_id, ex_lat_raise, 2, 'working', 12.0, 14),
    (s_id, ex_lat_raise, 3, 'working', 12.0, 12),
    (s_id, ex_cable_fly, 1, 'working', 15.0, 12), (s_id, ex_cable_fly, 2, 'working', 15.0, 12),
    (s_id, ex_cable_fly, 3, 'working', 15.0, 11),
    (s_id, ex_tricep_dips, 1, 'working', 0, 10), (s_id, ex_tricep_dips, 2, 'working', 0, 9),
    (s_id, ex_tricep_dips, 3, 'working', 0, 8);

  -- W1 Tue: Pull
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, pull_day_id, 'Pull Day', now() - interval '19 days' + time '07:00', now() - interval '19 days' + time '07:58', 3480, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_deadlift, 1, 'working', 130.0, 5), (s_id, ex_deadlift, 2, 'working', 130.0, 5),
    (s_id, ex_deadlift, 3, 'working', 130.0, 4),
    (s_id, ex_pullup, 1, 'working', 0, 8), (s_id, ex_pullup, 2, 'working', 0, 7),
    (s_id, ex_pullup, 3, 'working', 0, 6), (s_id, ex_pullup, 4, 'working', 0, 5),
    (s_id, ex_barbell_row, 1, 'working', 80.0, 8), (s_id, ex_barbell_row, 2, 'working', 80.0, 8),
    (s_id, ex_barbell_row, 3, 'working', 80.0, 7),
    (s_id, ex_seated_row, 1, 'working', 60.0, 10), (s_id, ex_seated_row, 2, 'working', 60.0, 10),
    (s_id, ex_seated_row, 3, 'working', 60.0, 9),
    (s_id, ex_face_pull, 1, 'working', 20.0, 15), (s_id, ex_face_pull, 2, 'working', 20.0, 15),
    (s_id, ex_face_pull, 3, 'working', 20.0, 14),
    (s_id, ex_barbell_curl, 1, 'working', 30.0, 10), (s_id, ex_barbell_curl, 2, 'working', 30.0, 9),
    (s_id, ex_barbell_curl, 3, 'working', 30.0, 8);

  -- W1 Thu: Legs
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, legs_day_id, 'Leg Day', now() - interval '17 days' + time '07:00', now() - interval '17 days' + time '08:00', 3600, 3, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_squat, 1, 'working', 120.0, 6), (s_id, ex_squat, 2, 'working', 120.0, 6),
    (s_id, ex_squat, 3, 'working', 120.0, 5), (s_id, ex_squat, 4, 'working', 120.0, 5),
    (s_id, ex_rdl, 1, 'working', 90.0, 8), (s_id, ex_rdl, 2, 'working', 90.0, 8),
    (s_id, ex_rdl, 3, 'working', 90.0, 7),
    (s_id, ex_leg_press, 1, 'working', 180.0, 10), (s_id, ex_leg_press, 2, 'working', 180.0, 10),
    (s_id, ex_leg_press, 3, 'working', 180.0, 9),
    (s_id, ex_hip_thrust, 1, 'working', 100.0, 10), (s_id, ex_hip_thrust, 2, 'working', 100.0, 10),
    (s_id, ex_hip_thrust, 3, 'working', 100.0, 9),
    (s_id, ex_leg_raise, 1, 'working', 0, 12), (s_id, ex_leg_raise, 2, 'working', 0, 10),
    (s_id, ex_leg_raise, 3, 'working', 0, 8);

  -- W1 Fri: Push B
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push2_day_id, 'Push Day B', now() - interval '16 days' + time '07:00', now() - interval '16 days' + time '07:48', 2880, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_ohp, 1, 'working', 57.5, 6), (s_id, ex_ohp, 2, 'working', 57.5, 6),
    (s_id, ex_ohp, 3, 'working', 57.5, 5), (s_id, ex_ohp, 4, 'working', 57.5, 5),
    (s_id, ex_incline, 1, 'working', 32.0, 10), (s_id, ex_incline, 2, 'working', 32.0, 9),
    (s_id, ex_incline, 3, 'working', 32.0, 8),
    (s_id, ex_cable_fly, 1, 'working', 17.5, 12), (s_id, ex_cable_fly, 2, 'working', 17.5, 12),
    (s_id, ex_cable_fly, 3, 'working', 17.5, 11),
    (s_id, ex_lat_raise, 1, 'working', 12.0, 15), (s_id, ex_lat_raise, 2, 'working', 12.0, 15),
    (s_id, ex_lat_raise, 3, 'working', 12.0, 14), (s_id, ex_lat_raise, 4, 'working', 12.0, 12),
    (s_id, ex_tricep_dips, 1, 'working', 0, 12), (s_id, ex_tricep_dips, 2, 'working', 0, 11),
    (s_id, ex_tricep_dips, 3, 'working', 0, 10);

  -- ─── Week 2 ───

  -- W2 Mon: Push (weights +2.5 on compounds)
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push_day_id, 'Push Day', now() - interval '13 days' + time '07:00', now() - interval '13 days' + time '07:55', 3300, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_bench, 1, 'working', 92.5, 8), (s_id, ex_bench, 2, 'working', 92.5, 8),
    (s_id, ex_bench, 3, 'working', 92.5, 7), (s_id, ex_bench, 4, 'working', 92.5, 7),
    (s_id, ex_incline, 1, 'working', 32.0, 10), (s_id, ex_incline, 2, 'working', 32.0, 10),
    (s_id, ex_incline, 3, 'working', 32.0, 9),
    (s_id, ex_ohp, 1, 'working', 57.5, 8), (s_id, ex_ohp, 2, 'working', 57.5, 8),
    (s_id, ex_ohp, 3, 'working', 57.5, 7),
    (s_id, ex_lat_raise, 1, 'working', 14.0, 15), (s_id, ex_lat_raise, 2, 'working', 14.0, 14),
    (s_id, ex_lat_raise, 3, 'working', 14.0, 12),
    (s_id, ex_cable_fly, 1, 'working', 17.5, 12), (s_id, ex_cable_fly, 2, 'working', 17.5, 12),
    (s_id, ex_cable_fly, 3, 'working', 17.5, 11),
    (s_id, ex_tricep_dips, 1, 'working', 5.0, 10), (s_id, ex_tricep_dips, 2, 'working', 5.0, 9),
    (s_id, ex_tricep_dips, 3, 'working', 5.0, 8);

  -- W2 Tue: Pull
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, pull_day_id, 'Pull Day', now() - interval '12 days' + time '07:00', now() - interval '12 days' + time '08:00', 3600, 5, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_deadlift, 1, 'working', 135.0, 5), (s_id, ex_deadlift, 2, 'working', 135.0, 5),
    (s_id, ex_deadlift, 3, 'working', 135.0, 5),
    (s_id, ex_pullup, 1, 'working', 5.0, 8), (s_id, ex_pullup, 2, 'working', 5.0, 7),
    (s_id, ex_pullup, 3, 'working', 5.0, 6), (s_id, ex_pullup, 4, 'working', 5.0, 5),
    (s_id, ex_barbell_row, 1, 'working', 82.5, 8), (s_id, ex_barbell_row, 2, 'working', 82.5, 8),
    (s_id, ex_barbell_row, 3, 'working', 82.5, 7),
    (s_id, ex_seated_row, 1, 'working', 62.5, 10), (s_id, ex_seated_row, 2, 'working', 62.5, 10),
    (s_id, ex_seated_row, 3, 'working', 62.5, 10),
    (s_id, ex_face_pull, 1, 'working', 22.5, 15), (s_id, ex_face_pull, 2, 'working', 22.5, 15),
    (s_id, ex_face_pull, 3, 'working', 22.5, 14),
    (s_id, ex_barbell_curl, 1, 'working', 32.5, 10), (s_id, ex_barbell_curl, 2, 'working', 32.5, 9),
    (s_id, ex_barbell_curl, 3, 'working', 32.5, 8);

  -- W2 Thu: Legs
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, legs_day_id, 'Leg Day', now() - interval '10 days' + time '07:00', now() - interval '10 days' + time '08:02', 3720, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_squat, 1, 'working', 125.0, 6), (s_id, ex_squat, 2, 'working', 125.0, 6),
    (s_id, ex_squat, 3, 'working', 125.0, 5), (s_id, ex_squat, 4, 'working', 125.0, 5),
    (s_id, ex_rdl, 1, 'working', 95.0, 8), (s_id, ex_rdl, 2, 'working', 95.0, 8),
    (s_id, ex_rdl, 3, 'working', 95.0, 7),
    (s_id, ex_leg_press, 1, 'working', 190.0, 10), (s_id, ex_leg_press, 2, 'working', 190.0, 10),
    (s_id, ex_leg_press, 3, 'working', 190.0, 9),
    (s_id, ex_hip_thrust, 1, 'working', 105.0, 10), (s_id, ex_hip_thrust, 2, 'working', 105.0, 10),
    (s_id, ex_hip_thrust, 3, 'working', 105.0, 9),
    (s_id, ex_leg_raise, 1, 'working', 0, 12), (s_id, ex_leg_raise, 2, 'working', 0, 11),
    (s_id, ex_leg_raise, 3, 'working', 0, 10);

  -- W2 Fri: Push B
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push2_day_id, 'Push Day B', now() - interval '9 days' + time '17:00', now() - interval '9 days' + time '17:50', 3000, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps) values
    (s_id, ex_ohp, 1, 'working', 60.0, 6), (s_id, ex_ohp, 2, 'working', 60.0, 6),
    (s_id, ex_ohp, 3, 'working', 60.0, 6), (s_id, ex_ohp, 4, 'working', 60.0, 5),
    (s_id, ex_incline, 1, 'working', 34.0, 10), (s_id, ex_incline, 2, 'working', 34.0, 9),
    (s_id, ex_incline, 3, 'working', 34.0, 8),
    (s_id, ex_cable_fly, 1, 'working', 17.5, 12), (s_id, ex_cable_fly, 2, 'working', 17.5, 12),
    (s_id, ex_cable_fly, 3, 'working', 17.5, 12),
    (s_id, ex_lat_raise, 1, 'working', 14.0, 15), (s_id, ex_lat_raise, 2, 'working', 14.0, 15),
    (s_id, ex_lat_raise, 3, 'working', 14.0, 14), (s_id, ex_lat_raise, 4, 'working', 14.0, 13),
    (s_id, ex_tricep_dips, 1, 'working', 5.0, 12), (s_id, ex_tricep_dips, 2, 'working', 5.0, 11),
    (s_id, ex_tricep_dips, 3, 'working', 5.0, 10);

  -- ─── Week 3 ───

  -- W3 Mon: Push (more progression)
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push_day_id, 'Push Day', now() - interval '6 days' + time '07:00', now() - interval '6 days' + time '07:56', 3360, 5, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps, is_pr) values
    (s_id, ex_bench, 1, 'working', 95.0, 8, false), (s_id, ex_bench, 2, 'working', 95.0, 8, false),
    (s_id, ex_bench, 3, 'working', 95.0, 8, false), (s_id, ex_bench, 4, 'working', 95.0, 7, false),
    (s_id, ex_incline, 1, 'working', 34.0, 10, false), (s_id, ex_incline, 2, 'working', 34.0, 10, false),
    (s_id, ex_incline, 3, 'working', 34.0, 10, false),
    (s_id, ex_ohp, 1, 'working', 60.0, 8, false), (s_id, ex_ohp, 2, 'working', 60.0, 8, false),
    (s_id, ex_ohp, 3, 'working', 60.0, 7, false),
    (s_id, ex_lat_raise, 1, 'working', 14.0, 15, false), (s_id, ex_lat_raise, 2, 'working', 14.0, 15, false),
    (s_id, ex_lat_raise, 3, 'working', 14.0, 14, false),
    (s_id, ex_cable_fly, 1, 'working', 20.0, 12, false), (s_id, ex_cable_fly, 2, 'working', 20.0, 12, false),
    (s_id, ex_cable_fly, 3, 'working', 20.0, 11, false),
    (s_id, ex_tricep_dips, 1, 'working', 10.0, 10, false), (s_id, ex_tricep_dips, 2, 'working', 10.0, 9, false),
    (s_id, ex_tricep_dips, 3, 'working', 10.0, 8, false);

  -- W3 Tue: Pull
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, pull_day_id, 'Pull Day', now() - interval '5 days' + time '07:00', now() - interval '5 days' + time '08:00', 3600, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps, is_pr) values
    (s_id, ex_deadlift, 1, 'working', 140.0, 5, true), (s_id, ex_deadlift, 2, 'working', 140.0, 5, false),
    (s_id, ex_deadlift, 3, 'working', 140.0, 4, false),
    (s_id, ex_pullup, 1, 'working', 10.0, 8, false), (s_id, ex_pullup, 2, 'working', 10.0, 7, false),
    (s_id, ex_pullup, 3, 'working', 10.0, 6, false), (s_id, ex_pullup, 4, 'working', 10.0, 5, false),
    (s_id, ex_barbell_row, 1, 'working', 85.0, 8, false), (s_id, ex_barbell_row, 2, 'working', 85.0, 8, false),
    (s_id, ex_barbell_row, 3, 'working', 85.0, 8, false),
    (s_id, ex_seated_row, 1, 'working', 65.0, 10, false), (s_id, ex_seated_row, 2, 'working', 65.0, 10, false),
    (s_id, ex_seated_row, 3, 'working', 65.0, 10, false),
    (s_id, ex_face_pull, 1, 'working', 25.0, 15, false), (s_id, ex_face_pull, 2, 'working', 25.0, 15, false),
    (s_id, ex_face_pull, 3, 'working', 25.0, 14, false),
    (s_id, ex_barbell_curl, 1, 'working', 35.0, 10, true), (s_id, ex_barbell_curl, 2, 'working', 35.0, 9, false),
    (s_id, ex_barbell_curl, 3, 'working', 35.0, 8, false);

  -- W3 Wed: Rest (skipped)

  -- W3 Thu: Legs
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, legs_day_id, 'Leg Day', now() - interval '3 days' + time '07:00', now() - interval '3 days' + time '08:05', 3900, 4, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps, is_pr) values
    (s_id, ex_squat, 1, 'working', 130.0, 6, false), (s_id, ex_squat, 2, 'working', 130.0, 6, false),
    (s_id, ex_squat, 3, 'working', 130.0, 5, false), (s_id, ex_squat, 4, 'working', 130.0, 5, false),
    (s_id, ex_rdl, 1, 'working', 97.5, 8, false), (s_id, ex_rdl, 2, 'working', 97.5, 8, false),
    (s_id, ex_rdl, 3, 'working', 97.5, 8, false),
    (s_id, ex_leg_press, 1, 'working', 200.0, 10, true), (s_id, ex_leg_press, 2, 'working', 200.0, 10, false),
    (s_id, ex_leg_press, 3, 'working', 200.0, 9, false),
    (s_id, ex_hip_thrust, 1, 'working', 110.0, 10, false), (s_id, ex_hip_thrust, 2, 'working', 110.0, 10, false),
    (s_id, ex_hip_thrust, 3, 'working', 110.0, 10, false),
    (s_id, ex_leg_raise, 1, 'working', 0, 15, true), (s_id, ex_leg_raise, 2, 'working', 0, 12, false),
    (s_id, ex_leg_raise, 3, 'working', 0, 10, false);

  -- W3 Fri: Push B
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push2_day_id, 'Push Day B', now() - interval '2 days' + time '07:00', now() - interval '2 days' + time '07:52', 3120, 5, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps, is_pr) values
    (s_id, ex_ohp, 1, 'working', 62.5, 6, true), (s_id, ex_ohp, 2, 'working', 62.5, 6, false),
    (s_id, ex_ohp, 3, 'working', 62.5, 6, false), (s_id, ex_ohp, 4, 'working', 62.5, 5, false),
    (s_id, ex_incline, 1, 'working', 34.0, 10, false), (s_id, ex_incline, 2, 'working', 34.0, 10, false),
    (s_id, ex_incline, 3, 'working', 34.0, 10, false),
    (s_id, ex_cable_fly, 1, 'working', 20.0, 12, false), (s_id, ex_cable_fly, 2, 'working', 20.0, 12, false),
    (s_id, ex_cable_fly, 3, 'working', 20.0, 12, false),
    (s_id, ex_lat_raise, 1, 'working', 14.0, 15, false), (s_id, ex_lat_raise, 2, 'working', 14.0, 15, false),
    (s_id, ex_lat_raise, 3, 'working', 14.0, 15, false), (s_id, ex_lat_raise, 4, 'working', 14.0, 14, false),
    (s_id, ex_tricep_dips, 1, 'working', 10.0, 12, false), (s_id, ex_tricep_dips, 2, 'working', 10.0, 11, false),
    (s_id, ex_tricep_dips, 3, 'working', 10.0, 10, false);

  -- W3 Sat: Extra push session (15th session)
  s_id := gen_random_uuid();
  insert into workout_sessions (id, user_id, program_id, workout_day_id, name, started_at, completed_at, duration_seconds, mood_rating, is_synced)
  values (s_id, demo_uid, prog_id, push_day_id, 'Push Day', now() - interval '1 day' + time '09:00', now() - interval '1 day' + time '09:55', 3300, 5, true);
  insert into set_logs (session_id, exercise_id, set_number, set_type, weight_kg, reps, is_pr) values
    (s_id, ex_bench, 1, 'working', 97.5, 8, false), (s_id, ex_bench, 2, 'working', 97.5, 8, false),
    (s_id, ex_bench, 3, 'working', 97.5, 7, false), (s_id, ex_bench, 4, 'working', 100.0, 5, true),
    (s_id, ex_incline, 1, 'working', 36.0, 10, true), (s_id, ex_incline, 2, 'working', 36.0, 9, false),
    (s_id, ex_incline, 3, 'working', 36.0, 8, false),
    (s_id, ex_ohp, 1, 'working', 62.5, 8, false), (s_id, ex_ohp, 2, 'working', 62.5, 8, false),
    (s_id, ex_ohp, 3, 'working', 62.5, 7, false),
    (s_id, ex_lat_raise, 1, 'working', 14.0, 15, false), (s_id, ex_lat_raise, 2, 'working', 14.0, 15, false),
    (s_id, ex_lat_raise, 3, 'working', 14.0, 15, false),
    (s_id, ex_cable_fly, 1, 'working', 20.0, 12, false), (s_id, ex_cable_fly, 2, 'working', 20.0, 12, false),
    (s_id, ex_cable_fly, 3, 'working', 20.0, 12, false),
    (s_id, ex_tricep_dips, 1, 'working', 10.0, 12, false), (s_id, ex_tricep_dips, 2, 'working', 10.0, 11, false),
    (s_id, ex_tricep_dips, 3, 'working', 10.0, 10, false);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 4. Personal Records (10+)
  -- ═══════════════════════════════════════════════════════════════════════════
  insert into personal_records (user_id, exercise_id, weight_kg, reps, estimated_1rm, achieved_at) values
    (demo_uid, ex_bench,       100.0, 5,  112.5, now() - interval '1 day'),
    (demo_uid, ex_incline,      36.0, 10,  48.0, now() - interval '1 day'),
    (demo_uid, ex_ohp,          62.5, 6,   73.4, now() - interval '2 days'),
    (demo_uid, ex_deadlift,    140.0, 5,  157.5, now() - interval '5 days'),
    (demo_uid, ex_squat,       130.0, 6,  150.8, now() - interval '3 days'),
    (demo_uid, ex_barbell_row,  85.0, 8,   104.7, now() - interval '5 days'),
    (demo_uid, ex_barbell_curl, 35.0, 10,  46.7, now() - interval '5 days'),
    (demo_uid, ex_leg_press,   200.0, 10, 266.7, now() - interval '3 days'),
    (demo_uid, ex_hip_thrust,  110.0, 10, 146.7, now() - interval '3 days'),
    (demo_uid, ex_rdl,          97.5, 8,  120.0, now() - interval '3 days'),
    (demo_uid, ex_seated_row,   65.0, 10,  86.7, now() - interval '5 days'),
    (demo_uid, ex_pullup,       10.0, 8,   12.3, now() - interval '5 days');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5. Nutrition Logs — 7 days
  -- ═══════════════════════════════════════════════════════════════════════════
  for i in 0..6 loop
    ndl_id := gen_random_uuid();
    insert into nutrition_day_logs (id, user_id, date, calorie_target, protein_target_g, carbs_target_g, fat_target_g, water_target_ml,
      calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, water_consumed_ml)
    values (ndl_id, demo_uid, (current_date - i)::date, 2500, 180, 280, 80, 3000,
      2200 + (random() * 500)::int,
      (160 + random() * 40)::numeric(6,1),
      (220 + random() * 80)::numeric(6,1),
      (60 + random() * 30)::numeric(6,1),
      (2000 + (random() * 1200)::int));

    -- Breakfast
    insert into meal_logs (user_id, day_log_id, meal_type, name, source, logged_at)
    values (demo_uid, ndl_id, 'breakfast', 'Oats with Protein', 'manual', (current_date - i) + time '07:30');

    -- Lunch
    insert into meal_logs (user_id, day_log_id, meal_type, name, source, logged_at)
    values (demo_uid, ndl_id, 'lunch', 'Chicken Rice Bowl', 'manual', (current_date - i) + time '12:30');

    -- Dinner
    insert into meal_logs (user_id, day_log_id, meal_type, name, source, logged_at)
    values (demo_uid, ndl_id, 'dinner', 'Salmon with Vegetables', 'manual', (current_date - i) + time '19:00');

    -- Snack (not every day)
    if i % 2 = 0 then
      insert into meal_logs (user_id, day_log_id, meal_type, name, source, logged_at)
      values (demo_uid, ndl_id, 'snack', 'Protein Shake', 'quick_add', (current_date - i) + time '15:30');
    end if;
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 6. Hydration Logs — 7 days
  -- ═══════════════════════════════════════════════════════════════════════════
  for i in 0..6 loop
    -- 4-6 entries per day
    insert into hydration_logs (user_id, amount_ml, logged_at) values
      (demo_uid, 500, (current_date - i) + time '07:00'),
      (demo_uid, 350, (current_date - i) + time '09:30'),
      (demo_uid, 500, (current_date - i) + time '12:00'),
      (demo_uid, 350, (current_date - i) + time '15:00'),
      (demo_uid, 500, (current_date - i) + time '18:00');
    if i % 2 = 0 then
      insert into hydration_logs (user_id, amount_ml, logged_at)
      values (demo_uid, 350, (current_date - i) + time '20:30');
    end if;
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 7. Body Measurements (trending down slightly)
  -- ═══════════════════════════════════════════════════════════════════════════
  insert into body_measurements (user_id, date, weight_kg, body_fat_percent) values
    (demo_uid, current_date - 20, 85.2, 18.5),
    (demo_uid, current_date - 17, 84.8, null),
    (demo_uid, current_date - 14, 84.5, 18.2),
    (demo_uid, current_date - 11, 84.1, null),
    (demo_uid, current_date - 8,  83.8, 17.9),
    (demo_uid, current_date - 5,  83.5, null),
    (demo_uid, current_date - 3,  83.2, 17.6),
    (demo_uid, current_date - 1,  82.8, null),
    (demo_uid, current_date,      82.5, 17.3);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 8. Achievements
  -- ═══════════════════════════════════════════════════════════════════════════
  insert into achievements (user_id, achievement_type, name, description, icon, earned_at, metadata) values
    (demo_uid, 'first_workout',    'First Step',       'Completed your first workout',                        'barbell-outline',  now() - interval '20 days', '{"session_count": 1}'),
    (demo_uid, 'streak_7',         'Week Warrior',     'Maintained a 7-day workout streak',                   'flame-outline',    now() - interval '10 days', '{"streak": 7}'),
    (demo_uid, 'streak_10',        'Consistency King',  'Maintained a 10-day workout streak',                 'flame-outline',    now() - interval '5 days',  '{"streak": 10}'),
    (demo_uid, 'volume_10k',       'Volume Crusher',   'Lifted over 10,000 kg total volume in a single session', 'trending-up-outline', now() - interval '3 days', '{"volume_kg": 12450}'),
    (demo_uid, 'sessions_10',      'Dedicated',        'Completed 10 workout sessions',                      'fitness-outline',  now() - interval '5 days',  '{"session_count": 10}'),
    (demo_uid, 'bench_100kg',      'Century Club',     'Bench pressed 100kg',                                'trophy-outline',   now() - interval '1 day',   '{"weight_kg": 100, "exercise": "Barbell Bench Press"}');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 9. User Streak
  -- ═══════════════════════════════════════════════════════════════════════════
  update user_streaks set
    current_streak = 12,
    longest_streak = 12,
    last_workout_date = current_date - 1,
    streak_history = '[{"start":"2026-03-01","end":null,"length":12}]'::jsonb
  where user_id = demo_uid;

end $$;
