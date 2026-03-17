// ── Notification Types ─────────────────────────────────────────────

export type NotificationType =
  | 'workout_reminder'
  | 'meal_reminder'
  | 'hydration_reminder'
  | 'supplement_reminder'
  | 'weekly_checkin'
  | 'coach_tip';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

export type HydrationInterval = 1 | 2 | 3;

export interface MealReminderPreferences {
  breakfast: { enabled: boolean; time: string }; // HH:MM
  lunch: { enabled: boolean; time: string };
  dinner: { enabled: boolean; time: string };
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

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  workoutRemindersEnabled: false,
  workoutReminderTime: '08:00',
  workoutReminderDays: [1, 2, 3, 4, 5], // Mon-Fri

  mealRemindersEnabled: false,
  mealReminders: {
    breakfast: { enabled: true, time: '08:00' },
    lunch: { enabled: true, time: '12:30' },
    dinner: { enabled: true, time: '18:30' },
  },

  hydrationRemindersEnabled: false,
  hydrationIntervalHours: 2,

  supplementRemindersEnabled: false,

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
