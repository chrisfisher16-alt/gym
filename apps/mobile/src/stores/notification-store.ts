// ── Notification Preferences Store ─────────────────────────────────
// Zustand store persisted with AsyncStorage.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestPermissions,
  getPermissionStatus,
  registerPushToken,
} from '../lib/notifications';
import { syncRemindersFromPreferences } from '../lib/notification-scheduler';
import type {
  NotificationPreferences,
  DayOfWeek,
  HydrationInterval,
  MealReminderPreferences,
  PermissionStatus,
} from '../types/notifications';
import {
  DEFAULT_PREFERENCES,
  trainingTimeToClockTime,
} from '../types/notifications';
import { useProfileStore } from './profile-store';
import { resolveWorkoutReminderDays } from '../lib/workout-reminder-days';

// ── Debounced sync ────────────────────────────────────────────────
// Multiple rapid preference changes (e.g. toggling several meal
// reminders) coalesce into a single sync pass.

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSync(syncFn: () => Promise<void>) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncFn().catch((err) => {
      console.warn('Notification sync failed:', err);
    });
  }, 250);
}

// ── Store ─────────────────────────────────────────────────────────

interface NotificationState {
  preferences: NotificationPreferences;

  // Actions
  requestPermission: () => Promise<PermissionStatus>;
  checkPermission: () => Promise<PermissionStatus>;
  registerToken: () => Promise<string | null>;
  updatePreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  updateMealReminder: (
    meal: keyof MealReminderPreferences,
    update: Partial<MealReminderPreferences[keyof MealReminderPreferences]>,
  ) => void;
  setWorkoutDays: (days: DayOfWeek[]) => void;
  setHydrationInterval: (interval: HydrationInterval) => void;
  syncWorkoutDaysFromProgram: () => void;
  syncReminders: () => Promise<void>;
  resetPreferences: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      preferences: { ...DEFAULT_PREFERENCES },

      requestPermission: async () => {
        const status = await requestPermissions();
        set((state) => ({
          preferences: { ...state.preferences, permissionStatus: status },
        }));

        if (status === 'granted') {
          // Also register push token when granted
          const token = await registerPushToken();
          if (token) {
            set((state) => ({
              preferences: { ...state.preferences, pushToken: token },
            }));
          }
          // Sync reminders after permission grant
          await get().syncReminders();
        }

        return status;
      },

      checkPermission: async () => {
        const status = await getPermissionStatus();
        const prev = get().preferences.permissionStatus;
        set((state) => ({
          preferences: { ...state.preferences, permissionStatus: status },
        }));
        // If permission was just granted externally (via device Settings),
        // sync reminders so any enabled toggles take effect immediately.
        if (status === 'granted' && prev !== 'granted') {
          await get().syncReminders();
        }
        return status;
      },

      registerToken: async () => {
        const token = await registerPushToken();
        if (token) {
          set((state) => ({
            preferences: { ...state.preferences, pushToken: token },
          }));
        }
        return token;
      },

      updatePreference: (key, value) => {
        const current = get().preferences;

        // Auto-populate workout days & time from program/profile when enabling
        if (
          key === 'workoutRemindersEnabled' &&
          value === true
        ) {
          const profile = useProfileStore.getState().profile;
          const updates: Partial<NotificationPreferences> = {
            workoutRemindersEnabled: true,
            // Always re-resolve days (handles program changes since last enable)
            workoutReminderDays: resolveWorkoutReminderDays(current.workoutReminderDays),
          };

          // Pre-fill time from profile preferred training time (only on first enable)
          if (!current.workoutRemindersEnabled && profile.preferredTrainingTime) {
            updates.workoutReminderTime = trainingTimeToClockTime(
              profile.preferredTrainingTime,
            );
          }

          set((state) => ({
            preferences: { ...state.preferences, ...updates },
          }));
          debouncedSync(() => get().syncReminders());
          return;
        }

        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        }));
        debouncedSync(() => get().syncReminders());
      },

      updateMealReminder: (meal, update) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            mealReminders: {
              ...state.preferences.mealReminders,
              [meal]: { ...state.preferences.mealReminders[meal], ...update },
            },
          },
        }));
        debouncedSync(() => get().syncReminders());
      },

      setWorkoutDays: (days) => {
        set((state) => ({
          preferences: { ...state.preferences, workoutReminderDays: days },
        }));
        debouncedSync(() => get().syncReminders());
      },

      setHydrationInterval: (interval) => {
        set((state) => ({
          preferences: { ...state.preferences, hydrationIntervalHours: interval },
        }));
        debouncedSync(() => get().syncReminders());
      },

      syncWorkoutDaysFromProgram: () => {
        const { preferences } = get();
        // Only update if workout reminders are currently enabled
        if (!preferences.workoutRemindersEnabled) return;
        const resolved = resolveWorkoutReminderDays(preferences.workoutReminderDays);
        // Avoid unnecessary re-sync if days haven't changed
        const current = preferences.workoutReminderDays;
        if (
          resolved.length === current.length &&
          resolved.every((d, i) => d === current[i])
        ) {
          return;
        }
        set((state) => ({
          preferences: { ...state.preferences, workoutReminderDays: resolved },
        }));
        debouncedSync(() => get().syncReminders());
      },

      syncReminders: async () => {
        const { preferences } = get();
        await syncRemindersFromPreferences(preferences);
      },

      resetPreferences: () => {
        set({ preferences: { ...DEFAULT_PREFERENCES } });
        debouncedSync(() => get().syncReminders());
      },
    }),
    {
      name: 'notification-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preferences: state.preferences }),
    },
  ),
);
