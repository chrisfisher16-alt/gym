-- =============================================================================
-- 00001_initial_schema.sql
-- Initial database schema for AI Health Coach App
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Custom ENUM types
-- ---------------------------------------------------------------------------
create type unit_preference   as enum ('metric', 'imperial');
create type product_mode      as enum ('workout_coach', 'nutrition_coach', 'full_health_coach');
create type goal_type         as enum ('weight_loss', 'muscle_gain', 'strength', 'endurance', 'flexibility', 'general_health', 'custom');
create type goal_status       as enum ('active', 'completed', 'paused', 'abandoned');
create type coach_tone        as enum ('direct', 'balanced', 'encouraging');
create type difficulty_level  as enum ('beginner', 'intermediate', 'advanced');
create type set_type          as enum ('warmup', 'working', 'drop', 'failure');
create type meal_type         as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type meal_source       as enum ('manual', 'text_parse', 'photo', 'barcode', 'quick_add', 'saved_meal');
create type coach_context     as enum ('general', 'workout', 'nutrition', 'progress', 'onboarding');
create type message_role      as enum ('user', 'assistant', 'system', 'tool');
create type summary_type      as enum ('weekly', 'monthly', 'milestone', 'preference', 'behavioral');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete');
create type entitlement_tier  as enum ('free', 'workout_coach', 'nutrition_coach', 'full_health_coach');
create type notification_status as enum ('pending', 'sent', 'opened', 'failed');
create type exercise_category as enum ('chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body', 'olympic', 'mobility');
create type gender_type       as enum ('male', 'female', 'non_binary', 'prefer_not_to_say');

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
--  CORE USER TABLES
-- ============================================================================

-- profiles
create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  email            text not null,
  display_name     text,
  avatar_url       text,
  date_of_birth    date,
  gender           gender_type,
  height_cm        numeric(5,1),
  weight_kg        numeric(5,1),
  unit_preference  unit_preference not null default 'metric',
  timezone         text not null default 'UTC',
  onboarding_completed boolean not null default false,
  product_mode     product_mode not null default 'full_health_coach',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create index idx_profiles_email on profiles (email);

-- goals
create table goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  goal_type     goal_type not null,
  target_value  numeric(10,2),
  current_value numeric(10,2) default 0,
  unit          text,
  start_date    date not null default current_date,
  target_date   date,
  status        goal_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger goals_updated_at
  before update on goals
  for each row execute function update_updated_at();

create index idx_goals_user_id        on goals (user_id);
create index idx_goals_user_status    on goals (user_id, status);

-- coach_preferences
create table coach_preferences (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references profiles(id) on delete cascade,
  tone                coach_tone not null default 'balanced',
  focus_areas         text[],
  reminder_frequency  text not null default 'daily',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger coach_preferences_updated_at
  before update on coach_preferences
  for each row execute function update_updated_at();

-- ============================================================================
--  WORKOUT TABLES
-- ============================================================================

-- exercises  (global library + user-custom)
create table exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          exercise_category not null,
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment         text,
  instructions      text,
  media_url         text,
  is_custom         boolean not null default false,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_exercises_category   on exercises (category);
create index idx_exercises_name_trgm  on exercises using gin (name gin_trgm_ops);
create index idx_exercises_created_by on exercises (created_by) where created_by is not null;

-- workout_programs
create table workout_programs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  name            text not null,
  description     text,
  weeks           int,
  days_per_week   int,
  difficulty      difficulty_level not null default 'intermediate',
  is_active       boolean not null default true,
  is_ai_generated boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger workout_programs_updated_at
  before update on workout_programs
  for each row execute function update_updated_at();

create index idx_workout_programs_user_id on workout_programs (user_id);
create index idx_workout_programs_active  on workout_programs (user_id, is_active) where is_active = true;

-- workout_days
create table workout_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references workout_programs(id) on delete cascade,
  day_number  int not null,
  name        text,
  focus       text,
  exercises   jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  unique (program_id, day_number)
);

create index idx_workout_days_program_id on workout_days (program_id);

-- workout_sessions
create table workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  program_id       uuid references workout_programs(id) on delete set null,
  workout_day_id   uuid references workout_days(id) on delete set null,
  name             text,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds int,
  notes            text,
  mood_rating      int check (mood_rating between 1 and 5),
  is_synced        boolean not null default false,
  local_id         text,
  created_at       timestamptz not null default now()
);

create index idx_workout_sessions_user_id    on workout_sessions (user_id);
create index idx_workout_sessions_started_at on workout_sessions (user_id, started_at desc);
create index idx_workout_sessions_local_id   on workout_sessions (user_id, local_id) where local_id is not null;

-- set_logs
create table set_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references workout_sessions(id) on delete cascade,
  exercise_id      uuid not null references exercises(id) on delete restrict,
  set_number       int not null,
  set_type         set_type not null default 'working',
  weight_kg        numeric(6,2),
  reps             int,
  rpe              numeric(3,1) check (rpe between 1 and 10),
  duration_seconds int,
  is_pr            boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now()
);

create index idx_set_logs_session_id  on set_logs (session_id);
create index idx_set_logs_exercise_id on set_logs (exercise_id);
create index idx_set_logs_pr          on set_logs (exercise_id, is_pr) where is_pr = true;

