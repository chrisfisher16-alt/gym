// ── Weekly Summary ──────────────────────────────────────────────────
// AI-generated weekly check-in summary for the Today tab.
// Gathers the full week's data, calls Claude, caches per week.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useProfileStore } from '../stores/profile-store';
import { calculateDailyTotals } from './nutrition-utils';

// ── Types ────────────────────────────────────────────────────────────

export interface WeeklySummary {
  weekStart: string;
  workoutsCompleted: number;
  totalVolume: number;
  prsHit: number;
  mealsLogged: number;
  avgCalories: number;
  avgProtein: number;
  nutritionAdherence: number; // 0-1
  aiInsight: string;
}

// ── Storage ──────────────────────────────────────────────────────────

const SUMMARY_KEY_PREFIX = '@weekly-summary/';
const DISMISSED_KEY_PREFIX = '@weekly-summary-dismissed/';

function getSummaryKey(weekStart: string): string {
  return `${SUMMARY_KEY_PREFIX}${weekStart}`;
}

function getDismissedKey(weekStart: string): string {
  return `${DISMISSED_KEY_PREFIX}${weekStart}`;
}

export async function getCachedWeeklySummary(weekStart: string): Promise<WeeklySummary | null> {
  try {
    const stored = await AsyncStorage.getItem(getSummaryKey(weekStart));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function cacheWeeklySummary(weekStart: string, summary: WeeklySummary): Promise<void> {
  try {
    await AsyncStorage.setItem(getSummaryKey(weekStart), JSON.stringify(summary));
  } catch {
    // Ignore storage errors
  }
}

export async function isWeeklySummaryDismissed(weekStart: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(getDismissedKey(weekStart));
    return val === 'true';
  } catch {
    return false;
  }
}

export async function dismissWeeklySummary(weekStart: string): Promise<void> {
  try {
    await AsyncStorage.setItem(getDismissedKey(weekStart), 'true');
  } catch {
    // Ignore
  }
}

// ── Date Helpers ─────────────────────────────────────────────────────

/** Get the Monday of the current week (or last Monday if today is Sunday). */
export function getLastWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  // Go back to last Monday
  const daysBack = day === 0 ? 13 : day + 6;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysBack);
  lastMonday.setHours(0, 0, 0, 0);
  return lastMonday.toISOString().split('T')[0];
}

export function getLastWeekEnd(): string {
  const now = new Date();
  const day = now.getDay();
  const daysBack = day === 0 ? 7 : day;
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - daysBack);
  lastSunday.setHours(23, 59, 59, 999);
  return lastSunday.toISOString().split('T')[0];
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ── Context Gathering ────────────────────────────────────────────────

