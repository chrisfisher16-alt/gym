import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import type { EntitlementTier } from '@health-coach/shared';
import { ENTITLEMENT_IDS } from './pricing-config';

// ── Lazy-load native module (crashes on web) ─────────────────────────

// RevenueCat native module interface — loaded dynamically, null on web
interface RevenueCatModule {
  setLogLevel(level: unknown): void;
  configure(opts: { apiKey: string }): void;
  getOfferings(): Promise<PurchasesOfferings>;
  purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases(): Promise<CustomerInfo>;
  getCustomerInfo(): Promise<CustomerInfo>;
  logIn(userId: string): Promise<unknown>;
  logOut(): Promise<unknown>;
}

let Purchases: RevenueCatModule | null = null;
let LOG_LEVEL: Record<string, unknown> = {};

if (Platform.OS !== 'web') {
  try {
    const mod = require('react-native-purchases');
    Purchases = mod.default;
    LOG_LEVEL = mod.LOG_LEVEL;
  } catch (e) { console.warn('[RevenueCat] module unavailable:', e); }
}

// ── Configuration ─────────────────────────────────────────────────────

const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';

let isConfigured = false;

// ── Initialize ────────────────────────────────────────────────────────

export async function initRevenueCat(): Promise<boolean> {
  if (!Purchases) return false;

  const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;

  if (!apiKey) {
    return false;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey });
    isConfigured = true;
    return true;
  } catch (error) {
    console.warn('[RevenueCat] Failed to initialize:', error);
    return false;
  }
}

// ── Offerings ─────────────────────────────────────────────────────────

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!isConfigured || !Purchases) return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn('[RevenueCat] Failed to fetch offerings:', error);
    return null;
  }
}

// ── Purchase ──────────────────────────────────────────────────────────

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  if (!isConfigured || !Purchases) {
    return { success: false, error: 'RevenueCat not configured' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo };
  } catch (error: unknown) {
    const err = error as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: err.message ?? 'Purchase failed' };
  }
}

// ── Restore Purchases ─────────────────────────────────────────────────

export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isConfigured || !Purchases) {
    return { success: false, error: 'RevenueCat not configured' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message ?? 'Restore failed' };
  }
}

// ── Customer Info ─────────────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured || !Purchases) return null;

  try {
    const info = await Purchases.getCustomerInfo();
    return info;
  } catch (error) {
    console.warn('[RevenueCat] Failed to get customer info:', error);
    return null;
  }
}

// ── Entitlement Check ─────────────────────────────────────────────────

export function checkEntitlement(
  customerInfo: CustomerInfo,
  entitlementId: string,
): boolean {
  return (
    customerInfo.entitlements.active[entitlementId] !== undefined
  );
}

// ── Map to EntitlementTier ────────────────────────────────────────────

export function mapRevenueCatToTier(customerInfo: CustomerInfo): EntitlementTier {
  if (checkEntitlement(customerInfo, ENTITLEMENT_IDS.full_health_coach)) {
    return 'full_health_coach';
  }
  if (checkEntitlement(customerInfo, ENTITLEMENT_IDS.workout_coach)) {
    return 'workout_coach';
  }
  if (checkEntitlement(customerInfo, ENTITLEMENT_IDS.nutrition_coach)) {
    return 'nutrition_coach';
  }
  return 'free';
}

// ── Check if trial ────────────────────────────────────────────────────

export function getTrialInfo(customerInfo: CustomerInfo): {
  isTrial: boolean;
  trialEndsAt: Date | null;
} {
  const entitlementIds = [
    ENTITLEMENT_IDS.full_health_coach,
    ENTITLEMENT_IDS.workout_coach,
    ENTITLEMENT_IDS.nutrition_coach,
  ];

  for (const id of entitlementIds) {
    const entitlement = customerInfo.entitlements.active[id];
    if (entitlement) {
      const periodType = entitlement.periodType;
      if (periodType === 'TRIAL') {
        return {
          isTrial: true,
          trialEndsAt: entitlement.expirationDate
            ? new Date(entitlement.expirationDate)
            : null,
        };
      }
    }
  }

  return { isTrial: false, trialEndsAt: null };
}

// ── Identify User ─────────────────────────────────────────────────────

export async function identifyUser(userId: string): Promise<void> {
  if (!isConfigured || !Purchases) return;

  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.warn('[RevenueCat] Failed to identify user:', error);
  }
}

// ── Logout ────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  if (!isConfigured || !Purchases) return;

  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn('[RevenueCat] Failed to logout:', error);
  }
}

// ── Status ────────────────────────────────────────────────────────────

export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}
