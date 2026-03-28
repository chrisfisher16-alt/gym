import { useMemo } from 'react';
import type { EntitlementTier } from '@health-coach/shared';
import { useSubscriptionStore } from '../stores/subscription-store';
import { PLANS, type PlanDisplayPrices } from '../lib/pricing-config';

type PaidTier = Exclude<EntitlementTier, 'free'>;

/**
 * Maps RevenueCat offerings to localized display prices per plan.
 *
 * Apple requires that all prices shown in the app come from StoreKit
 * (via RevenueCat `product.priceString`). This hook reads the offerings
 * already fetched by the subscription store and extracts the per-plan
 * price strings.
 *
 * While offerings are loading (or unavailable in dev), the caller should
 * fall back to the placeholder values in `pricing-config.ts`.
 */
export function useOfferingPrices(): {
  /** Localized prices keyed by plan ID. `null` while loading / unavailable. */
  prices: Record<PaidTier, PlanDisplayPrices> | null;
  /** `true` while the subscription store is still initializing. */
  isLoadingPrices: boolean;
} {
  const offerings = useSubscriptionStore((s) => s.offerings);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const isInitialized = useSubscriptionStore((s) => s.isInitialized);

  const prices = useMemo(() => {
    if (!offerings?.current) return null;

    const packages = offerings.current.availablePackages;
    if (!packages || packages.length === 0) return null;

    const result: Partial<Record<PaidTier, PlanDisplayPrices>> = {};
    const planIds: PaidTier[] = ['workout_coach', 'nutrition_coach', 'full_health_coach'];

    for (const planId of planIds) {
      const monthlyPkg = packages.find(
        (p) => p.product.identifier === `hc_${planId}_monthly`,
      );
      const annualPkg = packages.find(
        (p) => p.product.identifier === `hc_${planId}_annual`,
      );

      if (monthlyPkg || annualPkg) {
        // Compute monthly equivalent from annual price if available
        let monthlyEquivalent: string | null = null;
        if (annualPkg) {
          const annualPrice = annualPkg.product.price;
          if (annualPrice > 0) {
            const monthlyFromAnnual = annualPrice / 12;
            // Use the currency symbol from the annual priceString
            const currencySymbol = annualPkg.product.priceString.replace(/[\d.,\s]/g, '').trim() || '$';
            monthlyEquivalent = `${currencySymbol}${monthlyFromAnnual.toFixed(2)}/mo`;
          }
        }

        result[planId] = {
          monthly: monthlyPkg
            ? `${monthlyPkg.product.priceString}/mo`
            : PLANS[planId].price,
          yearly: annualPkg
            ? `${annualPkg.product.priceString}/yr`
            : PLANS[planId].priceYearly,
          monthlyEquivalent,
        };
      }
    }

    // Only return if we resolved at least one plan
    const resolved = Object.keys(result).length;
    if (resolved === 0) return null;

    // Fill any missing plans with fallback values so the record is complete
    for (const planId of planIds) {
      if (!result[planId]) {
        result[planId] = {
          monthly: PLANS[planId].price,
          yearly: PLANS[planId].priceYearly,
          monthlyEquivalent: PLANS[planId].monthlyEquivalent ?? null,
        };
      }
    }

    return result as Record<PaidTier, PlanDisplayPrices>;
  }, [offerings]);

  return {
    prices,
    isLoadingPrices: !isInitialized || isLoading,
  };
}
