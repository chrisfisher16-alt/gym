import { useCallback } from 'react';
import { router } from 'expo-router';
import { useSubscriptionStore } from '../stores/subscription-store';
import {
  canAccessFeature,
  type FeatureKey,
  FEATURE_REQUIRED_PLAN,
  PLANS,
} from '../lib/pricing-config';

export interface PaywallActions {
  showPaywall: (options?: { feature?: FeatureKey; source?: string }) => void;
  requireFeature: (feature: FeatureKey, onAllowed: () => void) => void;
  isLoading: boolean;
}

export function usePaywall(): PaywallActions {
  const tier = useSubscriptionStore((s) => s.tier);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const showPaywall = useCallback(
    (options?: { feature?: FeatureKey; source?: string }) => {
      const params: Record<string, string> = {};
      if (options?.feature) {
        params.feature = options.feature;
        params.requiredPlan = FEATURE_REQUIRED_PLAN[options.feature];
      }
      if (options?.source) {
        params.source = options.source;
      }
      router.push({ pathname: '/paywall', params });
    },
    [],
  );

  const requireFeature = useCallback(
    (feature: FeatureKey, onAllowed: () => void) => {
      if (canAccessFeature(tier, feature)) {
        onAllowed();
      } else {
        showPaywall({ feature });
      }
    },
    [tier, showPaywall],
  );

  return {
    showPaywall,
    requireFeature,
    isLoading,
  };
}
