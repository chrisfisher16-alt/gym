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