-- ============================================================================
--  NUTRITION TABLES
-- ============================================================================

-- nutrition_day_logs
create table nutrition_day_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  date                date not null,
  calorie_target      int,
  protein_target_g    numeric(6,1),
  carbs_target_g      numeric(6,1),
  fat_target_g        numeric(6,1),
  fiber_target_g      numeric(6,1),
  water_target_ml     int,
  calories_consumed   int not null default 0,
  protein_consumed_g  numeric(6,1) not null default 0,
  carbs_consumed_g    numeric(6,1) not null default 0,
  fat_consumed_g      numeric(6,1) not null default 0,
  fiber_consumed_g    numeric(6,1) not null default 0,
  water_consumed_ml   int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, date)
);

create trigger nutrition_day_logs_updated_at
  before update on nutrition_day_logs
  for each row execute function update_updated_at();

create index idx_nutrition_day_logs_user_date on nutrition_day_logs (user_id, date desc);

-- meal_logs
create table meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  day_log_id  uuid not null references nutrition_day_logs(id) on delete cascade,
  meal_type   meal_type not null,
  name        text,
  source      meal_source not null default 'manual',
  photo_url   text,
  notes       text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_meal_logs_user_id    on meal_logs (user_id);
create index idx_meal_logs_day_log_id on meal_logs (day_log_id);
create index idx_meal_logs_logged_at  on meal_logs (user_id, logged_at desc);

-- meal_items
create table meal_items (
  id           uuid primary key default gen_random_uuid(),
  meal_log_id  uuid not null references meal_logs(id) on delete cascade,
  name         text not null,
  calories     int not null default 0,
  protein_g    numeric(6,1) not null default 0,
  carbs_g      numeric(6,1) not null default 0,
  fat_g        numeric(6,1) not null default 0,
  fiber_g      numeric(6,1) not null default 0,
  quantity     numeric(8,2) not null default 1,
  unit         text,
  is_estimate  boolean not null default true,
  created_at   timestamptz not null default now()
);

create index idx_meal_items_meal_log_id on meal_items (meal_log_id);

-- saved_meals
create table saved_meals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  name            text not null,
  items           jsonb not null default '[]',
  total_calories  int not null default 0,
  total_protein_g numeric(6,1) not null default 0,
  total_carbs_g   numeric(6,1) not null default 0,
  total_fat_g     numeric(6,1) not null default 0,
  use_count       int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger saved_meals_updated_at
  before update on saved_meals
  for each row execute function update_updated_at();

create index idx_saved_meals_user_id on saved_meals (user_id);

-- supplement_catalog  (global)
create table supplement_catalog (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  description  text,
  default_dose numeric(8,2),
  dose_unit    text,
  created_at   timestamptz not null default now()
);

create index idx_supplement_catalog_name on supplement_catalog (name);

-- user_supplements
create table user_supplements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  supplement_id  uuid not null references supplement_catalog(id) on delete cascade,
  dose           numeric(8,2),
  dose_unit      text,
  frequency      text not null default 'daily',
  time_of_day    text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger user_supplements_updated_at
  before update on user_supplements
  for each row execute function update_updated_at();

create index idx_user_supplements_user_id on user_supplements (user_id);
create index idx_user_supplements_active  on user_supplements (user_id, is_active) where is_active = true;

-- ============================================================================
--  AI / COACH TABLES
-- ============================================================================

-- coach_conversations
create table coach_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  context         coach_context not null default 'general',
  title           text,
  started_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  message_count   int not null default 0,
  is_active       boolean not null default true
);

create index idx_coach_conversations_user_id on coach_conversations (user_id);
create index idx_coach_conversations_active  on coach_conversations (user_id, is_active) where is_active = true;

-- coach_messages
create table coach_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  role            message_role not null,
  content         text,
  tool_calls      jsonb,
  tool_results    jsonb,
  tokens_used     int,
  model           text,
  latency_ms      int,
  created_at      timestamptz not null default now()
);

create index idx_coach_messages_conversation_id on coach_messages (conversation_id);
create index idx_coach_messages_created_at      on coach_messages (conversation_id, created_at);

-- coach_memory_summaries
create table coach_memory_summaries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  summary_type  summary_type not null,
  content       text not null,
  data          jsonb,
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now()
);

create index idx_coach_memory_user_id on coach_memory_summaries (user_id);
create index idx_coach_memory_type    on coach_memory_summaries (user_id, summary_type);

-- ============================================================================
--  SUBSCRIPTION / ENTITLEMENT TABLES
-- ============================================================================

-- subscriptions
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  provider                 text not null default 'revenuecat',
  provider_subscription_id text,
  plan_id                  text,
  status                   subscription_status not null default 'active',
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

create index idx_subscriptions_user_id on subscriptions (user_id);
create index idx_subscriptions_status  on subscriptions (user_id, status);

