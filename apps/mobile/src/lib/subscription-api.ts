// ── Subscription API Stubs (Future) ──────────────────────────────
// These stubs define the API surface for subscription management.
// Currently the app uses RevenueCat (react-native-purchases) for
// in-app purchases. These stubs are for server-side subscription
// verification and management.

import { supabase, isSupabaseConfigured } from './supabase';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  interval: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

/** Check the current user's subscription status */
export async function checkSubscription() {
  if (!isSupabaseConfigured) {
    return { plan: 'free', status: 'active', features: getFreeTierFeatures() };
  }

  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return { plan: 'free', status: 'active', features: getFreeTierFeatures() };

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .single();

  if (!data) {
    return { plan: 'free', status: 'active', features: getFreeTierFeatures() };
  }

  return {
    plan: data.plan,
    status: data.status,
    expiresAt: data.expires_at,
    features: getFeaturesForPlan(data.plan),
  };
}

/** Get available subscription plans */
export async function getAvailablePlans(): Promise<SubscriptionPlan[]> {
  return [
    {
      id: 'pro_monthly',
      name: 'FormIQ Pro Monthly',
      price: '$9.99/month',
      interval: 'monthly',
      features: [
        'Unlimited AI coaching conversations',
        'Advanced analytics and insights',
        'Program recommendations',
        'Data export (JSON/CSV)',
        'Custom themes',
        'Priority support',
      ],
    },
    {
      id: 'pro_yearly',
      name: 'FormIQ Pro Yearly',
      price: '$59.99/year',
      interval: 'yearly',
      features: [
        'Everything in Pro Monthly',
        'Save 50% vs monthly',
        'Early access to new features',
      ],
    },
    {
      id: 'lifetime',
      name: 'FormIQ Lifetime',
      price: '$149.99',
      interval: 'lifetime',
      features: [
        'Everything in Pro, forever',
        'No recurring payments',
        'Founding member badge',
      ],
    },
  ];
}

function getFreeTierFeatures(): string[] {
  return [
    'Core workout logging',
    'Nutrition logging and macro tracking',
    'Basic progress charts',
    'PR tracking',
    'Health integrations',
  ];
}

function getFeaturesForPlan(plan: string): string[] {
  const free = getFreeTierFeatures();
  const pro = [
    ...free,
    'Unlimited AI coaching',
    'Advanced analytics',
    'Program recommendations',
    'Data export',
    'Custom themes',
  ];

  switch (plan) {
    case 'pro_monthly':
    case 'pro_yearly':
      return pro;
    case 'lifetime':
      return [...pro, 'Founding member badge'];
    default:
      return free;
  }
}
