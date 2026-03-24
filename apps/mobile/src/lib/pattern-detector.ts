// ── Pattern Detector ──────────────────────────────────────────────
// Pure local computation: reads workout history and nutrition logs to
// detect behavioural patterns and return scheduled notification objects.
// No AI API calls — everything runs on-device.

import type { CompletedSession } from '../types/workout';
import type { DailyNutritionLog, NutritionTargets } from '../types/nutrition';
import type { UserProfile } from '../stores/profile-store';

// ── Types ────────────────────────────────────────────────────────

export type SmartNotificationCategory =
  | 'workout_reminder'
  | 'nutrition_reminder'
  | 'recovery'
  | 'encouragement';

export interface ScheduledNotification {
  title: string;
  body: string;
  triggerDate: Date;
  category: SmartNotificationCategory;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Parse an ISO date string to a Date, returning null on failure. */
function safeParse(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Get a YYYY-MM-DD string for a Date. */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Create a Date for a specific hour/minute on a given day. */
function dateAtTime(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Number of full days between two dates (ignoring time). */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round(Math.abs(aStart.getTime() - bStart.getTime()) / msPerDay);
}

/** Get the next occurrence of a given weekday (0=Sun .. 6=Sat) from `from`. */
function nextWeekday(from: Date, targetDay: number): Date {
  const d = new Date(from);
  const current = d.getDay();
  const daysUntil = (targetDay - current + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  return d;
}

// ── Pattern 1: Workout Time Prediction ──────────────────────────

/**
 * Find the most common workout start hour from history.
 * Uses simple mode (most frequent hour bucket).
 */
function detectWorkoutTimePattern(
  history: CompletedSession[],
): { hour: number; count: number } | null {
  if (history.length < 3) return null;

  // Count workouts per hour bucket
  const hourCounts = new Map<number, number>();
  for (const session of history) {
    const d = safeParse(session.startedAt);
    if (!d) continue;
    const h = d.getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }

  if (hourCounts.size === 0) return null;

  // Find the mode
  let bestHour = 0;
  let bestCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestHour = hour;
      bestCount = count;
    }
  }

  // Only return if at least 30% of workouts fall in this hour
  if (bestCount / history.length < 0.3) return null;

  return { hour: bestHour, count: bestCount };
}

function generateWorkoutTimeNotifications(
  history: CompletedSession[],
  now: Date,
): ScheduledNotification[] {
  const pattern = detectWorkoutTimePattern(history);
  if (!pattern) return [];

  const notifications: ScheduledNotification[] = [];
  const reminderMinutesBefore = 15;
  const reminderHour = pattern.hour;

  // Schedule for next 7 days
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    const triggerDate = dateAtTime(day, reminderHour, 0);
    // Shift 15 minutes earlier
    triggerDate.setMinutes(triggerDate.getMinutes() - reminderMinutesBefore);

    if (triggerDate <= now) continue;

    const hourLabel = pattern.hour <= 11
      ? `${pattern.hour === 0 ? 12 : pattern.hour} AM`
      : pattern.hour === 12
        ? '12 PM'
        : `${pattern.hour - 12} PM`;

    notifications.push({
      title: '🏋️ Workout Time Soon',
      body: `You usually work out around ${hourLabel} — ready to start?`,
      triggerDate,
      category: 'workout_reminder',
    });
  }

  return notifications;
}

// ── Pattern 2: Protein Reminder ─────────────────────────────────

function generateProteinReminder(
  dailyLogs: Record<string, DailyNutritionLog>,
  targets: NutritionTargets,
  now: Date,
): ScheduledNotification[] {
  // Check last 7 days of logs
  const recentDates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    recentDates.push(toDateKey(d));
  }

  let shortfallTotal = 0;
  let daysWithData = 0;

  for (const dateKey of recentDates) {
    const log = dailyLogs[dateKey];
    if (!log) continue;
    daysWithData++;
    const consumed = log.consumed?.protein_g ?? 0;
    const deficit = targets.protein_g - consumed;
    if (deficit > 0) {
      shortfallTotal += deficit;
    }
  }

  // Need at least 3 days of data to make a pattern
  if (daysWithData < 3) return [];

  const avgShortfall = Math.round(shortfallTotal / daysWithData);

  // Only notify if average shortfall is significant (>20g)
  if (avgShortfall <= 20) return [];

  const notifications: ScheduledNotification[] = [];

  // Schedule a 6 PM reminder for the next 7 days
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    const triggerDate = dateAtTime(day, 18, 0);

    if (triggerDate <= now) continue;

    notifications.push({
      title: '🥩 Protein Check',
      body: `You're usually ~${avgShortfall}g short on protein by evening. Quick shake?`,
      triggerDate,
      category: 'nutrition_reminder',
    });
  }

  return notifications;
}

// ── Pattern 3: Rest Day Suggestion ──────────────────────────────

