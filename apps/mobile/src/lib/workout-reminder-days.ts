// ── Workout Reminder Days Resolver ────────────────────────────────
// Derives which DayOfWeek[] to use for workout reminders by combining
// the active program, profile preferences, and notification store.

import { useWorkoutStore } from '../stores/workout-store';
import { useProfileStore } from '../stores/profile-store';
import { useNotificationStore } from '../stores/notification-store';
import type { DayOfWeek } from '../types/notifications';
import { weekdaysToDaysOfWeek, spreadDaysOfWeek } from '../types/notifications';

/**
 * Resolve the best set of workout reminder days, in priority order:
 *
 * 1. Profile `preferredWorkoutDays` — the user explicitly selected these
 *    weekdays during onboarding/profile setup. This is the strongest signal.
 *
 * 2. Active program lifting-day count — if the user hasn't set preferred
 *    days but has an active program, count the lifting days and spread
 *    them evenly across the week. Only used when the workout store has
 *    been initialised (programs loaded from AsyncStorage).
 *
 * 3. Current notification store value — whatever the user already has
 *    configured in notification settings. Falls back to the default
 *    Mon–Fri if nothing else is available.
 */
export function resolveWorkoutReminderDays(): DayOfWeek[] {
  // 1. Profile preferred workout days
  const { preferredWorkoutDays } = useProfileStore.getState().profile;
  if (preferredWorkoutDays.length > 0) {
    return weekdaysToDaysOfWeek(preferredWorkoutDays);
  }

  // 2. Active program lifting-day count
  //    Guard: the workout store initialises lazily (first visit to the
  //    workout tab).  If programs haven't loaded yet, skip this tier
  //    so we don't resolve to Mon–Fri from an empty list.
  const workoutState = useWorkoutStore.getState();
  if (workoutState.isInitialized) {
    const activeProgram = workoutState.programs.find((p) => p.isActive);
    if (activeProgram) {
      const liftingDays = activeProgram.days.filter(
        (d) => d.dayType === 'lifting',
      ).length;
      if (liftingDays > 0) {
        return spreadDaysOfWeek(liftingDays);
      }
    }
  }

  // 3. Existing notification store value (or default)
  return useNotificationStore.getState().preferences.workoutReminderDays;
}

/**
 * Returns the number of lifting days in the active program,
 * or 0 if no active program exists.
 */
export function getActiveProgramLiftingDayCount(): number {
  const activeProgram = useWorkoutStore
    .getState()
    .programs.find((p) => p.isActive);
  if (!activeProgram) return 0;
  return activeProgram.days.filter((d) => d.dayType === 'lifting').length;
}
