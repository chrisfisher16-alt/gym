-- ── Seed FISHER25 promo code ──────────────────────────────────────────
-- Grants full_health_coach tier, up to 100 uses, no expiration.

INSERT INTO promo_codes (code, tier, is_active, max_uses, current_uses)
VALUES ('FISHER25', 'full_health_coach', true, 100, 0)
ON CONFLICT DO NOTHING;
