// ── Notification Scheduler ─────────────────────────────────────────
// High-level scheduling functions for different reminder types.
// Tone: helpful and encouraging, never guilt-based.

import { Platform } from 'react-native';
import {
  scheduleLocalNotification,
  cancelNotificationsByType,
  cancelAllNotifications,
  parseTime,
  isTimeInQuietHours,
} from './notifications';
import type {
  DayOfWeek,
  MealType,
  HydrationInterval,
  NotificationPreferences,
} from '../types/notifications';

// ── Lazy-load native module (crashes on web) ──────────────────────

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch {}
}

// ── Quiet-hours gate ─────────────────────────────────────────────

/**
 * Returns true if the given time should be skipped because it falls
 * inside the user's quiet hours window.
 */
function shouldSuppressTime(
  time: string,
  prefs: NotificationPreferences,
): boolean {
  if (!prefs.quietHoursEnabled) return false;
  return isTimeInQuietHours(time, prefs.quietHoursStart, prefs.quietHoursEnd);
}

// ── Workout Reminders ─────────────────────────────────────────────

const WORKOUT_MESSAGES = [
  { title: '\u{1F4AA} Workout Time!', body: "Ready for your workout? Your gains are waiting!" },
  { title: '\u{1F3CB}\u{FE0F} Time to Train!', body: "Your body is ready \u2014 let's make it count!" },
  { title: '\u{1F4AA} Let\'s Go!', body: "Today's workout is calling. You've got this!" },
  { title: '\u{1F525} Workout O\'Clock', body: "Show up for yourself today. Every rep matters!" },
];

export async function scheduleWorkoutReminder(
  time: string,
  days: DayOfWeek[],
): Promise<string[]> {
  if (Platform.OS === 'web' || !Notifications) return [];

  const { hour, minute } = parseTime(time);
  const ids: string[] = [];

  for (const day of days) {
    const msg = WORKOUT_MESSAGES[day % WORKOUT_MESSAGES.length];
    const id = await scheduleLocalNotification(
      msg.title,
      msg.body,
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day === 0 ? 1 : day + 1, // Expo uses 1=Sunday, 2=Monday, etc.
        hour,
        minute,
      },
      { type: 'workout_reminder' },
      'workout_reminder',
    );
    ids.push(id);
  }

  return ids;
}

// ── Meal Reminders ────────────────────────────────────────────────

const MEAL_MESSAGES: Record<MealType, { title: string; body: string }[]> = {
  breakfast: [
    { title: '\u{1F305} Good Morning!', body: "Start your day right \u2014 time to fuel up with breakfast!" },
    { title: '\u{2600}\u{FE0F} Breakfast Time', body: "A great day starts with a great breakfast. Ready to eat?" },
  ],
  lunch: [
    { title: '\u{1F957} Lunch Time!', body: "Midday fuel check! Don't forget to log your lunch." },
    { title: '\u{1F37D}\u{FE0F} Time for Lunch', body: "Keep the energy going \u2014 grab something nutritious!" },
  ],
  dinner: [
    { title: '\u{1F319} Dinner Time', body: "Wind down with a good meal. Time to log dinner!" },
    { title: '\u{1F37D}\u{FE0F} Evening Fuel', body: "Great job today! Finish strong with a balanced dinner." },
  ],
  snack: [
    { title: '\u{1F34E} Snack Time!', body: "A healthy snack keeps your energy up. Time to refuel!" },
    { title: '\u{1F95C} Snack Break', body: "Don't let hunger derail your goals \u2014 grab a smart snack!" },
  ],
};

export async function scheduleMealReminder(
  mealType: MealType,
  time: string,
): Promise<string[]> {
  if (Platform.OS === 'web' || !Notifications) return [];

  const { hour, minute } = parseTime(time);
  const messages = MEAL_MESSAGES[mealType];
  const msg = messages[0];
  const ids: string[] = [];

  const id = await scheduleLocalNotification(
    msg.title,
    msg.body,
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
    { type: 'meal_reminder', mealType },
    'meal_reminder',
  );
  ids.push(id);

  return ids;
}

// ── Hydration Reminders ───────────────────────────────────────────

const HYDRATION_MESSAGES = [
  { title: '\u{1F4A7} Stay Hydrated!', body: "Time for a water break. Your body will thank you!" },
  { title: '\u{1F6B0} Water Check', body: "Have you had a glass of water recently? Stay on top of it!" },
  { title: '\u{1F4A7} Hydration Reminder', body: "A sip now keeps you going strong. Log your water intake!" },
];