function gatherWeeklyContext(weekStart: string, weekEnd: string): {
  stats: Omit<WeeklySummary, 'aiInsight'>;
  contextText: string;
} {
  const profile = useProfileStore.getState().profile;
  const workoutState = useWorkoutStore.getState();
  const nutritionState = useNutritionStore.getState();

  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  endDate.setHours(23, 59, 59, 999);

  // Workouts in the week
  const weekWorkouts = workoutState.history.filter((w) => {
    const d = new Date(w.completedAt);
    return d >= startDate && d <= endDate;
  });

  const workoutsCompleted = weekWorkouts.length;
  const totalVolume = weekWorkouts.reduce((sum, w) => sum + w.totalVolume, 0);
  const prsHit = weekWorkouts.reduce((sum, w) => sum + w.prCount, 0);

  // Workout names for context
  const workoutNames = weekWorkouts.map((w) => w.name).join(', ') || 'None';

  // Nutrition for the week
  const weekDates = getDateRange(weekStart, weekEnd);
  let totalCalories = 0;
  let totalProtein = 0;
  let mealsLogged = 0;
  let daysWithMeals = 0;
  let daysOnTarget = 0;

  for (const date of weekDates) {
    const log = nutritionState.dailyLogs[date];
    if (log && log.meals.length > 0) {
      const consumed = calculateDailyTotals(log.meals);
      totalCalories += consumed.calories;
      totalProtein += consumed.protein_g;
      mealsLogged += log.meals.length;
      daysWithMeals++;
      // "On target" = within 15% of calorie goal
      const ratio = consumed.calories / nutritionState.targets.calories;
      if (ratio >= 0.85 && ratio <= 1.15) {
        daysOnTarget++;
      }
    }
  }

  const avgCalories = daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0;
  const avgProtein = daysWithMeals > 0 ? Math.round(totalProtein / daysWithMeals) : 0;
  const nutritionAdherence = weekDates.length > 0 ? daysOnTarget / weekDates.length : 0;

  const stats: Omit<WeeklySummary, 'aiInsight'> = {
    weekStart,
    workoutsCompleted,
    totalVolume: Math.round(totalVolume),
    prsHit,
    mealsLogged,
    avgCalories,
    avgProtein,
    nutritionAdherence: Math.round(nutritionAdherence * 100) / 100,
  };

  const contextText = [
    `Week: ${weekStart} to ${weekEnd}`,
    profile.displayName ? `User: ${profile.displayName}` : null,
    profile.primaryGoal ? `Goal: ${profile.primaryGoal}` : null,
    profile.trainingDaysPerWeek ? `Target training days/week: ${profile.trainingDaysPerWeek}` : null,
    `Workouts completed: ${workoutsCompleted} (${workoutNames})`,
    `Total volume: ${Math.round(totalVolume)} kg`,
    `PRs hit: ${prsHit}`,
    `Meals logged: ${mealsLogged} across ${daysWithMeals} days`,
    `Avg daily calories: ${avgCalories} (target: ${nutritionState.targets.calories})`,
    `Avg daily protein: ${avgProtein}g (target: ${nutritionState.targets.protein_g}g)`,
    `Nutrition adherence: ${Math.round(nutritionAdherence * 100)}% of days on target`,
  ]
    .filter(Boolean)
    .join('\n');

  return { stats, contextText };
}

// ── Summary Generation ───────────────────────────────────────────────

const WEEKLY_SYSTEM_PROMPT =
  'You are a fitness coach reviewing a client\'s weekly performance. Provide a concise 2-3 sentence insight that highlights what went well, what could improve, and a specific recommendation for the coming week. Be encouraging but honest. Do not use markdown formatting — write plain text only. You are EXCLUSIVELY a health and fitness coach — only discuss exercise, workouts, nutrition, and wellness topics.';

const FALLBACK_INSIGHT =
  'Another week in the books! Review your workouts and nutrition to see where you excelled and where there is room to grow. Keep showing up consistently — that is what drives long-term results.';

export async function generateWeeklySummary(): Promise<WeeklySummary> {
  const weekStart = getLastWeekStart();
  const weekEnd = getLastWeekEnd();

  // Check cache
  const cached = await getCachedWeeklySummary(weekStart);
  if (cached) return cached;

  const { stats, contextText } = gatherWeeklyContext(weekStart, weekEnd);

  try {
    const config = await getAIConfig();

    if (config.provider === 'demo') {
      const summary: WeeklySummary = { ...stats, aiInsight: FALLBACK_INSIGHT };
      await cacheWeeklySummary(weekStart, summary);
      return summary;
    }

    const messages: AIMessage[] = [
      { role: 'system', content: WEEKLY_SYSTEM_PROMPT },
      { role: 'user', content: `Here is my weekly performance data:\n\n${contextText}` },
    ];

    const response = await callAI(messages, config);
    const summary: WeeklySummary = {
      ...stats,
      aiInsight: response.content.trim(),
    };

    await cacheWeeklySummary(weekStart, summary);
    return summary;
  } catch (error) {
    console.warn('Failed to generate weekly summary:', error);
    const summary: WeeklySummary = { ...stats, aiInsight: FALLBACK_INSIGHT };
    await cacheWeeklySummary(weekStart, summary);
    return summary;
  }
}