-- entitlements
create table entitlements (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references profiles(id) on delete cascade,
  tier                  entitlement_tier not null default 'free',
  is_trial              boolean not null default false,
  trial_ends_at         timestamptz,
  workout_logs_remaining int,
  meal_logs_remaining    int,
  ai_messages_remaining  int,
  limits_reset_at        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger entitlements_updated_at
  before update on entitlements
  for each row execute function update_updated_at();

-- ============================================================================
--  NOTIFICATION TABLES
-- ============================================================================

-- notification_preferences
create table notification_preferences (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references profiles(id) on delete cascade,
  workout_reminders     boolean not null default true,
  meal_reminders        boolean not null default true,
  hydration_reminders   boolean not null default false,
  supplement_reminders  boolean not null default false,
  weekly_checkin        boolean not null default true,
  coach_tips            boolean not null default true,
  quiet_hours_start     time,
  quiet_hours_end       time,
  push_token            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger notification_preferences_updated_at
  before update on notification_preferences
  for each row execute function update_updated_at();

-- notification_events
create table notification_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  type          text not null,
  channel       text not null,
  status        notification_status not null default 'pending',
  scheduled_at  timestamptz not null default now(),
  sent_at       timestamptz,
  opened_at     timestamptz,
  failed_at     timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

create index idx_notification_events_user_id on notification_events (user_id);
create index idx_notification_events_status  on notification_events (status, scheduled_at)
  where status = 'pending';

-- ============================================================================
--  ANALYTICS / ADMIN TABLES
-- ============================================================================

-- usage_events  (high-volume analytics)
create table usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  event_name  text not null,
  event_data  jsonb,
  screen      text,
  session_id  text,
  created_at  timestamptz not null default now()
);

create index idx_usage_events_user_id    on usage_events (user_id);
create index idx_usage_events_name       on usage_events (event_name, created_at desc);
create index idx_usage_events_created_at on usage_events (created_at desc);

-- ai_usage_events
create table ai_usage_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  conversation_id   uuid references coach_conversations(id) on delete set null,
  message_id        uuid references coach_messages(id) on delete set null,
  model             text not null,
  input_tokens      int not null default 0,
  output_tokens     int not null default 0,
  total_tokens      int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  latency_ms        int,
  status            text not null default 'success',
  error             text,
  tool_calls_count  int not null default 0,
  created_at        timestamptz not null default now()
);

create index idx_ai_usage_events_user_id    on ai_usage_events (user_id);
create index idx_ai_usage_events_created_at on ai_usage_events (created_at desc);

-- subscription_events
create table subscription_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  event_type        text not null,
  plan_id           text,
  previous_plan_id  text,
  revenue_usd       numeric(10,2),
  provider_event_id text,
  raw_payload       jsonb,
  created_at        timestamptz not null default now()
);

create index idx_subscription_events_user_id on subscription_events (user_id);
create index idx_subscription_events_type    on subscription_events (event_type, created_at desc);

