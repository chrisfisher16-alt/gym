-- Usage tracking for free tier enforcement
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usage_type text NOT NULL CHECK (usage_type IN ('workout_logs', 'meal_logs', 'ai_messages')),
  period text NOT NULL, -- 'YYYY-MM' for monthly, 'YYYY-MM-DD' for daily
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, usage_type, period)
);

-- RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_usage_tracking_lookup ON usage_tracking(user_id, usage_type, period);

-- Atomic check-and-increment RPC
-- Returns: { allowed: boolean, remaining: integer, used: integer, limit: integer }
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_usage_type text,
  p_limit integer,
  p_period text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_period text;
  v_current integer;
  v_allowed boolean;
BEGIN
  -- Determine period based on type
  IF p_period IS NOT NULL THEN
    v_period := p_period;
  ELSIF p_usage_type = 'workout_logs' THEN
    v_period := to_char(now(), 'YYYY-MM');
  ELSE
    v_period := to_char(now(), 'YYYY-MM-DD');
  END IF;

  -- Atomic upsert + check
  INSERT INTO usage_tracking (user_id, usage_type, period, count, updated_at)
  VALUES (v_user_id, p_usage_type, v_period, 1, now())
  ON CONFLICT (user_id, usage_type, period)
  DO UPDATE SET
    count = usage_tracking.count + 1,
    updated_at = now()
  WHERE usage_tracking.count < p_limit
  RETURNING count INTO v_current;

  -- If no row was affected (limit reached), get current count
  IF v_current IS NULL THEN
    SELECT count INTO v_current
    FROM usage_tracking
    WHERE user_id = v_user_id AND usage_type = p_usage_type AND period = v_period;
    v_current := COALESCE(v_current, 0);
    v_allowed := false;
  ELSE
    v_allowed := true;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'used', v_current,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_current)
  );
END;
$$;

-- Read-only check (no increment)
CREATE OR REPLACE FUNCTION check_usage(
  p_usage_type text,
  p_limit integer,
  p_period text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_period text;
  v_current integer;
BEGIN
  IF p_period IS NOT NULL THEN
    v_period := p_period;
  ELSIF p_usage_type = 'workout_logs' THEN
    v_period := to_char(now(), 'YYYY-MM');
  ELSE
    v_period := to_char(now(), 'YYYY-MM-DD');
  END IF;

  SELECT count INTO v_current
  FROM usage_tracking
  WHERE user_id = v_user_id AND usage_type = p_usage_type AND period = v_period;

  v_current := COALESCE(v_current, 0);

  RETURN jsonb_build_object(
    'allowed', v_current < p_limit,
    'used', v_current,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_current)
  );
END;
$$;
