import type { EntitlementTier, PricingConfig } from '@health-coach/shared';

// ── Plan Definitions (Config-Driven) ──────────────────────────────────

export interface PlanConfig {
  id: EntitlementTier;
  name: string;
  price: string;
  priceYearly: string;
  monthlyEquivalent?: string;
  features: string[];
  highlight: boolean;
  badge?: string;
}

export const PLANS: Record<Exclude<EntitlementTier, 'free'>, PlanConfig> = {
  workout_coach: {
    id: 'workout_coach',
    name: 'Workout Coach',
    price: '$1.99/mo',
    priceYearly: '$19.99/yr',
    monthlyEquivalent: '$1.67/mo',
    features: [
      'Unlimited workouts',
      'AI workout planning',
      'Program builder',
      'PR tracking',
      'Advanced analytics',
    ],
    highlight: false,
  },
  nutrition_coach: {
    id: 'nutrition_coach',
    name: 'Nutrition Coach',
    price: '$1.99/mo',
    priceYearly: '$19.99/yr',
    monthlyEquivalent: '$1.67/mo',
    features: [
      'Unlimited meal logging',
      'AI meal analysis',
      'Photo food recognition',
      'Custom recipes',
      'Supplement tracking',
    ],
    highlight: false,
  },
  full_health_coach: {
    id: 'full_health_coach',
    name: 'Full Health Coach',
    price: '$2.99/mo',
    priceYearly: '$29.99/yr',
    monthlyEquivalent: '$2.50/mo',
    features: [
      'Everything in Workout + Nutrition',
      'Unlimited AI coaching',
      'Weekly summaries',
      'Health sync',
      'Priority support',
    ],
    highlight: true,
    badge: 'Best Value',
  },
};

// ── Product IDs (RevenueCat) ──────────────────────────────────────────

export const PRODUCT_IDS = {
  ios: {
    workout_coach_monthly: 'hc_workout_coach_monthly',
    workout_coach_annual: 'hc_workout_coach_annual',
    nutrition_coach_monthly: 'hc_nutrition_coach_monthly',
    nutrition_coach_annual: 'hc_nutrition_coach_annual',
    full_health_coach_monthly: 'hc_full_health_coach_monthly',
    full_health_coach_annual: 'hc_full_health_coach_annual',
  },
  android: {
    workout_coach_monthly: 'hc_workout_coach_monthly',
    workout_coach_annual: 'hc_workout_coach_annual',
    nutrition_coach_monthly: 'hc_nutrition_coach_monthly',
    nutrition_coach_annual: 'hc_nutrition_coach_annual',
    full_health_coach_monthly: 'hc_full_health_coach_monthly',
    full_health_coach_annual: 'hc_full_health_coach_annual',
  },
} as const;

// ── RevenueCat Entitlement Identifiers ────────────────────────────────

export const ENTITLEMENT_IDS = {
  workout_coach: 'workout_coach',
  nutrition_coach: 'nutrition_coach',
  full_health_coach: 'full_health_coach',
} as const;

// ── Feature Access Matrix ─────────────────────────────────────────────

export type FeatureKey =
  | 'unlimited_workouts'
  | 'unlimited_meals'
  | 'unlimited_ai'
  | 'workout_programs'
  | 'pr_tracking'
  | 'workout_analytics'
  | 'photo_analysis'
  | 'custom_recipes'
  | 'supplement_tracking'
  | 'weekly_summaries'
  | 'health_sync'
  | 'priority_support';

export const FEATURE_ACCESS: Record<FeatureKey, EntitlementTier[]> = {
  unlimited_workouts: ['workout_coach', 'full_health_coach'],
  unlimited_meals: ['nutrition_coach', 'full_health_coach'],
  unlimited_ai: ['full_health_coach'],
  workout_programs: ['workout_coach', 'full_health_coach'],
  pr_tracking: ['workout_coach', 'full_health_coach'],
  workout_analytics: ['workout_coach', 'full_health_coach'],
  photo_analysis: ['nutrition_coach', 'full_health_coach'],
  custom_recipes: ['nutrition_coach', 'full_health_coach'],
  supplement_tracking: ['nutrition_coach', 'full_health_coach'],
  weekly_summaries: ['full_health_coach'],
  health_sync: ['full_health_coach'],
  priority_support: ['full_health_coach'],
};

// ── Feature to plan mapping (for upgrade prompts) ─────────────────────

export const FEATURE_REQUIRED_PLAN: Record<FeatureKey, Exclude<EntitlementTier, 'free'>> = {
  unlimited_workouts: 'workout_coach',
  unlimited_meals: 'nutrition_coach',
  unlimited_ai: 'full_health_coach',
  workout_programs: 'workout_coach',
  pr_tracking: 'workout_coach',
  workout_analytics: 'workout_coach',
  photo_analysis: 'nutrition_coach',
  custom_recipes: 'nutrition_coach',
  supplement_tracking: 'nutrition_coach',
  weekly_summaries: 'full_health_coach',
  health_sync: 'full_health_coach',
  priority_support: 'full_health_coach',
};

// ── Feature Flags ─────────────────────────────────────────────────────

export const PRICING_FLAGS = {
  annualPricingEnabled: true,
  trialDays: 7,
  showSavingsPercentage: true,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────

export function canAccessFeature(tier: EntitlementTier, feature: FeatureKey): boolean {
  if (tier === 'free') return false;
  return FEATURE_ACCESS[feature].includes(tier);
}

export function getRequiredPlanForFeature(feature: FeatureKey): PlanConfig {
  const planId = FEATURE_REQUIRED_PLAN[feature];
  return PLANS[planId];
}

export function getPlanList(): PlanConfig[] {
  return [PLANS.workout_coach, PLANS.nutrition_coach, PLANS.full_health_coach];
}

export function mapPricingConfig(tier: Exclude<EntitlementTier, 'free'>): PricingConfig {
  const plan = PLANS[tier];
  const monthlyNum = parseFloat(plan.price.replace(/[^0-9.]/g, ''));
  const annualNum = parseFloat(plan.priceYearly.replace(/[^0-9.]/g, ''));
  return {
    id: tier,
    tier,
    monthly_price_usd: monthlyNum,
    annual_price_usd: annualNum,
    trial_days: PRICING_FLAGS.trialDays,
    features: plan.features,
    is_active: true,
  };
}
