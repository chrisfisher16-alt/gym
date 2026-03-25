import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENTS, calculateStreak, type AchievementData } from '../lib/achievements';
import { useWorkoutStore } from './workout-store';
import { useNutritionStore } from './nutrition-store';
import { getDateString } from '../lib/nutrition-utils';
import { useMeasurementsStore } from './measurements-store';

// ── Storage Keys ───────────────────────────────────────────────────

const STORAGE_KEY = '@achievements/earned';
const XP_STORAGE_KEY = '@achievements/xp';

// ── Types ──────────────────────────────────────────────────────────

export interface EarnedAchievement {
  id: string;
  dateEarned: string; // ISO
}

export interface XPHistoryEntry {
  date: string; // ISO
  amount: number;
  source: string;
}

interface XPState {
  xp: number;
  level: number;
  xpHistory: XPHistoryEntry[];
}

interface AchievementsState {
  earned: EarnedAchievement[];
  newlyEarned: string[]; // IDs of achievements earned in the latest check
  isInitialized: boolean;

  // XP state
  xp: number;
  level: number;
  xpHistory: XPHistoryEntry[];

  // Actions
  initialize: () => Promise<void>;
  checkAchievements: () => string[]; // returns newly earned IDs
  clearNewlyEarned: () => void;

  // XP actions
  awardXP: (amount: number, source: string) => void;
  getXPToNextLevel: () => number;
  reset: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────

function calculateLevel(totalXP: number): number {
  return Math.floor(totalXP / 1000) + 1;
}

function gatherAchievementData(): AchievementData {
  const workoutState = useWorkoutStore.getState();
  const nutritionState = useNutritionStore.getState();
  const measurementsState = useMeasurementsStore.getState();

  const history = workoutState.history;
  const totalWorkouts = history.length;
  const totalPRs = history.reduce((sum, s) => sum + s.prCount, 0);
  const totalVolumeKg = history.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalVolumeLbs = totalVolumeKg * 2.20462;
  const currentStreak = calculateStreak(history);

  // Count total meals logged across all days
  const dailyLogs = nutritionState.dailyLogs;
  let totalMealsLogged = 0;
  const mealDates: string[] = [];
  for (const [date, log] of Object.entries(dailyLogs)) {
    if (log.meals && log.meals.length > 0) {
      totalMealsLogged += log.meals.length;
      mealDates.push(date);
    }
  }

  // Calculate consecutive meal logging days
  const sortedMealDates = mealDates.sort().reverse();
  let consecutiveMealDays = 0;
  if (sortedMealDates.length > 0) {
    const today = getDateString();
    const yd = new Date(Date.now() - 86400000);
    const yesterday = getDateString(yd);
    if (sortedMealDates[0] === today || sortedMealDates[0] === yesterday) {
      consecutiveMealDays = 1;
      for (let i = 1; i < sortedMealDates.length; i++) {
        const currentDate = new Date(sortedMealDates[i - 1] + 'T12:00:00');
        const prevDate = new Date(sortedMealDates[i] + 'T12:00:00');
        const expectedPrev = new Date(currentDate);
        expectedPrev.setDate(expectedPrev.getDate() - 1);
        if (getDateString(prevDate) === getDateString(expectedPrev)) {
          consecutiveMealDays++;
        } else {
          break;
        }
      }
    }
  }

  const totalPhotos = measurementsState.photos.length;

  // Check if all planned workouts this week are completed
  // Simple heuristic: check if the active program's weekly target is met
  const activeProgram = workoutState.programs.find((p) => p.isActive);
  let completedAllPlannedThisWeek = false;
  if (activeProgram) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = history.filter(
      (s) => new Date(s.completedAt).getTime() >= weekStart.getTime(),
    );

    const plannedDays = activeProgram.days?.length ?? 0;
    if (plannedDays > 0 && thisWeekWorkouts.length >= plannedDays) {
      completedAllPlannedThisWeek = true;
    }
  }

  return {
    totalWorkouts,
    totalPRs,
    totalVolumeLbs,
    currentStreak,
    totalMealsLogged,
    consecutiveMealDays,
    totalPhotos,
    completedAllPlannedThisWeek,
    history,
  };
}

// ── XP Persistence Helpers ────────────────────────────────────────

function persistXP(state: XPState): void {
  AsyncStorage.setItem(XP_STORAGE_KEY, JSON.stringify(state)).catch((e) => console.error('XP persist failed:', e));
}

async function loadXP(): Promise<XPState> {
  try {
    const stored = await AsyncStorage.getItem(XP_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as XPState;
      return {
        xp: parsed.xp ?? 0,
        level: parsed.level ?? 1,
        xpHistory: parsed.xpHistory ?? [],
      };
    }
  } catch (error) {
    console.warn('Failed to load XP data:', error);
  }
  return { xp: 0, level: 1, xpHistory: [] };
}

// ── Store ──────────────────────────────────────────────────────────

export const useAchievementsStore = create<AchievementsState>((set, get) => ({
  earned: [],
  newlyEarned: [],
  isInitialized: false,

  // XP state
  xp: 0,
  level: 1,
  xpHistory: [],

  initialize: async () => {
    try {
      const [stored, xpState] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        loadXP(),
      ]);
      const earned: EarnedAchievement[] = stored ? JSON.parse(stored) : [];
      set({
        earned,
        isInitialized: true,
        xp: xpState.xp,
        level: xpState.level,
        xpHistory: xpState.xpHistory,
      });
    } catch (error) {
      console.warn('Failed to initialize achievements store:', error);
      set({ earned: [], isInitialized: true });
    }
  },

  checkAchievements: () => {
    const state = get();
    const data = gatherAchievementData();
    const earnedIds = new Set(state.earned.map((e) => e.id));
    const newlyEarned: string[] = [];

    for (const achievement of ACHIEVEMENTS) {
      if (earnedIds.has(achievement.id)) continue;

      try {
        if (achievement.condition(data)) {
          newlyEarned.push(achievement.id);
        }
      } catch {
        // Skip failed condition checks
      }
    }

    if (newlyEarned.length > 0) {
      const now = new Date().toISOString();
      const newEarnedEntries: EarnedAchievement[] = newlyEarned.map((id) => ({
        id,
        dateEarned: now,
      }));

      const earned = [...state.earned, ...newEarnedEntries];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
      set({ earned, newlyEarned });
    }

    return newlyEarned;
  },

  clearNewlyEarned: () => {
    set({ newlyEarned: [] });
  },

  awardXP: (amount: number, source: string) => {
    const state = get();
    const newXP = state.xp + amount;
    const newLevel = calculateLevel(newXP);

    // Keep last 100 history entries to avoid unbounded growth
    const entry: XPHistoryEntry = {
      date: new Date().toISOString(),
      amount,
      source,
    };
    const xpHistory = [...state.xpHistory, entry].slice(-100);

    set({
      xp: newXP,
      level: newLevel,
      xpHistory,
    });

    persistXP({ xp: newXP, level: newLevel, xpHistory });
  },

  getXPToNextLevel: () => {
    const { xp } = get();
    const xpInCurrentLevel = xp % 1000;
    return 1000 - xpInCurrentLevel;
  },

  reset: async () => {
    set({ earned: [], newlyEarned: [], isInitialized: false, xp: 0, level: 1, xpHistory: [] });
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY),
      AsyncStorage.removeItem(XP_STORAGE_KEY),
    ]).catch(() => {});
  },
}));
