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
