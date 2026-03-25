// ── Notification Bootstrap ────────────────────────────────────────
// One-time setup that should run when the native app mounts:
//   1. Register notification categories (action buttons)
//   2. Re-sync scheduled reminders from persisted preferences
//   3. Set up response listener for tap-to-navigate
//   4. Handle cold-start deep link (app was killed, user tapped notification)

import { Platform } from 'react-native';
import { router } from 'expo-router';
import { setupNotificationCategories, getRouteForNotificationType } from './notifications';
import { useNotificationStore } from '../stores/notification-store';
import type { NotificationData } from '../types/notifications';

let bootstrapped = false;

// Lazily load expo-notifications — deferred to first use so a missing
// native module (e.g. PushNotificationIOS) doesn't crash the app on startup.
let _Notifications: typeof import('expo-notifications') | null = null;
let _notificationsLoaded = false;

function getNotifications() {
  if (!_notificationsLoaded && Platform.OS !== 'web') {
    _notificationsLoaded = true;
    try {
      _Notifications = require('expo-notifications');
    } catch (e) {
      console.warn('expo-notifications not available:', e);
      _Notifications = null;
    }
  }
  return _Notifications;
}

/**
 * Shared handler for notification responses — used by both the live
 * listener and the cold-start check.
 */
function handleNotificationResponse(
  response: import('expo-notifications').NotificationResponse,
): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const data = response.notification.request.content.data as NotificationData | undefined;
  if (!data?.type) return;

  const actionId = response.actionIdentifier;

  // ── Workout reminders ──
  if (
    data.type === 'workout_reminder' &&
    (actionId === 'start_workout' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)
  ) {
    router.push('/(tabs)/workout');
    return;
  }
  // "15 min later" snooze — dismiss silently, no navigation
  if (data.type === 'workout_reminder' && actionId === 'snooze_15') {
    return;
  }

  // ── Meal reminders ──
  if (
    data.type === 'meal_reminder' &&
    (actionId === 'log_meal' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)
  ) {
    router.push('/nutrition/log-meal');
    return;
  }
  // "Skip" — dismiss silently, no navigation
  if (data.type === 'meal_reminder' && actionId === 'skip_meal') {
    return;
  }

  // ── Hydration reminders ──
  if (data.type === 'hydration_reminder' && actionId === 'log_water') {
    // Quick-log 8 oz of water directly from the notification action button
    try {
      const { useNutritionStore } = require('../stores/nutrition-store');
      useNutritionStore.getState().logWater(8);
    } catch {}
    return;
  }

  // ── All other notification types ──
  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    const route = getRouteForNotificationType(data.type);
    router.push(route as any);
  }
}

/**
 * Call once from the root layout after native init.
 * Idempotent — repeated calls are no-ops.
 */
export async function bootstrapNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (bootstrapped || Platform.OS === 'web' || !Notifications) return;

  // 1. Register action-button categories (meal_reminder, workout_reminder, etc.)
  await setupNotificationCategories();

  // 2. Re-sync scheduled notifications from persisted preferences.
  //    This ensures reminders survive app restarts — the OS may have cleared
  //    scheduled notifications, and the store holds the source of truth.
  const store = useNotificationStore.getState();
  if (store.preferences.permissionStatus === 'granted') {
    await store.syncReminders();
  }

  // Mark as bootstrapped only after categories + sync have completed successfully.
  bootstrapped = true;

  // 3. Handle notification taps / action button presses → navigate (while app is running)
  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

  // 4. Cold-start deep link: if the app was fully killed and the user tapped
  //    a notification to launch it, the listener above won't catch it.
  //    Check for the last response that launched the app.
  try {
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      // Small delay to let Expo Router mount before we navigate
      setTimeout(() => handleNotificationResponse(lastResponse), 500);
    }
  } catch {
    // getLastNotificationResponseAsync can fail on some Android builds — non-critical
  }
}