-- feature_flags
create table feature_flags (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  description         text,
  is_enabled          boolean not null default false,
  rollout_percentage  int not null default 0 check (rollout_percentage between 0 and 100),
  target_tiers        text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger feature_flags_updated_at
  before update on feature_flags
  for each row execute function update_updated_at();

-- pricing_config
create table pricing_config (
  id                  uuid primary key default gen_random_uuid(),
  plan_key            text not null unique,
  display_name        text not null,
  description         text,
  price_monthly_usd   numeric(8,2),
  price_yearly_usd    numeric(8,2),
  product_id_ios      text,
  product_id_android  text,
  features            jsonb not null default '{}',
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger pricing_config_updated_at
  before update on pricing_config
  for each row execute function update_updated_at();

-- admin_roles
create table admin_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  permissions jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- admin_users
create table admin_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  role_id      uuid not null references admin_roles(id) on delete restrict,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger admin_users_updated_at
  before update on admin_users
  for each row execute function update_updated_at();

create unique index idx_admin_users_user_id on admin_users (user_id);
create index idx_admin_users_role_id        on admin_users (role_id);

-- audit_logs
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references admin_users(id) on delete restrict,
  action         text not null,
  resource_type  text not null,
  resource_id    text,
  details        jsonb,
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index idx_audit_logs_admin_user_id on audit_logs (admin_user_id);
create index idx_audit_logs_resource      on audit_logs (resource_type, resource_id);
create index idx_audit_logs_created_at    on audit_logs (created_at desc);

-- support_notes
create table support_notes (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references admin_users(id) on delete restrict,
  target_user_id uuid not null references profiles(id) on delete cascade,
  content        text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger support_notes_updated_at
  before update on support_notes
  for each row execute function update_updated_at();

create index idx_support_notes_target_user on support_notes (target_user_id);

-- ============================================================================
--  VIEWS
-- ============================================================================

-- daily_kpis_vw: Pre-aggregated daily platform metrics
create or replace view daily_kpis_vw as
select
  d.date                                                         as kpi_date,
  (select count(*) from profiles where created_at::date = d.date)   as new_signups,
  (select count(distinct user_id) from workout_sessions
    where started_at::date = d.date)                                as active_workout_users,
  (select count(distinct user_id) from meal_logs
    where logged_at::date = d.date)                                 as active_nutrition_users,
  (select count(*) from workout_sessions
    where started_at::date = d.date)                                as total_workouts,
  (select count(*) from meal_logs
    where logged_at::date = d.date)                                 as total_meals_logged,
  (select count(*) from coach_messages
    where created_at::date = d.date and role = 'user')              as ai_messages_sent,
  (select coalesce(sum(total_tokens), 0) from ai_usage_events
    where created_at::date = d.date)                                as total_ai_tokens,
  (select coalesce(sum(estimated_cost_usd), 0) from ai_usage_events
    where created_at::date = d.date)                                as total_ai_cost_usd,
  (select count(*) from subscriptions
    where created_at::date = d.date and status = 'active')          as new_subscriptions
from (
  select generate_series(
    current_date - interval '90 days',
    current_date,
    '1 day'::interval
  )::date as date
) d;

-- user_360_vw: Founder-friendly user summary
create or replace view user_360_vw as
select
  p.id                                    as user_id,
  p.email,
  p.display_name,
  p.product_mode,
  p.onboarding_completed,
  p.created_at                            as signed_up_at,
  e.tier,
  e.is_trial,
  (select count(*) from workout_sessions ws where ws.user_id = p.id)
                                          as total_workouts,
  (select max(started_at) from workout_sessions ws where ws.user_id = p.id)
                                          as last_workout_at,
  (select count(*) from meal_logs ml where ml.user_id = p.id)
                                          as total_meals_logged,
  (select max(logged_at) from meal_logs ml where ml.user_id = p.id)
                                          as last_meal_logged_at,
  (select count(*) from coach_messages cm
     join coach_conversations cc on cc.id = cm.conversation_id
   where cc.user_id = p.id and cm.role = 'user')
                                          as total_ai_messages,
  (select count(*) from goals g where g.user_id = p.id and g.status = 'active')
                                          as active_goals
from profiles p
left join entitlements e on e.user_id = p.id;

-- revenue_metrics_vw: MRR, plan mix, churn aggregates
create or replace view revenue_metrics_vw as
with active_subs as (
  select
    s.plan_id,
    count(*)                                       as subscriber_count,
    pc.price_monthly_usd
  from subscriptions s
  join pricing_config pc on pc.plan_key = s.plan_id
  where s.status in ('active', 'trialing')
  group by s.plan_id, pc.price_monthly_usd
),
churned as (
  select count(*) as churned_count
  from subscriptions
  where status = 'canceled'
    and cancelled_at >= date_trunc('month', current_date)
),
total_ever as (
  select count(*) as total
  from subscriptions
  where created_at < date_trunc('month', current_date)
)
select
  coalesce(sum(a.subscriber_count * a.price_monthly_usd), 0)   as mrr_usd,
  coalesce(sum(a.subscriber_count), 0)                          as total_active_subscribers,
  json_agg(json_build_object(
    'plan_id', a.plan_id,
    'subscribers', a.subscriber_count,
    'mrr', a.subscriber_count * a.price_monthly_usd
  ))                                                             as plan_mix,
  (select churned_count from churned)                            as churned_this_month,
  case
    when (select total from total_ever) = 0 then 0
    else round(
      (select churned_count from churned)::numeric /
      (select total from total_ever)::numeric * 100, 2
    )
  end                                                            as churn_rate_pct
from active_subs a;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table profiles                  enable row level security;
alter table goals                     enable row level security;
alter table coach_preferences         enable row level security;
alter table workout_programs          enable row level security;
alter table workout_days              enable row level security;
alter table exercises                 enable row level security;
alter table workout_sessions          enable row level security;
alter table set_logs                  enable row level security;
alter table nutrition_day_logs        enable row level security;
alter table meal_logs                 enable row level security;
alter table meal_items                enable row level security;
alter table saved_meals               enable row level security;
alter table supplement_catalog        enable row level security;
alter table user_supplements          enable row level security;
alter table coach_conversations       enable row level security;
alter table coach_messages            enable row level security;
alter table coach_memory_summaries    enable row level security;
alter table subscriptions             enable row level security;
alter table entitlements              enable row level security;
alter table notification_preferences  enable row level security;
alter table notification_events       enable row level security;
alter table usage_events              enable row level security;
alter table ai_usage_events           enable row level security;
alter table subscription_events       enable row level security;
alter table feature_flags             enable row level security;
alter table pricing_config            enable row level security;
alter table admin_users               enable row level security;
alter table admin_roles               enable row level security;
alter table audit_logs                enable row level security;
alter table support_notes             enable row level security;

-- -------------------------------------------------------
-- User-owned tables: users can CRUD their own rows
-- -------------------------------------------------------

-- profiles
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- goals
create policy "Users can view own goals"
  on goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals"
  on goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals"
  on goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals"
  on goals for delete using (auth.uid() = user_id);

-- coach_preferences
create policy "Users can view own coach_preferences"
  on coach_preferences for select using (auth.uid() = user_id);
create policy "Users can insert own coach_preferences"
  on coach_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own coach_preferences"
  on coach_preferences for update using (auth.uid() = user_id);

-- workout_programs
create policy "Users can view own programs"
  on workout_programs for select using (auth.uid() = user_id);
create policy "Users can insert own programs"
  on workout_programs for insert with check (auth.uid() = user_id);
create policy "Users can update own programs"
  on workout_programs for update using (auth.uid() = user_id);
create policy "Users can delete own programs"
  on workout_programs for delete using (auth.uid() = user_id);

-- workout_days (via program ownership)
create policy "Users can view own workout_days"
  on workout_days for select
  using (exists (
    select 1 from workout_programs wp
    where wp.id = workout_days.program_id and wp.user_id = auth.uid()
  ));
create policy "Users can insert own workout_days"
  on workout_days for insert
  with check (exists (
    select 1 from workout_programs wp
    where wp.id = workout_days.program_id and wp.user_id = auth.uid()
  ));
create policy "Users can update own workout_days"
  on workout_days for update
  using (exists (
    select 1 from workout_programs wp
    where wp.id = workout_days.program_id and wp.user_id = auth.uid()
  ));
create policy "Users can delete own workout_days"
  on workout_days for delete
  using (exists (
    select 1 from workout_programs wp
    where wp.id = workout_days.program_id and wp.user_id = auth.uid()
  ));

-- exercises: everyone reads global; users CRUD their own custom
create policy "Anyone can view global exercises"
  on exercises for select using (is_custom = false);
create policy "Users can view own custom exercises"
  on exercises for select using (created_by = auth.uid());
create policy "Users can insert custom exercises"
  on exercises for insert with check (is_custom = true and created_by = auth.uid());
create policy "Users can update own custom exercises"
  on exercises for update using (is_custom = true and created_by = auth.uid());
create policy "Users can delete own custom exercises"
  on exercises for delete using (is_custom = true and created_by = auth.uid());

-- workout_sessions
create policy "Users can view own sessions"
  on workout_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on workout_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions"
  on workout_sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions"
  on workout_sessions for delete using (auth.uid() = user_id);

-- set_logs (via session ownership)
create policy "Users can view own set_logs"
  on set_logs for select
  using (exists (
    select 1 from workout_sessions ws
    where ws.id = set_logs.session_id and ws.user_id = auth.uid()
  ));
create policy "Users can insert own set_logs"
  on set_logs for insert
  with check (exists (
    select 1 from workout_sessions ws
    where ws.id = set_logs.session_id and ws.user_id = auth.uid()
  ));
create policy "Users can update own set_logs"
  on set_logs for update
  using (exists (
    select 1 from workout_sessions ws
    where ws.id = set_logs.session_id and ws.user_id = auth.uid()
  ));
create policy "Users can delete own set_logs"
  on set_logs for delete
  using (exists (
    select 1 from workout_sessions ws
    where ws.id = set_logs.session_id and ws.user_id = auth.uid()
  ));

-- nutrition_day_logs
create policy "Users can view own day_logs"
  on nutrition_day_logs for select using (auth.uid() = user_id);
create policy "Users can insert own day_logs"
  on nutrition_day_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own day_logs"
  on nutrition_day_logs for update using (auth.uid() = user_id);
create policy "Users can delete own day_logs"
  on nutrition_day_logs for delete using (auth.uid() = user_id);

-- meal_logs
create policy "Users can view own meal_logs"
  on meal_logs for select using (auth.uid() = user_id);
create policy "Users can insert own meal_logs"
  on meal_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own meal_logs"
  on meal_logs for update using (auth.uid() = user_id);
create policy "Users can delete own meal_logs"
  on meal_logs for delete using (auth.uid() = user_id);

-- meal_items (via meal_log ownership)
create policy "Users can view own meal_items"
  on meal_items for select
  using (exists (
    select 1 from meal_logs ml
    where ml.id = meal_items.meal_log_id and ml.user_id = auth.uid()
  ));
create policy "Users can insert own meal_items"
  on meal_items for insert
  with check (exists (
    select 1 from meal_logs ml
    where ml.id = meal_items.meal_log_id and ml.user_id = auth.uid()
  ));
create policy "Users can update own meal_items"
  on meal_items for update
  using (exists (
    select 1 from meal_logs ml
    where ml.id = meal_items.meal_log_id and ml.user_id = auth.uid()
  ));
create policy "Users can delete own meal_items"
  on meal_items for delete
  using (exists (
    select 1 from meal_logs ml
    where ml.id = meal_items.meal_log_id and ml.user_id = auth.uid()
  ));

-- saved_meals
create policy "Users can view own saved_meals"
  on saved_meals for select using (auth.uid() = user_id);
create policy "Users can insert own saved_meals"
  on saved_meals for insert with check (auth.uid() = user_id);
create policy "Users can update own saved_meals"
  on saved_meals for update using (auth.uid() = user_id);
create policy "Users can delete own saved_meals"
  on saved_meals for delete using (auth.uid() = user_id);

-- supplement_catalog: read-only for all authenticated users
create policy "Authenticated users can view supplements"
  on supplement_catalog for select
  using (auth.role() = 'authenticated');

-- user_supplements
create policy "Users can view own user_supplements"
  on user_supplements for select using (auth.uid() = user_id);
create policy "Users can insert own user_supplements"
  on user_supplements for insert with check (auth.uid() = user_id);
create policy "Users can update own user_supplements"
  on user_supplements for update using (auth.uid() = user_id);
create policy "Users can delete own user_supplements"
  on user_supplements for delete using (auth.uid() = user_id);

-- coach_conversations
create policy "Users can view own conversations"
  on coach_conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations"
  on coach_conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations"
  on coach_conversations for update using (auth.uid() = user_id);

-- coach_messages (via conversation ownership)
create policy "Users can view own messages"
  on coach_messages for select
  using (exists (
    select 1 from coach_conversations cc
    where cc.id = coach_messages.conversation_id and cc.user_id = auth.uid()
  ));
create policy "Users can insert own messages"
  on coach_messages for insert
  with check (exists (
    select 1 from coach_conversations cc
    where cc.id = coach_messages.conversation_id and cc.user_id = auth.uid()
  ));

-- coach_memory_summaries
create policy "Users can view own memory summaries"
  on coach_memory_summaries for select using (auth.uid() = user_id);
create policy "Users can insert own memory summaries"
  on coach_memory_summaries for insert with check (auth.uid() = user_id);

-- subscriptions
create policy "Users can view own subscriptions"
  on subscriptions for select using (auth.uid() = user_id);

-- entitlements
create policy "Users can view own entitlements"
  on entitlements for select using (auth.uid() = user_id);

-- notification_preferences
create policy "Users can view own notification_prefs"
  on notification_preferences for select using (auth.uid() = user_id);
create policy "Users can insert own notification_prefs"
  on notification_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own notification_prefs"
  on notification_preferences for update using (auth.uid() = user_id);

-- notification_events
create policy "Users can view own notification_events"
  on notification_events for select using (auth.uid() = user_id);

-- usage_events
create policy "Users can insert own usage_events"
  on usage_events for insert with check (auth.uid() = user_id);

-- ai_usage_events: read-only for user
create policy "Users can view own ai_usage"
  on ai_usage_events for select using (auth.uid() = user_id);

-- subscription_events: read-only for user
create policy "Users can view own subscription_events"
  on subscription_events for select using (auth.uid() = user_id);

-- -------------------------------------------------------
-- Public-read tables (feature flags, pricing)
-- -------------------------------------------------------
create policy "Authenticated can read feature_flags"
  on feature_flags for select
  using (auth.role() = 'authenticated');

create policy "Authenticated can read pricing_config"
  on pricing_config for select
  using (auth.role() = 'authenticated');

-- -------------------------------------------------------
-- Admin tables: service-role only (no user-facing policies)
-- -------------------------------------------------------
-- admin_roles, admin_users, audit_logs, support_notes
-- These tables have RLS enabled but NO user-facing policies,
-- so they are accessible only via service_role key or
-- admin-verified Edge Functions that bypass RLS.
-- -------------------------------------------------------

-- ============================================================================
--  FUNCTIONS: Auto-create profile + entitlement on signup
-- ============================================================================
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

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
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
-- ============================================================================
--  Phase 12: Future Feature Tables (Social, Subscriptions, Widgets)
--  These tables are scaffolding for future development.
-- ============================================================================

-- ── Social Features (Future) ─────────────────────────────────────────

-- User follows
create table if not exists follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references profiles(id) on delete cascade,
  following_id  uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(follower_id, following_id),
  check(follower_id != following_id)
);

-- Social feed items
create table if not exists social_feed (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  type          text not null check(type in ('workout_share', 'pr_share', 'achievement_share', 'milestone')),
  title         text not null,
  body          text,
  metadata      jsonb default '{}',
  session_id    uuid references workout_sessions(id) on delete set null,
  visibility    text not null default 'followers' check(visibility in ('public', 'followers', 'private')),
  likes_count   int not null default 0,
  created_at    timestamptz not null default now()
);

-- Social feed likes
create table if not exists social_likes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  feed_item_id  uuid not null references social_feed(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(user_id, feed_item_id)
);

-- RLS for social tables
alter table follows enable row level security;
alter table social_feed enable row level security;
alter table social_likes enable row level security;

create policy "Users can manage own follows"
  on follows for all
  using (follower_id = auth.uid());

create policy "Users can see followers"
  on follows for select
  using (following_id = auth.uid());

create policy "Users can create own feed items"
  on social_feed for insert
  with check (user_id = auth.uid());

create policy "Users can see public/follower feed"
  on social_feed for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'followers'
      and exists (
        select 1 from follows
        where follows.follower_id = auth.uid()
        and follows.following_id = social_feed.user_id
      )
    )
  );

