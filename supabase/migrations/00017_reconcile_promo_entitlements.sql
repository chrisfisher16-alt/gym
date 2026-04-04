-- ── Reconcile promo redemptions with entitlements ────────────────────
-- Users who redeemed promo codes before migration 00015 (which added
-- the entitlements upsert to redeem_promo_code) still have tier='free'
-- in the entitlements table. This backfills them.

UPDATE entitlements e
SET tier = pc.tier::entitlement_tier,
    is_trial = false,
    trial_ends_at = null,
    updated_at = now()
FROM promo_redemptions pr
JOIN promo_codes pc ON pc.id = pr.promo_code_id
WHERE pr.user_id = e.user_id
  AND e.tier = 'free'
  AND pc.is_active = true;
