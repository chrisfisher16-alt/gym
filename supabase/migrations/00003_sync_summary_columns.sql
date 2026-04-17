-- ============================================================================
--  Client Sync Summary Columns
-- ============================================================================
--  Adds denormalized summary / payload columns so the mobile client can push
--  a workout session or meal as a single upsert. This unblocks the server-side
--  coach and weekly-summary features (which need aggregate user data) without
--  requiring full relational sync of set_logs / meal_items from the client.
--
--  Full normalized sync (exercises, set_logs, meal_items) is a separate design
--  — tracked in docs/DECISIONS.md.
-- ============================================================================

-- workout_sessions: client pushes summary + denormalized exercise/set data
alter table workout_sessions
  add column if not exists total_volume    numeric(10,2) not null default 0,
  add column if not exists total_sets      int           not null default 0,
  add column if not exists pr_count        int           not null default 0,
  add column if not exists exercises_json  jsonb,
  add column if not exists sets_json       jsonb;

-- Promote the existing (user_id, local_id) index to UNIQUE so the client
-- can upsert on local_id. The original index in 00001 was non-unique.
drop index if exists idx_workout_sessions_local_id;
create unique index if not exists workout_sessions_user_local_id_key
  on workout_sessions (user_id, local_id) where local_id is not null;

-- meal_logs: client pushes meal + items as a single denormalized payload
alter table meal_logs
  add column if not exists items_json jsonb,
  add column if not exists local_id   text,
  add column if not exists is_synced  boolean not null default false;

create unique index if not exists meal_logs_user_local_id_key
  on meal_logs (user_id, local_id) where local_id is not null;

-- nutrition_day_logs: lookup by (user_id, date) is already UNIQUE in 00001.