export async function scheduleHydrationReminder(
  intervalHours: HydrationInterval,
  quietHoursEnabled?: boolean,
  quietStart?: string,
  quietEnd?: string,
): Promise<string[]> {
  if (Platform.OS === 'web' || !Notifications) return [];

  const ids: string[] = [];

  // Schedule reminders during waking hours (8 AM to 9 PM)
  const startHour = 8;
  const endHour = 21;

  let reminderIndex = 0;
  for (let hour = startHour; hour <= endHour; hour += intervalHours) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    if (
      quietHoursEnabled &&
      quietStart &&
      quietEnd &&
      isTimeInQuietHours(timeStr, quietStart, quietEnd)
    ) {
      continue;
    }

    const msg = HYDRATION_MESSAGES[reminderIndex % HYDRATION_MESSAGES.length];
    const id = await scheduleLocalNotification(
      msg.title,
      msg.body,
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
      { type: 'hydration_reminder' },
      'hydration_reminder',
    );
    ids.push(id);
    reminderIndex++;
  }

  return ids;
}

// ── Supplement Reminders ──────────────────────────────────────────

export async function scheduleSupplementReminder(
  supplementName: string,
  time: string,
): Promise<string> {
  if (Platform.OS === 'web' || !Notifications) return '';

  const { hour, minute } = parseTime(time);

  const id = await scheduleLocalNotification(
    `\u{1F48A} Time for ${supplementName}`,
    `Don't forget your ${supplementName}. Consistency is key!`,
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
    { type: 'supplement_reminder', supplementName },
  );

  return id;
}

// ── Weekly Check-in ───────────────────────────────────────────────

export async function scheduleWeeklyCheckin(
  dayOfWeek: DayOfWeek,
  time: string,
): Promise<string> {
  if (Platform.OS === 'web' || !Notifications) return '';

  const { hour, minute } = parseTime(time);

  const id = await scheduleLocalNotification(
    '\u{1F4CA} Weekly Check-in',
    "How was your week? Take a moment to review your progress and set intentions for the week ahead!",
    {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: dayOfWeek === 0 ? 1 : dayOfWeek + 1,
      hour,
      minute,
    },
    { type: 'weekly_checkin' },
  );

  return id;
}

// ── Daily Briefing ────────────────────────────────────────────────

export async function scheduleDailyBriefing(
  time: string,
): Promise<string> {
  if (Platform.OS === 'web' || !Notifications) return '';

  const { hour, minute } = parseTime(time);

  const id = await scheduleLocalNotification(
    '\u{1F4CB} Daily Briefing',
    "Here's your plan for today \u2014 workouts, meals, and goals at a glance!",
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
    { type: 'daily_briefing' },
  );

  return id;
}

// ── Cancel All ────────────────────────────────────────────────────

export async function cancelAllReminders(): Promise<void> {
  await cancelAllNotifications();
}

// ── Smart Notifications (Pattern-Based) ──────────────────────────
// Detects behavioural patterns from workout / nutrition history and
// schedules date-based local notifications for the next 7 days.
// All computation is local — no API calls.

import { detectPatterns } from './pattern-detector';
import type { ScheduledNotification } from './pattern-detector';

const SMART_NOTIFICATION_TYPE = 'smart_pattern';

/**
 * Clear all previously-scheduled smart (pattern-based) notifications.
 */
export async function clearSmartNotifications(): Promise<void> {
  await cancelNotificationsByType(SMART_NOTIFICATION_TYPE);
}

/**
 * Analyse workout / nutrition history, detect patterns, and schedule
 * smart local notifications for the next 7 days.
 *
 * Safe to call repeatedly — clears old smart notifications first.
 */
export async function scheduleSmartNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  // Check permissions & user preference
  const { useNotificationStore } = require('../stores/notification-store');
  const prefs: NotificationPreferences =
    useNotificationStore.getState().preferences;

  if (prefs.permissionStatus !== 'granted') return;

  // Grab store data
  const { useWorkoutStore } = require('../stores/workout-store');
  const { useNutritionStore } = require('../stores/nutrition-store');
  const { useProfileStore } = require('../stores/profile-store');

  const history = useWorkoutStore.getState().history;
  const dailyLogs = useNutritionStore.getState().dailyLogs;
  const targets = useNutritionStore.getState().targets;
  const profile = useProfileStore.getState().profile;

  // Clear previous smart notifications
  await clearSmartNotifications();

  // Detect patterns
  const notifications: ScheduledNotification[] = detectPatterns(
    history,
    dailyLogs,
    targets,
    profile,
  );

  const now = new Date();

  for (const notif of notifications) {
    // Skip notifications in the past
    if (notif.triggerDate <= now) continue;

    // Respect quiet hours
    const triggerHour = notif.triggerDate.getHours();
    const triggerMinute = notif.triggerDate.getMinutes();
    const triggerTimeStr = `${String(triggerHour).padStart(2, '0')}:${String(triggerMinute).padStart(2, '0')}`;
    if (shouldSuppressTime(triggerTimeStr, prefs)) continue;

    await scheduleLocalNotification(
      notif.title,
      notif.body,
      {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notif.triggerDate,
      },
      { type: SMART_NOTIFICATION_TYPE, category: notif.category },
      notif.category,
    );
  }
}

