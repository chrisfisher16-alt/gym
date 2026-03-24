-- =============================================================================
-- 00003_phase10_additions.sql
-- Phase 10: Additional tables for personal records, body measurements,
--           achievements, user streaks, and hydration logs.
--           Also adds theme_preference and rest_timer_default to profiles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profile additions
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('dark', 'light', 'system')),
  add column if not exists rest_timer_default int not null default 90;

-- ---------------------------------------------------------------------------
-- Personal Records
-- ---------------------------------------------------------------------------
create table if not exists personal_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  exercise_id   uuid not null references exercises(id) on delete cascade,
  weight_kg     numeric(6,2) not null,
  reps          int not null,
  estimated_1rm numeric(6,2),
  session_id    uuid references workout_sessions(id) on delete set null,
  achieved_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index idx_personal_records_user_exercise
  on personal_records (user_id, exercise_id);
create index idx_personal_records_user_achieved
  on personal_records (user_id, achieved_at desc);

-- ---------------------------------------------------------------------------
-- Body Measurements
-- ---------------------------------------------------------------------------
create table if not exists body_measurements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  date             date not null,
  weight_kg        numeric(5,1),
  body_fat_percent numeric(4,1),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, date)
);

create trigger body_measurements_updated_at
  before update on body_measurements
  for each row execute function update_updated_at();

