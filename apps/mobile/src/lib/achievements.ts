import type { CompletedSession } from '../types/workout';
import type { BodyMeasurement, ProgressPhoto } from '../stores/measurements-store';

// ── Types ──────────────────────────────────────────────────────────

export interface AchievementData {
  totalWorkouts: number;
  totalPRs: number;
  totalVolumeLbs: number;
  currentStreak: number;
  totalMealsLogged: number;
  consecutiveMealDays: number;
  totalPhotos: number;
  completedAllPlannedThisWeek: boolean;
  history: CompletedSession[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // Ionicons name
  category: 'workout' | 'nutrition' | 'streak' | 'milestone';
  condition: (data: AchievementData) => boolean;
  progressHint?: (data: AchievementData) => string;
}

// ── Streak Calculation ─────────────────────────────────────────────

export function calculateStreak(history: CompletedSession[]): number {
  if (history.length === 0) return 0;

  const workoutDates = new Set(
    history.map((s) => new Date(s.completedAt).toISOString().split('T')[0]),
  );

  const sortedDates = Array.from(workoutDates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Streak must include today or yesterday
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

  let streak = 1;
  let current = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i]);
    const diff = (current.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
      current = prev;
    } else {
      break;
    }
  }

  return streak;
}

// ── Achievement Definitions ────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // Workout achievements
  {
    id: 'first_workout',
    name: 'First Workout',
    description: 'Complete your first workout',
    icon: 'barbell-outline',
    category: 'workout',
    condition: (d) => d.totalWorkouts >= 1,
    progressHint: (d) => `${d.totalWorkouts}/1 workouts`,
  },
  {
    id: '10_workouts',
    name: '10 Workouts',
    description: 'Complete 10 workouts',
    icon: 'fitness-outline',
    category: 'workout',
    condition: (d) => d.totalWorkouts >= 10,
    progressHint: (d) => `${Math.min(d.totalWorkouts, 10)}/10 workouts`,
  },
  {
    id: '50_workouts',
    name: '50 Workouts',
    description: 'Complete 50 workouts',
    icon: 'medal-outline',
    category: 'workout',
    condition: (d) => d.totalWorkouts >= 50,
    progressHint: (d) => `${Math.min(d.totalWorkouts, 50)}/50 workouts`,
  },
  // PR achievements
  {
    id: 'pr_crusher',
    name: 'PR Crusher',
    description: 'Hit your first personal record',
    icon: 'trophy-outline',
    category: 'workout',
    condition: (d) => d.totalPRs >= 1,
    progressHint: (d) => `${d.totalPRs}/1 PRs`,
  },
  {
    id: 'pr_machine',
    name: 'PR Machine',
    description: 'Hit 10 personal records',
    icon: 'trophy',
    category: 'workout',
    condition: (d) => d.totalPRs >= 10,
    progressHint: (d) => `${Math.min(d.totalPRs, 10)}/10 PRs`,
  },
  // Streak achievements
  {
    id: '3_day_streak',
    name: '3-Day Streak',
    description: 'Work out 3 days in a row',
    icon: 'flame-outline',
    category: 'streak',
    condition: (d) => d.currentStreak >= 3,
    progressHint: (d) => `${Math.min(d.currentStreak, 3)}/3 day streak`,
  },
  {
    id: '7_day_streak',
    name: '7-Day Streak',
    description: 'Work out 7 days in a row',
    icon: 'flame',
    category: 'streak',
    condition: (d) => d.currentStreak >= 7,
    progressHint: (d) => `${Math.min(d.currentStreak, 7)}/7 day streak`,
  },
  {
    id: '30_day_streak',
    name: '30-Day Streak',
    description: 'Work out 30 days in a row',
    icon: 'bonfire-outline',
    category: 'streak',
    condition: (d) => d.currentStreak >= 30,
    progressHint: (d) => `${Math.min(d.currentStreak, 30)}/30 day streak`,
  },
  // Milestone achievements
  {
    id: 'volume_king',
    name: 'Volume King',
    description: 'Log 100,000 lbs total volume',
    icon: 'barbell',
    category: 'milestone',
    condition: (d) => d.totalVolumeLbs >= 100000,
    progressHint: (d) =>
      `${Math.round(d.totalVolumeLbs).toLocaleString()}/100,000 lbs`,
  },
  // Nutrition achievements
  {
    id: 'meal_logger',
    name: 'Meal Logger',
    description: 'Log 10 meals',
    icon: 'restaurant-outline',
    category: 'nutrition',
    condition: (d) => d.totalMealsLogged >= 10,
    progressHint: (d) => `${Math.min(d.totalMealsLogged, 10)}/10 meals`,
  },
  {
    id: 'nutrition_pro',
    name: 'Nutrition Pro',
    description: 'Log meals for 7 consecutive days',
    icon: 'nutrition-outline',
    category: 'nutrition',
    condition: (d) => d.consecutiveMealDays >= 7,
    progressHint: (d) => `${Math.min(d.consecutiveMealDays, 7)}/7 days`,
  },
  // Photo achievement
  {
    id: 'first_photo',
    name: 'First Photo',
    description: 'Take your first progress photo',
    icon: 'camera-outline',
    category: 'milestone',
    condition: (d) => d.totalPhotos >= 1,
    progressHint: (d) => `${d.totalPhotos}/1 photos`,
  },
  // Consistency achievement
  {
    id: 'consistency',
    name: 'Consistency',
    description: 'Complete all planned workouts in a week',
    icon: 'checkmark-done-outline',
    category: 'milestone',
    condition: (d) => d.completedAllPlannedThisWeek,
    progressHint: () => 'Complete all planned workouts this week',
  },
];
