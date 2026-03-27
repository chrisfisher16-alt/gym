-- Leaderboard scores RPC: aggregates workout stats across users for the compete leaderboard.
-- SECURITY DEFINER to bypass RLS on set_logs / workout_sessions (which restrict to own data).

CREATE OR REPLACE FUNCTION get_leaderboard_scores(
  p_user_ids UUID[],
  p_metric   TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date   TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(user_id UUID, score NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Safety check: calling user must be in the requested user list
  IF NOT (auth.uid() = ANY(p_user_ids)) THEN
    RAISE EXCEPTION 'Caller must be included in p_user_ids';
  END IF;

  IF p_metric = 'volume' THEN
    RETURN QUERY
      SELECT ws.user_id,
             COALESCE(SUM(COALESCE(sl.weight_kg, 0) * COALESCE(sl.reps, 0)), 0)::NUMERIC AS score
        FROM workout_sessions ws
        LEFT JOIN set_logs sl ON sl.session_id = ws.id AND sl.set_type != 'warmup'
       WHERE ws.user_id = ANY(p_user_ids)
         AND ws.completed_at IS NOT NULL
         AND (p_start_date IS NULL OR ws.completed_at >= p_start_date)
         AND ws.completed_at <= p_end_date
       GROUP BY ws.user_id;

  ELSIF p_metric = 'workouts' THEN
    RETURN QUERY
      SELECT ws.user_id,
             COUNT(DISTINCT ws.id)::NUMERIC AS score
        FROM workout_sessions ws
       WHERE ws.user_id = ANY(p_user_ids)
         AND ws.completed_at IS NOT NULL
         AND (p_start_date IS NULL OR ws.completed_at >= p_start_date)
         AND ws.completed_at <= p_end_date
       GROUP BY ws.user_id;

  ELSIF p_metric = 'streak' THEN
    -- Consecutive days backwards from today with at least one completed workout
    RETURN QUERY
      WITH user_workout_dates AS (
        SELECT ws.user_id,
               DATE(ws.completed_at AT TIME ZONE 'UTC') AS workout_date
          FROM workout_sessions ws
         WHERE ws.user_id = ANY(p_user_ids)
           AND ws.completed_at IS NOT NULL
         GROUP BY ws.user_id, DATE(ws.completed_at AT TIME ZONE 'UTC')
      ),
      numbered AS (
        SELECT uwd.user_id,
               uwd.workout_date,
               uwd.workout_date - (ROW_NUMBER() OVER (
                 PARTITION BY uwd.user_id ORDER BY uwd.workout_date DESC
               ))::INT AS grp
          FROM user_workout_dates uwd
         WHERE uwd.workout_date >= CURRENT_DATE - 365
      ),
      streaks AS (
        SELECT n.user_id,
               COUNT(*)::NUMERIC AS streak_len,
               MAX(n.workout_date) AS streak_end
          FROM numbered n
         GROUP BY n.user_id, n.grp
      )
      SELECT s.user_id,
             s.streak_len AS score
        FROM streaks s
       WHERE s.streak_end >= CURRENT_DATE - 1  -- streak must include today or yesterday
       ORDER BY s.user_id;

  ELSIF p_metric = 'prs' THEN
    RETURN QUERY
      SELECT ws.user_id,
             COUNT(*)::NUMERIC AS score
        FROM set_logs sl
        JOIN workout_sessions ws ON ws.id = sl.session_id
       WHERE ws.user_id = ANY(p_user_ids)
         AND sl.is_pr = true
         AND ws.completed_at IS NOT NULL
         AND (p_start_date IS NULL OR ws.completed_at >= p_start_date)
         AND ws.completed_at <= p_end_date
       GROUP BY ws.user_id;

  ELSIF p_metric = 'consistency' THEN
    RETURN QUERY
      SELECT ws.user_id,
             (COUNT(DISTINCT DATE(ws.completed_at))::NUMERIC
              / GREATEST(1, EXTRACT(DAY FROM p_end_date - p_start_date))::NUMERIC
              * 100) AS score
        FROM workout_sessions ws
       WHERE ws.user_id = ANY(p_user_ids)
         AND ws.completed_at IS NOT NULL
         AND (p_start_date IS NULL OR ws.completed_at >= p_start_date)
         AND ws.completed_at <= p_end_date
       GROUP BY ws.user_id;

  ELSE
    RAISE EXCEPTION 'Unknown metric: %', p_metric;
  END IF;
END;
$$;
