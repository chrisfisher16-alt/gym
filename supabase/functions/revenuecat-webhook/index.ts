import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

// ── Types ─────────────────────────────────────────────────────────────

interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: string;
    id: string;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    period_type: string; // 'TRIAL' | 'NORMAL' | 'INTRO'
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string; // 'SANDBOX' | 'PRODUCTION'
    store: string; // 'APP_STORE' | 'PLAY_STORE'
    is_family_share: boolean;
    takehome_percentage: number;
    price_in_purchased_currency: number;
    currency: string;
    cancel_reason?: string;
    new_product_id?: string;
  };
}

type EntitlementTier = 'free' | 'workout_coach' | 'nutrition_coach' | 'full_health_coach';

// ── Entitlement Mapping ───────────────────────────────────────────────

function mapEntitlementToTier(entitlementIds: string[]): EntitlementTier {
  if (entitlementIds.includes('full_health_coach')) return 'full_health_coach';
  if (entitlementIds.includes('workout_coach')) return 'workout_coach';
  if (entitlementIds.includes('nutrition_coach')) return 'nutrition_coach';
  return 'free';
}

function mapPlatform(store: string): 'ios' | 'android' | 'web' {
  if (store === 'APP_STORE') return 'ios';
  if (store === 'PLAY_STORE') return 'android';
  return 'web';
}

// ── Main Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Verify webhook authorization
  const authHeader = req.headers.get('Authorization');
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return errorResponse('Unauthorized', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse('Server configuration error', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: RevenueCatWebhookEvent;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { event } = body;
  const userId = event.app_user_id;
  const eventType = event.type;

  console.log(`[RevenueCat Webhook] Event: ${eventType} | User: ${userId} | Product: ${event.product_id}`);

  try {
    // Log the event
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: mapEventType(eventType),
      plan_id: event.product_id,
      previous_plan_id: null,
      revenue_usd: event.price_in_purchased_currency ?? null,
      raw_payload: body,
      created_at: new Date().toISOString(),
    });

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'NON_RENEWING_PURCHASE': {
        const tier = mapEntitlementToTier(event.entitlement_ids);
        await upsertSubscription(supabase, {
          userId,
          status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
          tier,
          platform: mapPlatform(event.store),
          productId: event.product_id,
          startedAt: new Date(event.purchased_at_ms).toISOString(),
          expiresAt: event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null,
        });
        await updateEntitlement(supabase, userId, tier);
        break;
      }

      case 'RENEWAL': {
        const tier = mapEntitlementToTier(event.entitlement_ids);
        await upsertSubscription(supabase, {
          userId,
          status: 'active',
          tier,
          platform: mapPlatform(event.store),
          productId: event.product_id,
          startedAt: new Date(event.purchased_at_ms).toISOString(),
          expiresAt: event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null,
        });
        await updateEntitlement(supabase, userId, tier);
        break;
      }

      case 'CANCELLATION': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        break;
      }

      case 'EXPIRATION': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        await updateEntitlement(supabase, userId, 'free');
        break;
      }

      case 'BILLING_ISSUE': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        break;
      }

      case 'PRODUCT_CHANGE': {
        const newTier = mapEntitlementToTier(event.entitlement_ids);
        await upsertSubscription(supabase, {
          userId,
          status: 'active',
          tier: newTier,
          platform: mapPlatform(event.store),
          productId: event.new_product_id ?? event.product_id,
          startedAt: new Date(event.purchased_at_ms).toISOString(),
          expiresAt: event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null,
        });
        await updateEntitlement(supabase, userId, newTier);
        break;
      }

      case 'SUBSCRIBER_ALIAS':
      case 'TRANSFER': {
        // Log only, no action needed
        break;
      }

      default: {
        console.log(`[RevenueCat Webhook] Unhandled event type: ${eventType}`);
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error(`[RevenueCat Webhook] Error processing ${eventType}:`, error);
    return errorResponse('Internal server error', 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────

function mapEventType(
  rcEventType: string,
): 'started' | 'renewed' | 'cancelled' | 'expired' | 'restored' | 'upgraded' | 'downgraded' {
  switch (rcEventType) {
    case 'INITIAL_PURCHASE':
    case 'NON_RENEWING_PURCHASE':
      return 'started';
    case 'RENEWAL':
      return 'renewed';
    case 'CANCELLATION':
      return 'cancelled';
    case 'EXPIRATION':
      return 'expired';
    case 'PRODUCT_CHANGE':
      return 'upgraded';
    default:
      return 'started';
  }
}

interface SubscriptionUpsert {
  userId: string;
  status: string;
  tier: EntitlementTier;
  platform: 'ios' | 'android' | 'web';
  productId: string;
  startedAt: string;
  expiresAt: string | null;
}

async function upsertSubscription(
  supabase: ReturnType<typeof createClient>,
  data: SubscriptionUpsert,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: data.userId,
        status: data.status,
        provider: 'revenuecat',
        plan_id: data.productId,
        current_period_start: data.startedAt,
        current_period_end: data.expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[RevenueCat Webhook] Upsert subscription error:', error);
  }
}

async function updateEntitlement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tier: EntitlementTier,
): Promise<void> {
  const limits = {
    free: { workout_logs_per_month: 10, meal_logs_per_day: 3, ai_messages_per_day: 5 },
    workout_coach: { workout_logs_per_month: -1, meal_logs_per_day: 3, ai_messages_per_day: 50 },
    nutrition_coach: { workout_logs_per_month: 10, meal_logs_per_day: -1, ai_messages_per_day: 50 },
    full_health_coach: { workout_logs_per_month: -1, meal_logs_per_day: -1, ai_messages_per_day: -1 },
  };

  const entitlementLimits = limits[tier];
  const { error } = await supabase
    .from('entitlements')
    .upsert(
      {
        user_id: userId,
        tier,
        workout_logs_remaining: entitlementLimits.workout_logs_per_month,
        meal_logs_remaining: entitlementLimits.meal_logs_per_day,
        ai_messages_remaining: entitlementLimits.ai_messages_per_day,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[RevenueCat Webhook] Update entitlement error:', error);
  }
}
