import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntitlementTier, PricingConfig } from '@health-coach/shared';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import {
  initRevenueCat,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  mapRevenueCatToTier,
  getTrialInfo,
  identifyUser,
  logout as rcLogout,
  isRevenueCatConfigured,
} from '../lib/revenuecat';
import { isDevMode, getDevSubscription, onDevSubscriptionChange } from '../lib/dev-subscription';
import { mapPricingConfig, PLANS } from '../lib/pricing-config';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth-store';

// ── Types ─────────────────────────────────────────────────────────────

interface SubscriptionState {
  tier: EntitlementTier;
  isSubscribed: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  currentPlan: PricingConfig | null;
  offerings: PurchasesOfferings | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: (userId?: string) => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; error?: string }>;
  applyPromoCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  checkEntitlements: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  isSubscribed: false,
  isTrial: false,
  trialEndsAt: null,
  currentPlan: null,
  offerings: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async (userId) => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    // Restore persisted promo grant (if any)
    try {
      const raw = await AsyncStorage.getItem('formiq_promo_grant');
      if (raw) {
        const grant = JSON.parse(raw) as {
          tier: EntitlementTier;
          code: string;
          grantedAt?: number;
          expiresAt?: number;
        };

        // Check if the promo grant has expired
        if (grant.expiresAt && Date.now() > grant.expiresAt) {
          await AsyncStorage.removeItem('formiq_promo_grant');
          // Fall through to normal initialization below
        } else {
          const plan = mapPricingConfig(grant.tier as Exclude<EntitlementTier, 'free'>);
          set({
            tier: grant.tier,
            isSubscribed: true,
            isTrial: false,
            trialEndsAt: null,
            currentPlan: plan,
            isLoading: false,
            isInitialized: true,
          });
          return;
        }
      }
    } catch {}

    // Check Supabase entitlements table as source of truth
    try {
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        const { data: entitlement } = await supabase
          .from('entitlements')
          .select('tier, is_trial, trial_ends_at')
          .eq('user_id', userId)
          .single();

        if (entitlement && entitlement.tier !== 'free') {
          const plan = mapPricingConfig(entitlement.tier as Exclude<EntitlementTier, 'free'>);
          set({
            tier: entitlement.tier as EntitlementTier,
            isSubscribed: true,
            isTrial: entitlement.is_trial ?? false,
            trialEndsAt: entitlement.trial_ends_at ? new Date(entitlement.trial_ends_at) : null,
            currentPlan: plan,
            isLoading: false,
            isInitialized: true,
          });
          return;
        }
      }
    } catch {
      // Supabase query failed, continue to other sources
    }

    try {
      // In dev mode without RevenueCat, use dev mock
      if (isDevMode() && !isRevenueCatConfigured()) {
        const devState = getDevSubscription();
        const plan =
          devState.tier !== 'free'
            ? mapPricingConfig(devState.tier as Exclude<EntitlementTier, 'free'>)
            : null;

        set({
          tier: devState.tier,
          isSubscribed: devState.tier !== 'free',
          isTrial: devState.isTrial,
          trialEndsAt: devState.trialEndsAt,
          currentPlan: plan,
          isLoading: false,
          isInitialized: true,
        });

        // Listen for dev subscription changes
        onDevSubscriptionChange((state) => {
          const devPlan =
            state.tier !== 'free'
              ? mapPricingConfig(state.tier as Exclude<EntitlementTier, 'free'>)
              : null;
          set({
            tier: state.tier,
            isSubscribed: state.tier !== 'free',
            isTrial: state.isTrial,
            trialEndsAt: state.trialEndsAt,
            currentPlan: devPlan,
          });
        });

        return;
      }

      // Initialize RevenueCat
      const configured = await initRevenueCat();

      if (configured && userId) {
        await identifyUser(userId);
      }

      if (configured) {
        // Fetch offerings and customer info in parallel
        const [offerings, customerInfo] = await Promise.all([
          getOfferings(),
          getCustomerInfo(),
        ]);

        let tier: EntitlementTier = 'free';
        let isTrial = false;
        let trialEndsAt: Date | null = null;

        if (customerInfo) {
          tier = mapRevenueCatToTier(customerInfo);
          const trialInfo = getTrialInfo(customerInfo);
          isTrial = trialInfo.isTrial;
          trialEndsAt = trialInfo.trialEndsAt;
        }

        const plan =
          tier !== 'free'
            ? mapPricingConfig(tier as Exclude<EntitlementTier, 'free'>)
            : null;

        set({
          tier,
          isSubscribed: tier !== 'free',
          isTrial,
          trialEndsAt,
          currentPlan: plan,
          offerings,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        // RevenueCat not configured (dev mode)
        set({ isLoading: false, isInitialized: true });
      }
    } catch (error) {
      console.warn('[SubscriptionStore] Initialization error:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  purchase: async (pkg) => {
    set({ isLoading: true, error: null });

    try {
      const result = await purchasePackage(pkg);

      if (result.success && result.customerInfo) {
        const tier = mapRevenueCatToTier(result.customerInfo);
        const trialInfo = getTrialInfo(result.customerInfo);
        const plan =
          tier !== 'free'
            ? mapPricingConfig(tier as Exclude<EntitlementTier, 'free'>)
            : null;

        set({
          tier,
          isSubscribed: tier !== 'free',
          isTrial: trialInfo.isTrial,
          trialEndsAt: trialInfo.trialEndsAt,
          currentPlan: plan,
          isLoading: false,
        });

        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: result.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  restore: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await restorePurchases();

      if (result.success && result.customerInfo) {
        const tier = mapRevenueCatToTier(result.customerInfo);
        const trialInfo = getTrialInfo(result.customerInfo);
        const plan =
          tier !== 'free'
            ? mapPricingConfig(tier as Exclude<EntitlementTier, 'free'>)
            : null;

        set({
          tier,
          isSubscribed: tier !== 'free',
          isTrial: trialInfo.isTrial,
          trialEndsAt: trialInfo.trialEndsAt,
          currentPlan: plan,
          isLoading: false,
        });

        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: result.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  applyPromoCode: async (code) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: { code: code.trim().toUpperCase() },
      });

      if (error) {
        return { success: false, error: 'Failed to validate promo code' };
      }
      if (!data?.success) {
        return { success: false, error: data?.error ?? 'Invalid promo code' };
      }

      const plan = mapPricingConfig(data.tier as Exclude<EntitlementTier, 'free'>);

      set({
        tier: data.tier,
        isSubscribed: true,
        isTrial: false,
        trialEndsAt: null,
        currentPlan: plan,
      });

      // Persist promo grant so it survives app restart (expires after 30 days)
      const PROMO_GRANT_DAYS = 30;
      AsyncStorage.setItem(
        'formiq_promo_grant',
        JSON.stringify({
          tier: data.tier,
          code: code.trim().toUpperCase(),
          grantedAt: Date.now(),
          expiresAt: Date.now() + PROMO_GRANT_DAYS * 24 * 60 * 60 * 1000,
        }),
      ).catch(() => {});

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to validate promo code' };
    }
  },

  checkEntitlements: async () => {
    try {
      const customerInfo = await getCustomerInfo();
      if (!customerInfo) return;

      const tier = mapRevenueCatToTier(customerInfo);
      const trialInfo = getTrialInfo(customerInfo);
      const plan =
        tier !== 'free'
          ? mapPricingConfig(tier as Exclude<EntitlementTier, 'free'>)
          : null;

      set({
        tier,
        isSubscribed: tier !== 'free',
        isTrial: trialInfo.isTrial,
        trialEndsAt: trialInfo.trialEndsAt,
        currentPlan: plan,
      });
    } catch (error) {
      console.warn('[SubscriptionStore] Check entitlements error:', error);
    }
  },

  refreshStatus: async () => {
    set({ isLoading: true });
    await get().checkEntitlements();
    set({ isLoading: false });
  },

  logout: async () => {
    await rcLogout();
    await AsyncStorage.removeItem('formiq_promo_grant').catch(() => {});
    set({
      tier: 'free',
      isSubscribed: false,
      isTrial: false,
      trialEndsAt: null,
      currentPlan: null,
      offerings: null,
      isInitialized: false,
    });
  },

  clearError: () => set({ error: null }),
}));
