'use client';

import { useEffect } from 'react';
import { initAdminAnalytics } from '../lib/observability';

/**
 * Client-side PostHog bootstrap. Mounted at the root layout so every
 * page view is tracked. Silent no-op when NEXT_PUBLIC_POSTHOG_KEY
 * is missing.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAdminAnalytics();
  }, []);

  return <>{children}</>;
}
