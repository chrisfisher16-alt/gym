// ── Notification Scheduler ─────────────────────────────────────────
// High-level scheduling functions for different reminder types.
// Tone: helpful and encouraging, never guilt-based.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  scheduleLocalNotification,
  cancelAllNotifications,
  parseTime,
} from './notifications';
import type {
  DayOfWeek,
  MealType,
  HydrationInterval,
  NotificationPreferences,
} from '../types/notifications';

// ── Workout Reminders ─────────────────────────────────────────────

const WORKOUT_MESSAGES = [
  { title: '💪 Workout Time!', body: "Ready for your workout? Your gains are waiting!" },
  { title: '🏋️ Time to Train!', body: "Your body is ready — let's make it count!" },
  { title: '💪 Let\'s Go!', body: "Today's workout is calling. You've got this!" },
  { title: '🔥 Workout O\'Clock', body: "Show up for yourself today. Every rep matters!" },
];

export async function scheduleWorkoutReminder(
  time: string,
  days: DayOfWeek[],
): Promise<string[]> {
  if (Platform.OS === 'web') return [];

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
    );
    ids.push(id);
  }

  return ids;
}

// ── Meal Reminders ────────────────────────────────────────────────

const MEAL_MESSAGES: Record<MealType, { title: string; body: string }[]> = {
  breakfast: [
    { title: '🌅 Good Morning!', body: "Start your day right — time to fuel up with breakfast!" },
    { title: '☀️ Breakfast Time', body: "A great day starts with a great breakfast. Ready to eat?" },
  ],
  lunch: [
    { title: '🥗 Lunch Time!', body: "Midday fuel check! Don't forget to log your lunch." },
    { title: '🍽️ Time for Lunch', body: "Keep the energy going — grab something nutritious!" },
  ],
  dinner: [
    { title: '🌙 Dinner Time', body: "Wind down with a good meal. Time to log dinner!" },
    { title: '🍽️ Evening Fuel', body: "Great job today! Finish strong with a balanced dinner." },
  ],
};

export async function scheduleMealReminder(
  mealType: MealType,
  time: string,
): Promise<string[]> {
  if (Platform.OS === 'web') return [];

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
  );
  ids.push(id);

  return ids;
}

// ── Hydration Reminders ───────────────────────────────────────────

const HYDRATION_MESSAGES = [
  { title: '💧 Stay Hydrated!', body: "Time for a water break. Your body will thank you!" },
  { title: '🚰 Water Check', body: "Have you had a glass of water recently? Stay on top of it!" },
  { title: '💧 Hydration Reminder', body: "A sip now keeps you going strong. Log your water intake!" },
];

export async function scheduleHydrationReminder(
  intervalHours: HydrationInterval,
): Promise<string[]> {
  if (Platform.OS === 'web') return [];

  const ids: string[] = [];

  // Schedule reminders during waking hours (8 AM to 9 PM)
  const startHour = 8;
  const endHour = 21;

  let reminderIndex = 0;
  for (let hour = startHour; hour <= endHour; hour += intervalHours) {
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
  if (Platform.OS === 'web') return '';

  const { hour, minute } = parseTime(time);

  const id = await scheduleLocalNotification(
    `💊 Time for ${supplementName}`,
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
  if (Platform.OS === 'web') return '';

  const { hour, minute } = parseTime(time);

  const id = await scheduleLocalNotification(
    '📊 Weekly Check-in',
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

// ── Cancel All ────────────────────────────────────────────────────

export async function cancelAllReminders(): Promise<void> {
  await cancelAllNotifications();
}

// ── Sync From Preferences ─────────────────────────────────────────
// Rebuilds all scheduled notifications from the current preferences.
// Call this after any preference change.

export async function syncRemindersFromPreferences(
  prefs: NotificationPreferences,
): Promise<void> {
  if (Platform.OS === 'web') return;

  // Cancel everything first, then rebuild
  await cancelAllNotifications();

  if (prefs.permissionStatus !== 'granted') return;

  // Workout reminders
  if (prefs.workoutRemindersEnabled && prefs.workoutReminderDays.length > 0) {
    await scheduleWorkoutReminder(prefs.workoutReminderTime, prefs.workoutReminderDays);
  }

  // Meal reminders
  if (prefs.mealRemindersEnabled) {
    const { breakfast, lunch, dinner } = prefs.mealReminders;
    if (breakfast.enabled) {
      await scheduleMealReminder('breakfast', breakfast.time);
    }
    if (lunch.enabled) {
      await scheduleMealReminder('lunch', lunch.time);
    }
    if (dinner.enabled) {
      await scheduleMealReminder('dinner', dinner.time);
    }
  }

  // Hydration reminders
  if (prefs.hydrationRemindersEnabled) {
    await scheduleHydrationReminder(prefs.hydrationIntervalHours);
  }

  // Supplement reminders — schedule defaults (morning/evening)
  if (prefs.supplementRemindersEnabled) {
    await scheduleSupplementReminder('Supplements', '09:00');
  }

  // Weekly check-in
  if (prefs.weeklyCheckinEnabled) {
    await scheduleWeeklyCheckin(prefs.weeklyCheckinDay, prefs.weeklyCheckinTime);
  }
}
