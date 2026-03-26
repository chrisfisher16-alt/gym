-- ── Promo Codes Table ─────────────────────────────────────────────────
-- Server-side promo code validation. Codes are validated via the
-- validate-promo edge function using service_role — no public RLS
-- policies are added, so the anon/authenticated roles cannot read or
-- modify this table directly.

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'full_health_coach',
  max_uses INTEGER DEFAULT NULL,      -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL = never expires
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the existing promo code
INSERT INTO promo_codes (code, tier) VALUES ('FISHER25', 'full_health_coach');

-- Enable RLS — no public policies means only service_role can access
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
