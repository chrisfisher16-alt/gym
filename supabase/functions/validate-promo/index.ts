// ── Validate Promo Code Edge Function ────────────────────────────────
// Looks up a promo code in the promo_codes table and returns the
// associated tier if valid.  Uses service_role so the table stays
// hidden from unauthenticated clients.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabase } = await verifyAuth(req);

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return errorResponse('Promo code is required', 400);
    }

    const normalizedCode = code.trim().toUpperCase();

    // Look up the promo code (service_role bypasses RLS)
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single();

    if (error || !promo) {
      return jsonResponse({ success: false, error: 'Invalid promo code' });
    }

    // Check expiration
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return jsonResponse({ success: false, error: 'This promo code has expired' });
    }

    // Check max uses
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return jsonResponse({ success: false, error: 'This promo code has reached its limit' });
    }

    // Increment usage count
    await supabase
      .from('promo_codes')
      .update({ current_uses: promo.current_uses + 1 })
      .eq('id', promo.id);

    return jsonResponse({ success: true, tier: promo.tier });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Validate promo error:', error);
    return errorResponse('Failed to validate promo code', 500);
  }
});
