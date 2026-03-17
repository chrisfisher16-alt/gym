import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-auth';

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  target_tiers: string[];
  updated_at: string;
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('feature_flags')
    .select('id, key, description, is_enabled, rollout_percentage, target_tiers, updated_at')
    .order('key', { ascending: true });

  return (data ?? []) as FeatureFlag[];
}

export async function updateFeatureFlag(
  adminUserId: string,
  flagId: string,
  updates: { is_enabled?: boolean; rollout_percentage?: number }
): Promise<void> {
  const sb = createServiceClient();

  // Get current state for audit
  const { data: current } = await sb
    .from('feature_flags')
    .select('key, is_enabled, rollout_percentage')
    .eq('id', flagId)
    .single();

  await sb
    .from('feature_flags')
    .update(updates)
    .eq('id', flagId);

  await logAdminAction(
    adminUserId,
    'config.update',
    'feature_flag',
    flagId,
    { previous: current, updates }
  );
}

export interface PricingConfig {
  id: string;
  plan_key: string;
  display_name: string;
  description: string | null;
  price_monthly_usd: number | null;
  price_yearly_usd: number | null;
  product_id_ios: string | null;
  product_id_android: string | null;
  features: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export async function getPricingConfig(): Promise<PricingConfig[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('pricing_config')
    .select('*')
    .order('sort_order', { ascending: true });

  return (data ?? []) as PricingConfig[];
}

export async function updatePricingConfig(
  adminUserId: string,
  configId: string,
  updates: { price_monthly_usd?: number; price_yearly_usd?: number; is_active?: boolean }
): Promise<void> {
  const sb = createServiceClient();

  const { data: current } = await sb
    .from('pricing_config')
    .select('plan_key, price_monthly_usd, price_yearly_usd, is_active')
    .eq('id', configId)
    .single();

  await sb
    .from('pricing_config')
    .update(updates)
    .eq('id', configId);

  await logAdminAction(
    adminUserId,
    'config.update',
    'pricing_config',
    configId,
    { previous: current, updates }
  );
}
