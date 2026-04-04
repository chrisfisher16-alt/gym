-- =============================================================================
-- 00008_onboarding_v2.sql
-- Extend profiles for AI-native onboarding flow v2.
-- Adds fitness-specific fields, equipment, schedule, and attribution data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New ENUM types for onboarding
-- ---------------------------------------------------------------------------
create type fitness_goal     as enum ('build_muscle', 'lose_fat', 'get_stronger', 'stay_active', 'athletic_performance');
create type experience_level as enum ('beginner', 'less_than_1_year', '1_to_2_years', '2_to_4_years', '4_plus_years');
create type consistency_level as enum ('never_consistent', 'returning_from_break', 'struggle_with_it', 'very_consistent');
create type gym_type         as enum ('large_gym', 'small_gym', 'garage_gym', 'at_home', 'no_equipment');
create type session_duration as enum ('30_min', '45_min', '60_min', '75_plus_min');

-- ---------------------------------------------------------------------------
-- Add new columns to profiles
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists fitness_goal          fitness_goal,
  add column if not exists experience_level      experience_level,
  add column if not exists consistency_level     consistency_level,
  add column if not exists gym_type              gym_type,
  add column if not exists gym_name              text,
  add column if not exists training_days_per_week smallint,
  add column if not exists specific_training_days text[],
  add column if not exists session_duration_pref  session_duration,
  add column if not exists injuries              text[] not null default '{}',
  add column if not exists user_equipment        jsonb not null default '[]',
  add column if not exists attribution_source    text,
  add column if not exists notification_time     time default '09:00',
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists onboarding_version    smallint not null default 0,
  add column if not exists health_sync_enabled   boolean not null default false;

-- Add comments for documentation
comment on column profiles.fitness_goal is 'Primary fitness goal selected during onboarding v2';
comment on column profiles.experience_level is 'Strength training experience level';
comment on column profiles.consistency_level is 'Self-assessed training consistency';
comment on column profiles.gym_type is 'Primary training location type';
comment on column profiles.gym_name is 'Name of specific gym (if applicable)';
comment on column profiles.training_days_per_week is 'Preferred number of training days per week (1-6)';
comment on column profiles.specific_training_days is 'Specific days of the week for training (e.g. {monday,wednesday,friday})';
comment on column profiles.session_duration_pref is 'Preferred workout session duration';
comment on column profiles.injuries is 'Body areas to be careful with (e.g. {shoulders,lower_back})';
comment on column profiles.user_equipment is 'Detailed equipment list as JSON array of {id, name, category, available} objects';
comment on column profiles.attribution_source is 'How the user heard about FormIQ (marketing attribution)';
comment on column profiles.notification_time is 'Preferred time for workout reminder notifications';
comment on column profiles.notifications_enabled is 'Whether push notifications are enabled';
comment on column profiles.onboarding_version is '0 = not onboarded, 1 = legacy onboarding, 2 = AI-native onboarding v2';
comment on column profiles.health_sync_enabled is 'Whether Apple Health / Google Health Connect sync is enabled';

-- Add check constraint for training_days_per_week
alter table profiles
  add constraint chk_training_days_range
  check (training_days_per_week is null or (training_days_per_week >= 1 and training_days_per_week <= 7));

-- Index for admin analytics on gym type and goals
create index if not exists idx_profiles_fitness_goal on profiles (fitness_goal) where fitness_goal is not null;
create index if not exists idx_profiles_gym_type on profiles (gym_type) where gym_type is not null;
create index if not exists idx_profiles_onboarding_version on profiles (onboarding_version);
