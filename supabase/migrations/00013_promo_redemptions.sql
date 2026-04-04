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
