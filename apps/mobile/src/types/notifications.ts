// ── Notification Types ─────────────────────────────────────────────

export type NotificationType =
  | 'workout_reminder'
  | 'meal_reminder'
  | 'hydration_reminder'
  | 'supplement_reminder'
  | 'weekly_checkin'
  | 'coach_tip'
  | 'daily_briefing'
  | 'smart_pattern';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

export type HydrationInterval = 1 | 2 | 3;

export interface MealReminderPreferences {
  breakfast: { enabled: boolean; time: string }; // HH:MM
  lunch: { enabled: boolean; time: string };
  dinner: { enabled: boolean; time: string };
  snack: { enabled: boolean; time: string };
}

export interface NotificationPreferences {
  // Workout
  workoutRemindersEnabled: boolean;
  workoutReminderTime: string; // HH:MM
  workoutReminderDays: DayOfWeek[];

  // Meals
  mealRemindersEnabled: boolean;
  mealReminders: MealReminderPreferences;

  // Hydration
  hydrationRemindersEnabled: boolean;
  hydrationIntervalHours: HydrationInterval;

  // Supplements
  supplementRemindersEnabled: boolean;

  // Daily briefing
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: string; // HH:MM

  // Weekly check-in
  weeklyCheckinEnabled: boolean;
  weeklyCheckinDay: DayOfWeek;
  weeklyCheckinTime: string; // HH:MM

  // Coach tips
  coachTipsEnabled: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string; // HH:MM

  // Push token & permission
  pushToken: string | null;
  permissionStatus: PermissionStatus;
}

export type NotificationEventType =
  | 'NOTIFICATION_PERMISSION_REQUESTED'
  | 'NOTIFICATION_PERMISSION_GRANTED'
  | 'NOTIFICATION_PERMISSION_DENIED'
  | 'NOTIFICATION_SCHEDULED'
  | 'NOTIFICATION_RECEIVED'
  | 'NOTIFICATION_OPENED'
  | 'NOTIFICATION_DISABLED';

export interface NotificationEvent {
  type: NotificationEventType;
  notification_type?: NotificationType;
  scheduled_time?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationData {
  type: NotificationType;
  route?: string;
  [key: string]: unknown;
}

// ── Mapping utilities ────────────────────────────────────────────

import type { Weekday } from '../stores/profile-store';

const WEEKDAY_TO_DAY: Record<Weekday, DayOfWeek> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function weekdaysToDaysOfWeek(weekdays: Weekday[]): DayOfWeek[] {
  return weekdays.map((w) => WEEKDAY_TO_DAY[w]);
}

/**
 * Given a number of lifting days per week, return a sensible spread of
 * DayOfWeek values. Prioritises weekdays, avoids consecutive days where
 * possible, and keeps Sunday/Saturday for higher counts.
 */
const SPREAD_MAP: Record<number, DayOfWeek[]> = {
  1: [1],                         // Mon
  2: [1, 4],                      // Mon, Thu
  3: [1, 3, 5],                   // Mon, Wed, Fri
  4: [1, 2, 4, 5],               // Mon, Tue, Thu, Fri
  5: [1, 2, 3, 4, 5],            // Mon–Fri
  6: [1, 2, 3, 4, 5, 6],         // Mon–Sat
  7: [0, 1, 2, 3, 4, 5, 6],      // Every day
};

export function spreadDaysOfWeek(liftingDayCount: number): DayOfWeek[] {
  const clamped = Math.max(1, Math.min(7, liftingDayCount));
  return SPREAD_MAP[clamped];
}

const TRAINING_TIME_TO_CLOCK: Record<string, string> = {
  Morning: '07:00',
  Afternoon: '12:00',
  Evening: '17:00',
};

export function trainingTimeToClockTime(label?: string): string {
  return (label && TRAINING_TIME_TO_CLOCK[label]) || '08:00';
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  workoutRemindersEnabled: false,
  workoutReminderTime: '08:00',
  workoutReminderDays: [1, 2, 3, 4, 5], // Mon-Fri

  mealRemindersEnabled: false,
  mealReminders: {
    breakfast: { enabled: true, time: '08:00' },
    lunch: { enabled: true, time: '12:30' },
    dinner: { enabled: true, time: '18:30' },
    snack: { enabled: false, time: '15:00' },
  },

  hydrationRemindersEnabled: false,
  hydrationIntervalHours: 2,

  supplementRemindersEnabled: false,

  dailyBriefingEnabled: false,
  dailyBriefingTime: '07:00',

  weeklyCheckinEnabled: false,
  weeklyCheckinDay: 0, // Sunday
  weeklyCheckinTime: '10:00',

  coachTipsEnabled: false,

  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',

  pushToken: null,
  permissionStatus: 'undetermined',
};
