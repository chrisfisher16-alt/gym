import { useCallback } from 'react';
import { useSubscriptionStore } from '../stores/subscription-store';
import {
  canAccessFeature,
  type FeatureKey,
  FEATURE_ACCESS,
} from '../lib/pricing-config';
import type { EntitlementTier } from '@health-coach/shared';

export interface EntitlementInfo {
  tier: EntitlementTier;
  isSubscribed: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  canAccess: (feature: FeatureKey) => boolean;
  tierName: string;
}

const TIER_DISPLAY_NAMES: Record<EntitlementTier, string> = {
  free: 'Free',
  workout_coach: 'Workout Coach',
  nutrition_coach: 'Nutrition Coach',
  full_health_coach: 'Full Health Coach',
};

export function useEntitlement(): EntitlementInfo {
  const tier = useSubscriptionStore((s) => s.tier);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const isTrial = useSubscriptionStore((s) => s.isTrial);
  const trialEndsAt = useSubscriptionStore((s) => s.trialEndsAt);

  const canAccess = useCallback(
    (feature: FeatureKey): boolean => {
      return canAccessFeature(tier, feature);
    },
    [tier],
  );

  return {
    tier,
    isSubscribed,
    isTrial,
    trialEndsAt,
    canAccess,
    tierName: TIER_DISPLAY_NAMES[tier],
  };
}