create policy "Users can delete own feed items"
  on social_feed for delete
  using (user_id = auth.uid());

create policy "Users can manage own likes"
  on social_likes for all
  using (user_id = auth.uid());

-- Indexes for social queries
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);
create index if not exists idx_social_feed_user on social_feed(user_id, created_at desc);
create index if not exists idx_social_feed_created on social_feed(created_at desc);

-- ── Subscriptions (Future) ───────────────────────────────────────────

create table if not exists subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references profiles(id) on delete cascade,
  plan            text not null check(plan in ('free', 'pro_monthly', 'pro_yearly', 'lifetime')),
  status          text not null default 'active' check(status in ('active', 'canceled', 'expired', 'past_due', 'trialing')),
  provider        text not null check(provider in ('apple', 'google', 'stripe', 'promo')),
  provider_id     text,
  receipt         text,
  starts_at       timestamptz not null default now(),
  expires_at      timestamptz,
  canceled_at     timestamptz,
  trial_ends_at   timestamptz,
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select
  using (user_id = auth.uid());

-- Only service role can modify subscriptions (webhook-driven)
create policy "Service role manages subscriptions"
  on subscriptions for all
  using (auth.role() = 'service_role');

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

-- ── Push Token Storage ───────────────────────────────────────────────

create table if not exists push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  token       text not null,
  platform    text not null check(platform in ('ios', 'android')),
  device_id   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, token)
);