create index idx_body_measurements_user_date
  on body_measurements (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Hydration Logs
-- ---------------------------------------------------------------------------
create table if not exists hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  amount_ml   int not null,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_hydration_logs_user_date
  on hydration_logs (user_id, (logged_at::date));
create index idx_hydration_logs_user_logged
  on hydration_logs (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
create table if not exists achievements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  achievement_type text not null,
  name             text not null,
  description      text,
  icon             text,
  earned_at        timestamptz not null default now(),
  metadata         jsonb default '{}',
  created_at       timestamptz not null default now(),
  unique (user_id, achievement_type)
);

create index idx_achievements_user
  on achievements (user_id);

-- ---------------------------------------------------------------------------
-- User Streaks
-- ---------------------------------------------------------------------------
create table if not exists user_streaks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references profiles(id) on delete cascade,
  current_streak     int not null default 0,
  longest_streak     int not null default 0,
  last_workout_date  date,
  streak_history     jsonb default '[]',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger user_streaks_updated_at
  before update on user_streaks
  for each row execute function update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: personal_records
-- ---------------------------------------------------------------------------
alter table personal_records enable row level security;

create policy "Users can view own personal_records"
  on personal_records for select using (auth.uid() = user_id);
create policy "Users can insert own personal_records"
  on personal_records for insert with check (auth.uid() = user_id);
create policy "Users can update own personal_records"
  on personal_records for update using (auth.uid() = user_id);
create policy "Users can delete own personal_records"
  on personal_records for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: body_measurements
-- ---------------------------------------------------------------------------
alter table body_measurements enable row level security;

create policy "Users can view own body_measurements"
  on body_measurements for select using (auth.uid() = user_id);
create policy "Users can insert own body_measurements"
  on body_measurements for insert with check (auth.uid() = user_id);
create policy "Users can update own body_measurements"
  on body_measurements for update using (auth.uid() = user_id);
create policy "Users can delete own body_measurements"
  on body_measurements for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: hydration_logs
-- ---------------------------------------------------------------------------
alter table hydration_logs enable row level security;

create policy "Users can view own hydration_logs"
  on hydration_logs for select using (auth.uid() = user_id);
create policy "Users can insert own hydration_logs"
  on hydration_logs for insert with check (auth.uid() = user_id);
create policy "Users can delete own hydration_logs"
  on hydration_logs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: achievements
-- ---------------------------------------------------------------------------
alter table achievements enable row level security;

create policy "Users can view own achievements"
  on achievements for select using (auth.uid() = user_id);
create policy "Users can insert own achievements"
  on achievements for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: user_streaks
-- ---------------------------------------------------------------------------
alter table user_streaks enable row level security;

create policy "Users can view own user_streaks"
  on user_streaks for select using (auth.uid() = user_id);
create policy "Users can insert own user_streaks"
  on user_streaks for insert with check (auth.uid() = user_id);
create policy "Users can update own user_streaks"
  on user_streaks for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create streak row on signup (extend handle_new_user)
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);

  insert into entitlements (user_id, tier, workout_logs_remaining, meal_logs_remaining, ai_messages_remaining, limits_reset_at)
  values (new.id, 'free', 3, 3, 10, now() + interval '1 day');

  insert into notification_preferences (user_id)
  values (new.id);

  insert into coach_preferences (user_id)
  values (new.id);

  insert into user_streaks (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Helper function: cascade-delete user data (GDPR account deletion)
-- ---------------------------------------------------------------------------
create or replace function delete_user_account()
returns void as $$
begin
  -- All tables cascade from profiles(id) which cascades from auth.users,
  -- so deleting the auth user removes everything.
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Additional exercises to reach 30+ in the library
-- ---------------------------------------------------------------------------
insert into exercises (name, category, primary_muscles, secondary_muscles, equipment, instructions, is_custom)
values
  -- More Chest
  ('Dumbbell Flat Press',        'chest',     '{chest}',                    '{triceps,front_delts}',      'dumbbells',  'Lie flat on bench, press dumbbells from chest to lockout.', false),
  ('Push-Up',                    'chest',     '{chest}',                    '{triceps,front_delts,core}', 'bodyweight', 'Hands shoulder-width, lower chest to floor, push up.', false),
  ('Chest Dip',                  'chest',     '{lower_chest}',             '{triceps,front_delts}',      'dip_bars',   'Lean forward on dip bars, lower body, press back up.', false),

  -- More Back
  ('Barbell Row',                'back',      '{mid_back,lats}',           '{biceps,rear_delts}',        'barbell',    'Hinge at hips, pull barbell to lower chest.', false),
  ('Lat Pulldown',               'back',      '{lats}',                    '{biceps,rear_delts}',        'cable',      'Pull bar down to upper chest, squeeze lats.', false),
  ('Face Pull',                  'back',      '{rear_delts,rotator_cuff}', '{traps}',                    'cable',      'Pull rope to face level with elbows high.', false),
  ('T-Bar Row',                  'back',      '{mid_back,lats}',           '{biceps,rear_delts}',        'barbell',    'Straddle barbell in landmine, row to chest.', false),

  -- More Shoulders
  ('Dumbbell Shoulder Press',    'shoulders', '{front_delts,side_delts}',  '{triceps}',                  'dumbbells',  'Press dumbbells from shoulder height to overhead.', false),
  ('Rear Delt Fly',              'shoulders', '{rear_delts}',              '{traps}',                    'dumbbells',  'Bend over, raise dumbbells out to sides.', false),
  ('Cable Lateral Raise',        'shoulders', '{side_delts}',              '{traps}',                    'cable',      'Single arm, raise cable out to side until arm parallel.', false),

  -- More Legs
  ('Leg Extension',              'legs',      '{quads}',                   '{}',                         'machine',    'Extend legs against pad from 90 degrees to straight.', false),
  ('Leg Curl',                   'legs',      '{hamstrings}',              '{}',                         'machine',    'Curl pad toward glutes from straight leg position.', false),
  ('Bulgarian Split Squat',      'legs',      '{quads,glutes}',            '{hamstrings,core}',          'dumbbells',  'Rear foot elevated, lunge down and up.', false),
  ('Calf Raise',                 'legs',      '{calves}',                  '{}',                         'machine',    'Rise onto toes, lower with control.', false),
  ('Hip Thrust',                 'legs',      '{glutes}',                  '{hamstrings}',               'barbell',    'Back on bench, drive hips up with barbell on hips.', false),

  -- More Arms
  ('Cable Tricep Pushdown',      'arms',      '{triceps}',                 '{}',                         'cable',      'Push cable bar down from chest to full extension.', false),
  ('Preacher Curl',              'arms',      '{biceps}',                  '{forearms}',                 'barbell',    'Curl bar on preacher bench, full range of motion.', false),
  ('Overhead Tricep Extension',  'arms',      '{triceps}',                 '{}',                         'dumbbells',  'Lower dumbbell behind head, extend to overhead.', false)
on conflict do nothing;
