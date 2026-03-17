import type { EntitlementTier } from '@health-coach/shared';

// ── Development Subscription Mock ─────────────────────────────────────
// Only active in __DEV__ mode. Allows toggling between tiers for testing.

interface DevSubscriptionState {
  tier: EntitlementTier;
  isTrial: boolean;
  trialEndsAt: Date | null;
}

let devState: DevSubscriptionState = {
  tier: 'free',
  isTrial: false,
  trialEndsAt: null,
};

let listeners: Array<(state: DevSubscriptionState) => void> = [];

export function isDevMode(): boolean {
  return __DEV__;
}

export function getDevSubscription(): DevSubscriptionState {
  return { ...devState };
}

export function setDevTier(tier: EntitlementTier): void {
  if (!__DEV__) return;

  devState = {
    tier,
    isTrial: false,
    trialEndsAt: null,
  };

  notifyListeners();
  console.log(`[DevSubscription] Tier set to: ${tier}`);
}

export function setDevTrial(tier: EntitlementTier, daysRemaining: number): void {
  if (!__DEV__) return;

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + daysRemaining);

  devState = {
    tier,
    isTrial: true,
    trialEndsAt: trialEnd,
  };

  notifyListeners();
  console.log(`[DevSubscription] Trial set: ${tier}, ends in ${daysRemaining} days`);
}

export function resetDevSubscription(): void {
  if (!__DEV__) return;

  devState = {
    tier: 'free',
    isTrial: false,
    trialEndsAt: null,
  };

  notifyListeners();
  console.log('[DevSubscription] Reset to free');
}

export function onDevSubscriptionChange(
  listener: (state: DevSubscriptionState) => void,
): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners(): void {
  const state = getDevSubscription();
  listeners.forEach((l) => l(state));
}