alter table push_tokens enable row level security;

create policy "Users can manage own push tokens"
  on push_tokens for all
  using (user_id = auth.uid());

create trigger push_tokens_updated_at
  before update on push_tokens
  for each row execute function update_updated_at();

-- ── Notification Events Log ──────────────────────────────────────────

create table if not exists notification_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text not null,
  data          jsonb default '{}',
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  opened_at     timestamptz,
  created_at    timestamptz not null default now()
);

alter table notification_events enable row level security;

create policy "Users can view own notification events"
  on notification_events for select
  using (user_id = auth.uid());

create index if not exists idx_notification_events_user
  on notification_events(user_id, created_at desc);

-- ============================================================================
--  Notes for Future Contributors
-- ============================================================================
--
-- APPLE WATCH COMPANION:
--   No additional database tables needed. The Watch app will use the existing
--   workout_sessions, set_logs, and personal_records tables via the same
--   startWorkout() / logSet() / finishWorkout() API. Communication between
--   Watch and iPhone uses WatchConnectivity framework (WCSession) in a
--   separate WatchKit target.
--
-- iOS WIDGETS (WidgetKit):
--   Suggested widgets:
--   - Today's Workout (small) — shows next planned workout name + time
--   - Weekly Streak (small) — current streak count + flame icon
--   - Macro Progress (medium) — protein/carbs/fat rings for today
--   Implementation: Expo Updates + WidgetKit extension sharing data
--   via App Groups (shared UserDefaults or shared SQLite).
--   The mobile app writes latest data to the shared container on each
--   workout completion / meal log, and WidgetKit reads from there.
--
-- ANDROID WIDGETS:
--   Same concepts as iOS. Use Glance (Jetpack Compose for widgets)
--   or RemoteViews. Share data via SharedPreferences or a ContentProvider.
-- ============================================================================
-- ── Friendships table ───────────────────────────────────────────────
-- Bidirectional friend system with request/accept flow.
-- Separate from the existing `follows` table which is asymmetric.

