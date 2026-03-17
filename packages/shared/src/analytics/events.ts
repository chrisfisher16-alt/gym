// ── Auth Events ──────────────────────────────────────────────────────

export const AUTH_EVENTS = {
  SIGN_UP: 'auth.sign_up',
  SIGN_IN: 'auth.sign_in',
  SIGN_OUT: 'auth.sign_out',
} as const;

// ── Onboarding Events ────────────────────────────────────────────────

export const ONBOARDING_EVENTS = {
  ONBOARDING_STARTED: 'onboarding.started',
  ONBOARDING_COMPLETED: 'onboarding.completed',
  PRODUCT_MODE_SELECTED: 'onboarding.product_mode_selected',
} as const;

// ── Workout Events ───────────────────────────────────────────────────

export const WORKOUT_EVENTS = {
  WORKOUT_STARTED: 'workout.started',
  SET_LOGGED: 'workout.set_logged',
  WORKOUT_COMPLETED: 'workout.completed',
  PR_ACHIEVED: 'workout.pr_achieved',
  PROGRAM_CREATED: 'workout.program_created',
  EXERCISE_CREATED: 'workout.exercise_created',
} as const;

// ── Nutrition Events ─────────────────────────────────────────────────

export const NUTRITION_EVENTS = {
  MEAL_LOGGED: 'nutrition.meal_logged',
  MEAL_PHOTO_REVIEWED: 'nutrition.meal_photo_reviewed',
  QUICK_ADD_USED: 'nutrition.quick_add_used',
  SAVED_MEAL_USED: 'nutrition.saved_meal_used',
  SUPPLEMENT_TRACKED: 'nutrition.supplement_tracked',
} as const;

// ── Coach Events ─────────────────────────────────────────────────────

export const COACH_EVENTS = {
  COACH_MESSAGE_SENT: 'coach.message_sent',
  COACH_CONVERSATION_STARTED: 'coach.conversation_started',
  COACH_TOOL_USED: 'coach.tool_used',
} as const;

// ── Subscription Events ──────────────────────────────────────────────

export const SUBSCRIPTION_EVENTS = {
  PAYWALL_VIEWED: 'subscription.paywall_viewed',
  SUBSCRIPTION_STARTED: 'subscription.started',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RESTORED: 'subscription.restored',
  UPGRADE_PROMPT_SHOWN: 'subscription.upgrade_prompt_shown',
  FREE_LIMIT_REACHED: 'subscription.free_limit_reached',
} as const;

// ── Notification Events ──────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  NOTIFICATION_SCHEDULED: 'notification.scheduled',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_OPENED: 'notification.opened',
  NOTIFICATION_DISABLED: 'notification.disabled',
} as const;

// ── Health Events ────────────────────────────────────────────────────

export const HEALTH_EVENTS = {
  HEALTH_PERMISSION_GRANTED: 'health.permission_granted',
  HEALTH_SYNC_ENABLED: 'health.sync_enabled',
  HEALTH_SYNC_COMPLETED: 'health.sync_completed',
} as const;

// ── Navigation Events ────────────────────────────────────────────────

export const NAVIGATION_EVENTS = {
  TAB_VIEWED: 'navigation.tab_viewed',
  SCREEN_VIEWED: 'navigation.screen_viewed',
} as const;

// ── All Events ───────────────────────────────────────────────────────

export const ANALYTICS_EVENTS = {
  ...AUTH_EVENTS,
  ...ONBOARDING_EVENTS,
  ...WORKOUT_EVENTS,
  ...NUTRITION_EVENTS,
  ...COACH_EVENTS,
  ...SUBSCRIPTION_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...HEALTH_EVENTS,
  ...NAVIGATION_EVENTS,
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ── Analytics Event Type ─────────────────────────────────────────────

export interface AnalyticsEvent {
  event_name: AnalyticsEventName;
  event_data?: Record<string, unknown>;
  screen?: string;
  timestamp: string;
}

// ── Track Event Signature ────────────────────────────────────────────

export type TrackEventFn = (
  eventName: AnalyticsEventName,
  eventData?: Record<string, unknown>,
  screen?: string,
) => void;

export function trackEvent(
  eventName: AnalyticsEventName,
  eventData?: Record<string, unknown>,
  screen?: string,
): AnalyticsEvent {
  return {
    event_name: eventName,
    event_data: eventData,
    screen,
    timestamp: new Date().toISOString(),
  };
}
