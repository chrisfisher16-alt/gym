// ── Observability ────────────────────────────────────────────────────
// Thin abstraction over Sentry (errors) and PostHog (product analytics).
//
// Both SDKs are gated on environment variables so the app runs fine in
// dev without them. All public functions are safe to call before
// `initObservability()` completes — they no-op until the SDKs are ready.
//
// Environment variables:
//   EXPO_PUBLIC_SENTRY_DSN   — required to enable Sentry
//   EXPO_PUBLIC_POSTHOG_KEY  — required to enable PostHog
//   EXPO_PUBLIC_POSTHOG_HOST — optional, defaults to EU/US host chosen by SDK

import { Platform } from 'react-native';

type SentryModule = typeof import('@sentry/react-native');
type PostHogModule = typeof import('posthog-react-native');

let sentry: SentryModule | null = null;
let posthogClient: import('posthog-react-native').PostHog | null = null;
let initialized = false;

// ── Init ────────────────────────────────────────────────────────────

export async function initObservability(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;

  if (sentryDsn && Platform.OS !== 'web') {
    try {
      sentry = require('@sentry/react-native') as SentryModule;
      sentry.init({
        dsn: sentryDsn,
        enableAutoSessionTracking: true,
        tracesSampleRate: 0.1,
        environment: __DEV__ ? 'development' : 'production',
      });
    } catch (e) {
      if (__DEV__) console.warn('Sentry init failed:', e);
      sentry = null;
    }
  }

  if (posthogKey) {
    try {
      const mod = require('posthog-react-native') as PostHogModule;
      posthogClient = new mod.PostHog(posthogKey, {
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
        disabled: __DEV__,
      });
      await posthogClient.ready?.();
    } catch (e) {
      if (__DEV__) console.warn('PostHog init failed:', e);
      posthogClient = null;
    }
  }
}

// ── Error reporting ─────────────────────────────────────────────────

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (sentry) {
    try {
      sentry.captureException(error, context ? { extra: context } : undefined);
    } catch {
      // Sentry failed — fall through to console
    }
  }
  if (__DEV__ || !sentry) {
    console.error('[observability]', error, context ?? '');
  }
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): void {
  if (sentry) {
    try {
      sentry.captureMessage(message, {
        level,
        extra: context,
      });
    } catch {
      // swallow
    }
  }
  if (__DEV__ || !sentry) {
    const fn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    fn('[observability]', message, context ?? '');
  }
}

// ── Analytics ───────────────────────────────────────────────────────

type JsonProps = Record<string, string | number | boolean | null>;

/**
 * Coerce arbitrary props to PostHog's JSON-friendly shape. Values that
 * aren't JSON-primitive get stringified so we never block a track() call
 * on a slight type mismatch. Undefined values are dropped.
 */
function sanitizeProps(props: Record<string, unknown> | undefined): JsonProps | undefined {
  if (!props) return undefined;
  const out: JsonProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!posthogClient) return;
  try {
    posthogClient.capture(event, sanitizeProps(properties));
  } catch {
    // swallow
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (sentry) {
    try {
      sentry.setUser({ id: userId, ...(traits ? { data: traits } : {}) });
    } catch {
      // swallow
    }
  }
  if (posthogClient) {
    try {
      posthogClient.identify(userId, sanitizeProps(traits));
    } catch {
      // swallow
    }
  }
}

export function resetUser(): void {
  if (sentry) {
    try {
      sentry.setUser(null);
    } catch {
      // swallow
    }
  }
  if (posthogClient) {
    try {
      posthogClient.reset();
    } catch {
      // swallow
    }
  }
}

// ── Testing helper ──────────────────────────────────────────────────

/** Exposed for test scaffolding only. */
export function __resetForTests(): void {
  sentry = null;
  posthogClient = null;
  initialized = false;
}