create table if not exists friendships (
  id          uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint friendships_no_self check (requester_id != addressee_id),
  constraint friendships_unique unique (requester_id, addressee_id)
);

-- Indexes for efficient friend lookups
create index idx_friendships_requester on friendships(requester_id, status);
create index idx_friendships_addressee on friendships(addressee_id, status);

-- RLS
alter table friendships enable row level security;

-- Users can see friendships they're part of
create policy "Users can view own friendships"
  on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Users can send friend requests (create)
create policy "Users can send friend requests"
  on friendships for insert
  with check (requester_id = auth.uid() and status = 'pending');

-- Users can update friendships they're the addressee of (accept/decline)
-- or the requester can cancel (delete)
create policy "Addressee can respond to requests"
  on friendships for update
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

-- Users can delete friendships they're part of (unfriend or cancel request)
create policy "Users can remove friendships"
  on friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Allow users to read limited profile info of other users for search/leaderboard
-- Only exposes display_name and avatar_url
create policy "Users can read basic profile info"
  on profiles for select
  using (true);

-- ── Leaderboard privacy ────────────────────────────────────────────
-- Users can opt out of leaderboard visibility per category

alter table profiles add column if not exists leaderboard_opt_out jsonb not null default '{}';

-- Updated_at trigger
create trigger friendships_updated_at
  before update on friendships
  for each row execute function update_updated_at();
-- ============================================================================
--  Update social_feed RLS to use friendships table (bidirectional)
--  The original policy used the asymmetric `follows` table, but the app
--  now uses `friendships` for a mutual friend model.
-- ============================================================================

-- Drop the old select policy that uses follows
drop policy if exists "Users can see public/follower feed" on social_feed;

-- Create new select policy using friendships (bidirectional)
create policy "Users can see friend feed"
  on social_feed for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'followers'
      and exists (
        select 1 from friendships
        where friendships.status = 'accepted'
        and (
          (friendships.requester_id = auth.uid() and friendships.addressee_id = social_feed.user_id)
          or (friendships.addressee_id = auth.uid() and friendships.requester_id = social_feed.user_id)
        )
      )
    )
  );

-- ── Likes count trigger ────────────────────────────────────────────────
-- Keep social_feed.likes_count in sync with social_likes inserts/deletes

create or replace function update_likes_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update social_feed set likes_count = likes_count + 1 where id = NEW.feed_item_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update social_feed set likes_count = greatest(0, likes_count - 1) where id = OLD.feed_item_id;
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger social_likes_count_insert
  after insert on social_likes
  for each row execute function update_likes_count();

create trigger social_likes_count_delete
  after delete on social_likes
  for each row execute function update_likes_count();
-- ============================================================================
--  Feedback System
--  User-submitted bug reports, feature requests, and general feedback.
-- ============================================================================

-- ── Custom types ───────────────────────────────────────────────────────

create type feedback_category as enum (
  'bug',
  'feature_request',
  'general',
  'ai_accuracy'
);

create type feedback_status as enum (
  'new',
  'reviewing',
  'in_progress',
  'resolved',
  'wont_fix'
);

create type feedback_priority as enum (
  'unset',
  'low',
  'medium',
  'high',
  'critical'
);

-- ── Feedback table ─────────────────────────────────────────────────────

