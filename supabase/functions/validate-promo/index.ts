// ── Validate Promo Code Edge Function ────────────────────────────────
// Atomically validates and redeems a promo code via the redeem_promo_code
// Postgres function.  Uses service_role so the table stays hidden from
// unauthenticated clients.
//
// QA-026: Atomic check-and-increment eliminates TOCTOU race condition.
// QA-027: Per-user redemption tracking prevents duplicate redemptions.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabaseAdmin } = await verifyAuth(req);

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return errorResponse('Promo code is required', 400);
    }

    const normalizedCode = code.trim().toUpperCase();

    // Atomic redemption: validates, increments, and records per-user usage
    // in a single Postgres transaction via the redeem_promo_code function.
    const { data, error } = await supabaseAdmin
      .rpc('redeem_promo_code', {
        promo_code: normalizedCode,
        redeemer_id: user_id,
      });

    if (error) {
      console.error('redeem_promo_code RPC error:', error);
      return errorResponse('Failed to validate promo code', 500);
    }

    const result = data?.[0] ?? data;

    if (!result?.success) {
      return jsonResponse({
        success: false,
        error: result?.error_message ?? 'Invalid promo code',
      });
    }

    return jsonResponse({ success: true, tier: result.tier });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Validate promo error:', error);
    return errorResponse('Failed to validate promo code', 500);
  }
});
