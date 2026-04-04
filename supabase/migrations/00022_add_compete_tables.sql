-- Compete feature tables: challenges, participants, invite links
-- Friendships already exist in 00005_friendships.sql
-- Social feed already exists in 00004_phase12_future_features.sql

-- ── Challenges ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('volume', 'workouts', 'streak', 'prs', 'consistency')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Creator can do everything
CREATE POLICY challenges_creator_all ON challenges
  FOR ALL USING (auth.uid() = creator_id);

-- Participants can read challenges they're in
CREATE POLICY challenges_participant_select ON challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = challenges.id
      AND challenge_participants.user_id = auth.uid()
    )
  );

-- ── Challenge Participants ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  score NUMERIC NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Users can read their own participations
CREATE POLICY cp_select_own ON challenge_participants
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read other participants in challenges they're in
CREATE POLICY cp_select_co_participants ON challenge_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenge_participants AS my
      WHERE my.challenge_id = challenge_participants.challenge_id
      AND my.user_id = auth.uid()
    )
  );

-- Users can update their own participation (accept/decline)
CREATE POLICY cp_update_own ON challenge_participants
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Challenge creator can insert participants
CREATE POLICY cp_insert_creator ON challenge_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM challenges
      WHERE challenges.id = challenge_participants.challenge_id
      AND challenges.creator_id = auth.uid()
    )
  );

-- ── Invite Links ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES profiles(id),
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Inviter can create and read own links
CREATE POLICY invite_links_inviter ON invite_links
  FOR ALL USING (auth.uid() = inviter_id);

-- Anyone authenticated can read a link by code (for redemption)
CREATE POLICY invite_links_redeem ON invite_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Anyone authenticated can update (redeem) an unredeemed link
CREATE POLICY invite_links_update_redeem ON invite_links
  FOR UPDATE USING (redeemed_by IS NULL AND auth.uid() IS NOT NULL)
  WITH CHECK (redeemed_by = auth.uid());

-- ── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX idx_challenges_creator ON challenges(creator_id);
CREATE INDEX idx_challenges_status ON challenges(status) WHERE status = 'active';
CREATE INDEX idx_cp_challenge ON challenge_participants(challenge_id);
CREATE INDEX idx_cp_user ON challenge_participants(user_id);
CREATE INDEX idx_invite_code ON invite_links(code);
