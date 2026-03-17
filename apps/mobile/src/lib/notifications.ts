// ── Notification Service ───────────────────────────────────────────
// Core notification primitives: permissions, tokens, scheduling.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { NotificationData, NotificationType } from '../types/notifications';

// ── Configuration ─────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permissions ───────────────────────────────────────────────────

export async function requestPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') {
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
  if (Platform.OS === 'web') {
    return 'denied';
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

// ── Push Token ────────────────────────────────────────────────────

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
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
  trigger: Notifications.NotificationTriggerInput,
  data?: NotificationData,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown> | undefined,
      sound: 'default',
    },
    trigger,
  });
  return id;
}

// ── Cancel Notifications ──────────────────────────────────────────

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ── Notification Categories (Action Buttons) ──────────────────────

export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;

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