function generateRestDaySuggestion(
  history: CompletedSession[],
  now: Date,
): ScheduledNotification[] {
  if (history.length < 3) return [];

  // Find consecutive workout days ending at today or yesterday
  const today = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  // Get unique workout dates (sorted descending)
  const workoutDates = new Set<string>();
  for (const session of history) {
    const d = safeParse(session.completedAt);
    if (d) workoutDates.add(toDateKey(d));
  }

  // Count consecutive days ending at today or yesterday
  let consecutiveDays = 0;
  let checkDate = new Date(now);

  // Start from today if there's a workout today, otherwise yesterday
  if (!workoutDates.has(today)) {
    if (!workoutDates.has(yesterdayKey)) return [];
    checkDate = yesterday;
  }

  while (workoutDates.has(toDateKey(checkDate))) {
    consecutiveDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  if (consecutiveDays < 3) return [];

  // Schedule for tomorrow morning at 9 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const triggerDate = dateAtTime(tomorrow, 9, 0);

  if (triggerDate <= now) return [];

  return [
    {
      title: '🧘 Recovery Day?',
      body: `${consecutiveDays} days in a row — consider a rest day for recovery.`,
      triggerDate,
      category: 'recovery',
    },
  ];
}

// ── Pattern 4: Streak Encouragement ─────────────────────────────

function generateStreakEncouragement(
  history: CompletedSession[],
  now: Date,
): ScheduledNotification[] {
  if (history.length < 4) return [];

  // Count consecutive days with workouts ending at today
  const workoutDates = new Set<string>();
  for (const session of history) {
    const d = safeParse(session.completedAt);
    if (d) workoutDates.add(toDateKey(d));
  }

  let streakDays = 0;
  const checkDate = new Date(now);

  while (workoutDates.has(toDateKey(checkDate))) {
    streakDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  if (streakDays < 4) return [];

  // Send encouragement in the evening at 8 PM today (if still in future)
  const triggerDate = dateAtTime(now, 20, 0);

  if (triggerDate <= now) return [];

  return [
    {
      title: '🔥 Streak Alert!',
      body: `${streakDays}-day streak! Keep it going 🔥`,
      triggerDate,
      category: 'encouragement',
    },
  ];
}

// ── Pattern 5: Weekly Check-In ──────────────────────────────────

function generateWeeklyCheckin(
  history: CompletedSession[],
  dailyLogs: Record<string, DailyNutritionLog>,
  now: Date,
): ScheduledNotification[] {
  // Schedule for next Sunday at 7 PM
  const nextSunday = nextWeekday(now, 0); // 0 = Sunday
  const triggerDate = dateAtTime(nextSunday, 19, 0);

  if (triggerDate <= now) return [];

  // Compute stats for the current week (Mon–Sun)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  // Count workouts this week
  let weekWorkouts = 0;
  for (const session of history) {
    const d = safeParse(session.completedAt);
    if (!d) continue;
    if (d >= weekStart && d <= now) {
      weekWorkouts++;
    }
  }

  // Average calories this week
  let totalCals = 0;
  let calDays = 0;
  for (let i = 0; i <= daysFromMonday; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const log = dailyLogs[toDateKey(d)];
    if (log?.consumed?.calories) {
      totalCals += log.consumed.calories;
      calDays++;
    }
  }

  const avgCals = calDays > 0 ? Math.round(totalCals / calDays) : 0;

  let body: string;
  if (weekWorkouts > 0 && avgCals > 0) {
    body = `This week: ${weekWorkouts} workout${weekWorkouts === 1 ? '' : 's'}, ${avgCals} cal avg. New week starts tomorrow!`;
  } else if (weekWorkouts > 0) {
    body = `This week: ${weekWorkouts} workout${weekWorkouts === 1 ? '' : 's'}. New week starts tomorrow!`;
  } else {
    body = 'New week starts tomorrow — set your intentions!';
  }

  return [
    {
      title: '📊 Weekly Wrap-Up',
      body,
      triggerDate,
      category: 'encouragement',
    },
  ];
}

// ── Pattern 6: Workout Gap Nudge ────────────────────────────────

function generateWorkoutGapNudge(
  history: CompletedSession[],
  now: Date,
): ScheduledNotification[] {
  if (history.length < 3) return [];

  // Find the typical gap between workouts
  const sortedDates = history
    .map((s) => safeParse(s.completedAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (sortedDates.length < 3) return [];

  // Calculate average gap between consecutive workouts
  let totalGap = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    totalGap += daysBetween(sortedDates[i], sortedDates[i - 1]);
  }
  const avgGap = totalGap / (sortedDates.length - 1);

  // Only nudge if user typically works out frequently (every 1-2 days)
  if (avgGap > 2.5) return [];

  // Check how long since last workout
  const lastWorkout = sortedDates[sortedDates.length - 1];
  const daysSinceLast = daysBetween(now, lastWorkout);

  // Only nudge if it's been 2+ days
  if (daysSinceLast < 2) return [];

  // Schedule for tomorrow morning at 10 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const triggerDate = dateAtTime(tomorrow, 10, 0);

  if (triggerDate <= now) return [];

  return [
    {
      title: '💪 Missing You!',
      body: `It's been ${daysSinceLast} days since your last workout. Time to get back?`,
      triggerDate,
      category: 'workout_reminder',
    },
  ];
}

// ── Main Detector ────────────────────────────────────────────────

export function detectPatterns(
  workoutHistory: CompletedSession[],
  dailyLogs: Record<string, DailyNutritionLog>,
  targets: NutritionTargets,
  _profile: UserProfile,
): ScheduledNotification[] {
  const now = new Date();
  const notifications: ScheduledNotification[] = [];

  // 1. Workout time prediction
  notifications.push(...generateWorkoutTimeNotifications(workoutHistory, now));

  // 2. Protein reminder
  notifications.push(...generateProteinReminder(dailyLogs, targets, now));

  // 3. Rest day suggestion
  notifications.push(...generateRestDaySuggestion(workoutHistory, now));

  // 4. Streak encouragement
  notifications.push(...generateStreakEncouragement(workoutHistory, now));

  // 5. Weekly check-in
  notifications.push(...generateWeeklyCheckin(workoutHistory, dailyLogs, now));

  // 6. Workout gap nudge
  notifications.push(...generateWorkoutGapNudge(workoutHistory, now));

  return notifications;
}