// ── Sync From Preferences ─────────────────────────────────────────
// Rebuilds scheduled notifications from the current preferences.
// Uses per-type cancellation so that changing e.g. meal reminders
// doesn't disrupt workout or hydration schedules.

export async function syncRemindersFromPreferences(
  prefs: NotificationPreferences,
): Promise<void> {
  if (Platform.OS === 'web') return;

  if (prefs.permissionStatus !== 'granted') {
    // No permission — cancel everything and bail
    await cancelAllNotifications();
    return;
  }

  // ── Workout reminders ──
  await cancelNotificationsByType('workout_reminder');
  if (prefs.workoutRemindersEnabled && prefs.workoutReminderDays.length > 0) {
    if (!shouldSuppressTime(prefs.workoutReminderTime, prefs)) {
      await scheduleWorkoutReminder(prefs.workoutReminderTime, prefs.workoutReminderDays);
    }
  }

  // ── Meal reminders ──
  await cancelNotificationsByType('meal_reminder');
  if (prefs.mealRemindersEnabled) {
    const meals: Array<{ key: keyof typeof prefs.mealReminders; type: MealType }> = [
      { key: 'breakfast', type: 'breakfast' },
      { key: 'lunch', type: 'lunch' },
      { key: 'dinner', type: 'dinner' },
      { key: 'snack', type: 'snack' },
    ];
    for (const { key, type } of meals) {
      const meal = prefs.mealReminders[key];
      if (meal.enabled && !shouldSuppressTime(meal.time, prefs)) {
        await scheduleMealReminder(type, meal.time);
      }
    }
  }

  // ── Hydration reminders ──
  await cancelNotificationsByType('hydration_reminder');
  if (prefs.hydrationRemindersEnabled) {
    await scheduleHydrationReminder(
      prefs.hydrationIntervalHours,
      prefs.quietHoursEnabled,
      prefs.quietHoursStart,
      prefs.quietHoursEnd,
    );
  }

  // ── Supplement reminders ──
  await cancelNotificationsByType('supplement_reminder');
  if (prefs.supplementRemindersEnabled) {
    // Schedule per-supplement reminders based on each supplement's timeOfDay.
    try {
      const { useNutritionStore } = require('../stores/nutrition-store');
      const supplements = useNutritionStore.getState().userSupplements ?? [];
      const active = supplements.filter((s: { isActive: boolean }) => s.isActive);

      if (active.length > 0) {
        // Group by time slot to batch notifications
        const TIME_OF_DAY_MAP: Record<string, string> = {
          morning: '08:00',
          afternoon: '13:00',
          evening: '19:00',
          with_meals: '12:00',
          any: '09:00',
        };
        const byTime = new Map<string, string[]>();
        for (const s of active) {
          const time = TIME_OF_DAY_MAP[s.timeOfDay] ?? '09:00';
          const names = byTime.get(time) ?? [];
          names.push(s.supplementName);
          byTime.set(time, names);
        }
        for (const [time, names] of byTime) {
          if (!shouldSuppressTime(time, prefs)) {
            const label = names.length === 1 ? names[0] : `${names.length} supplements`;
            await scheduleSupplementReminder(label, time);
          }
        }
      } else {
        // No active supplements — fall back to generic reminder
        if (!shouldSuppressTime('09:00', prefs)) {
          await scheduleSupplementReminder('Supplements', '09:00');
        }
      }
    } catch {
      // Nutrition store unavailable — fall back to generic
      if (!shouldSuppressTime('09:00', prefs)) {
        await scheduleSupplementReminder('Supplements', '09:00');
      }
    }
  }

  // ── Daily briefing ──
  await cancelNotificationsByType('daily_briefing');
  if (prefs.dailyBriefingEnabled) {
    if (!shouldSuppressTime(prefs.dailyBriefingTime, prefs)) {
      await scheduleDailyBriefing(prefs.dailyBriefingTime);
    }
  }

  // ── Weekly check-in ──
  await cancelNotificationsByType('weekly_checkin');
  if (prefs.weeklyCheckinEnabled) {
    if (!shouldSuppressTime(prefs.weeklyCheckinTime, prefs)) {
      await scheduleWeeklyCheckin(prefs.weeklyCheckinDay, prefs.weeklyCheckinTime);
    }
  }
}