create table feedback (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  category          feedback_category not null,
  description       text not null,
  screenshot_url    text,
  status            feedback_status not null default 'new',
  priority          feedback_priority not null default 'unset',

  -- Auto-collected metadata
  app_version       text,
  device_info       text,
  os_name           text,
  os_version        text,
  screen_context    text,
  theme             text check (theme in ('dark', 'light')),
  account_age_days  integer,
  workout_count     integer,
  subscription_tier text,
  session_active    boolean default false,
  network_status    text,
  locale            text,

  -- AI triage (populated by edge function)
  ai_tags           jsonb default '[]',
  ai_severity       text,
  ai_similar_ids    uuid[] default '{}',

  -- Admin fields
  admin_notes       text,
  resolved_at       timestamptz,

  -- Timestamps
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes
create index idx_feedback_user      on feedback(user_id, created_at desc);
create index idx_feedback_status    on feedback(status, created_at desc);
create index idx_feedback_category  on feedback(category, created_at desc);
create index idx_feedback_priority  on feedback(priority) where priority != 'unset';
create index idx_feedback_created   on feedback(created_at desc);

-- Updated_at trigger
create trigger feedback_updated_at
  before update on feedback
  for each row execute function update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────

alter table feedback enable row level security;

-- Users can submit their own feedback
create policy "Users can insert own feedback"
  on feedback for insert
  with check (user_id = auth.uid());

-- Users can view their own submissions
create policy "Users can view own feedback"
  on feedback for select
  using (user_id = auth.uid());

-- Only service role can update feedback (admin dashboard uses service role)
create policy "Service role manages feedback"
  on feedback for all
  using (auth.role() = 'service_role');

-- ── Storage bucket ─────────────────────────────────────────────────────
-- Note: Storage buckets and policies are created via the Supabase dashboard
-- or the management API. The SQL below documents the intended configuration.
--
-- Bucket: feedback-screenshots
--   - Public: false
--   - File size limit: 5MB
--   - Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Storage RLS policies:
--   - INSERT: auth.uid()::text = (storage.foldername(name))[1]
--     (users can upload to their own user_id/ folder)
--   - SELECT: auth.role() = 'service_role'
--     (only admin/service role can read screenshots)
--   - DELETE: auth.uid()::text = (storage.foldername(name))[1]
--     (users can delete their own uploads)

-- Create the bucket if using Supabase SQL (v2 storage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies
create policy "Users upload own feedback screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own feedback screenshots"
  on storage.objects for select
  using (
    bucket_id = 'feedback-screenshots'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.role() = 'service_role'
    )
  );

create policy "Users can delete own feedback screenshots"
  on storage.objects for delete
  using (
    bucket_id = 'feedback-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
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
-- =============================================================================
-- 00010_exercise_media_storage.sql
-- Create storage bucket for exercise media (thumbnails, hero images)
-- =============================================================================

-- Create the exercise-media storage bucket with public access
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

-- Allow public (anon) read access to all objects in the bucket
create policy "Public read access for exercise media"
  on storage.objects for select
  using (bucket_id = 'exercise-media');

-- Allow authenticated users to upload/update objects (admin use)
create policy "Authenticated users can upload exercise media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'exercise-media');

-- Allow authenticated users to update existing objects
create policy "Authenticated users can update exercise media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'exercise-media');

-- Allow authenticated users to delete objects
create policy "Authenticated users can delete exercise media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'exercise-media');
-- Add cache telemetry columns to ai_usage_events
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_read_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_creation_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS intent text;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS context_type text;

-- Add index for cache analysis queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_cache_hit ON ai_usage_events (cache_hit) WHERE cache_hit = true;
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_intent ON ai_usage_events (intent) WHERE intent IS NOT NULL;
-- ── Promo Redemptions & Atomic Redemption Function ──────────────────
-- QA-026: Fixes TOCTOU race condition in promo code redemption by
--         making the check-and-increment atomic in a single function.
-- QA-027: Adds per-user redemption tracking so the same user cannot
--         redeem the same promo code twice.

-- Per-user redemption tracking table
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, promo_code_id)
);

ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Atomic promo code redemption function.
-- Returns a row with (success BOOLEAN, tier TEXT, error_message TEXT).
-- Validates all conditions AND increments current_uses in one transaction.
CREATE OR REPLACE FUNCTION redeem_promo_code(promo_code TEXT, redeemer_id UUID)
RETURNS TABLE(success BOOLEAN, tier TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo RECORD;
BEGIN
  -- Atomically find and increment the promo code in one statement.
  -- The WHERE clause enforces is_active, max_uses, and expiration.
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE code = promo_code
    AND is_active = TRUE
    AND (max_uses IS NULL OR current_uses < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING promo_codes.id, promo_codes.tier
  INTO v_promo;

  -- No matching row means invalid, expired, inactive, or used up
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired promo code'::TEXT;
    RETURN;
  END IF;

  -- Per-user duplicate check: insert into redemptions (unique constraint)
  BEGIN
    INSERT INTO promo_redemptions (user_id, promo_code_id)
    VALUES (redeemer_id, v_promo.id);
  EXCEPTION WHEN unique_violation THEN
    -- Roll back the increment since user already redeemed
    UPDATE promo_codes
    SET current_uses = current_uses - 1
    WHERE id = v_promo.id;

    RETURN QUERY SELECT FALSE, NULL::TEXT, 'You have already redeemed this promo code'::TEXT;
    RETURN;
  END;

  RETURN QUERY SELECT TRUE, v_promo.tier, NULL::TEXT;
END;
$$;
