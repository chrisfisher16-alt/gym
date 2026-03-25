// ── Notification Service ───────────────────────────────────────────
// Core notification primitives: permissions, tokens, scheduling.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { NotificationData, NotificationType } from '../types/notifications';

// ── Lazily-loaded native module ───────────────────────────────────
// Deferred to first use so a missing native module (e.g. PushNotificationIOS
// in simulators without expo-notifications configured) doesn't crash at startup.

let _Notifications: typeof import('expo-notifications') | null = null;
let _notificationsLoaded = false;
let _handlerConfigured = false;

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
  // Configure notification handler once on first successful load
  if (_Notifications && !_handlerConfigured) {
    _handlerConfigured = true;
    _Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return _Notifications;
}

// ── Permissions ───────────────────────────────────────────────────

export async function requestPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return 'denied';
  }

  if (!Device.isDevice) {
    // Emulator/Simulator — permissions won't work but we can proceed
    console.warn('Notifications: Not a physical device, permissions may not work.');
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    return 'granted';
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    return 'granted';
  }

  return 'denied';
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return 'denied';
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

// ── Push Token ────────────────────────────────────────────────────

export async function registerPushToken(): Promise<string | null> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return token.data;
  } catch (error) {
    console.warn('Failed to get push token:', error);
    return null;
  }
}

// ── Schedule Local Notification ───────────────────────────────────

export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: any,
  data?: NotificationData,
  categoryIdentifier?: string,
): Promise<string> {
  const Notifications = getNotifications();
  if (!Notifications) return '';

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown> | undefined,
      sound: 'default',
      ...(categoryIdentifier ? { categoryIdentifier } : {}),
    },
    trigger,
  });
  return id;
}

// ── Cancel Notifications ──────────────────────────────────────────

export async function cancelNotification(id: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancel only scheduled notifications whose data.type matches the given type.
 * Returns the number of notifications cancelled.
 */
export async function cancelNotificationsByType(type: string): Promise<number> {
  const Notifications = getNotifications();
  if (!Notifications) return 0;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  let cancelled = 0;
  for (const n of all) {
    const data = n.content.data as Record<string, unknown> | undefined;
    if (data?.type === type) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
      cancelled++;
    }
  }
  return cancelled;
}

export async function getScheduledNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

// ── Notification Categories (Action Buttons) ──────────────────────

export async function setupNotificationCategories(): Promise<void> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) return;

  await Notifications.setNotificationCategoryAsync('workout_reminder', [
    {
      identifier: 'start_workout',
      buttonTitle: "Let's Go!",
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'snooze_15',
      buttonTitle: '15 min later',
      options: { opensAppToForeground: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('meal_reminder', [
    {
      identifier: 'log_meal',
      buttonTitle: 'Log Meal',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'skip_meal',
      buttonTitle: 'Skip',
      options: { opensAppToForeground: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('hydration_reminder', [
    {
      identifier: 'log_water',
      buttonTitle: 'Log Water',
      options: { opensAppToForeground: true },
    },
  ]);
}

// ── Helpers ────────────────────────────────────────────────────────

/** Parse "HH:MM" to { hour, minute } */
export function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
}

/**
 * Returns true if a given "HH:MM" time falls inside the quiet hours window.
 * Handles the midnight-wrap case (e.g. 22:00 → 07:00).
 */
export function isTimeInQuietHours(
  time: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  const toMinutes = (t: string) => {
    const { hour, minute } = parseTime(t);
    return hour * 60 + minute;
  };
  const t = toMinutes(time);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);

  if (start <= end) {
    // Same-day range, e.g. 13:00–15:00
    return t >= start && t < end;
  }
  // Wraps midnight, e.g. 22:00–07:00
  return t >= start || t < end;
}

/** Get the route to navigate to for a notification type */
export function getRouteForNotificationType(type: NotificationType): string {
  switch (type) {
    case 'workout_reminder':
      return '/(tabs)/workout';
    case 'meal_reminder':
      return '/nutrition/log-meal';
    case 'hydration_reminder':
      return '/(tabs)/nutrition';
    case 'supplement_reminder':
      return '/nutrition/supplements';
    case 'weekly_checkin':
      return '/(tabs)/coach';
    case 'coach_tip':
      return '/(tabs)/coach';
    default:
      return '/(tabs)';
  }
}
