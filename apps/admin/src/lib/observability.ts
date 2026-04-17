// ── Observability (Admin) ────────────────────────────────────────────
// Lightweight wrapper around PostHog for the admin portal. Sentry for
// Next.js is tracked as deferred work (see docs/DECISIONS.md) — the
// Next.js 16 peer-dep window for @sentry/nextjs isn't settled yet.

'use client';

import posthog from 'posthog-js';

let initialized = false;

/**
 * Initialize PostHog once per browser session. Safe to call from any
 * client component — a no-op if already initialized or if the env var
 * is missing.
 */
export function initAdminAnalytics(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    // Admin portal is internal — don't session-record by default
    session_recording: { maskAllInputs: true },
  });
  initialized = true;
}

export function trackAdminEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.capture(event, properties);
}

export function identifyAdmin(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.identify(userId, traits);
}
