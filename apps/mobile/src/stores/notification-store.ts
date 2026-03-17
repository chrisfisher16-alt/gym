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
import { DEFAULT_PREFERENCES } from '../types/notifications';

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
        set((state) => ({
          preferences: { ...state.preferences, permissionStatus: status },
        }));
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
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        }));
        // Auto-sync after preference change
        setTimeout(() => get().syncReminders(), 100);
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
        setTimeout(() => get().syncReminders(), 100);
      },

      setWorkoutDays: (days) => {
        set((state) => ({
          preferences: { ...state.preferences, workoutReminderDays: days },
        }));
        setTimeout(() => get().syncReminders(), 100);
      },

      setHydrationInterval: (interval) => {
        set((state) => ({
          preferences: { ...state.preferences, hydrationIntervalHours: interval },
        }));
        setTimeout(() => get().syncReminders(), 100);
      },

      syncReminders: async () => {
        const { preferences } = get();
        await syncRemindersFromPreferences(preferences);
      },

      resetPreferences: () => {
        set({ preferences: { ...DEFAULT_PREFERENCES } });
        setTimeout(() => get().syncReminders(), 100);
      },
    }),
    {
      name: 'notification-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preferences: state.preferences }),
    },
  ),
);
