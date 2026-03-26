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

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own subscription' and tablename = 'subscriptions') then
    create policy "Users can view own subscription" on subscriptions for select using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Service role manages subscriptions' and tablename = 'subscriptions') then
    create policy "Service role manages subscriptions" on subscriptions for all using (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists subscriptions_updated_at on subscriptions;
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
