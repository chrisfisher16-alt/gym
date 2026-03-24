import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Card,
  ScreenContainer,
  EmptyState,
  ExpandableCard,
  AnimatedNumber,
  Sparkline,
  QuickActionSheet,
  SmartHeader,
} from '../../src/components/ui';

import { useQuickActions } from '../../src/hooks/useQuickActions';
import { MuscleAnatomyDiagram } from '../../src/components/MuscleAnatomyDiagram';
import type { MuscleId } from '../../src/types/workout';
import { ProgressTabSkeleton } from '../../src/components/ui/SkeletonLayouts';
import { useHealthStore } from '../../src/stores/health-store';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { usePersonalRecords } from '../../src/hooks/usePersonalRecords';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useMeasurementsStore } from '../../src/stores/measurements-store';
import { useAchievementsStore } from '../../src/stores/achievements-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { ACHIEVEMENTS } from '../../src/lib/achievements';
import { AchievementBadge } from '../../src/components/AchievementBadge';
import { getHealthProviderName } from '../../src/lib/health';
import { CoachFAB } from '../../src/components/CoachFAB';
import { MUSCLE_GROUP_LABELS } from '../../src/lib/exercise-data';
import type { MuscleGroup, CompletedSession } from '../../src/types/workout';
import {
  isDemoMode,
  DEMO_STREAK,
  DEMO_HEALTH_DATA,
  getDemoWorkoutHistory,
  getDemoWeeklyVolume,
  getDemoPersonalRecords,
  getDemoNutritionWeek,
  DEMO_NUTRITION_TARGETS,
} from '../../src/lib/demo-mode';
import { generateInsights, type InsightContext as InsightCtx } from '../../src/lib/insight-engine';
import { InsightBadge } from '../../src/components/ui';
import { useCoachStore } from '../../src/stores/coach-store';

// ── Date Range Types ──────────────────────────────────────────────

type DateRange = 'week' | 'month' | '3months' | 'year';

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: '3months', label: '3 Months' },
  { key: 'year', label: 'Year' },
];

function getDaysForRange(range: DateRange): number {
  switch (range) {
    case 'week': return 7;
    case 'month': return 30;
    case '3months': return 90;
    case 'year': return 365;
  }
}

function getStartDate(range: DateRange): Date {
  const d = new Date();
  d.setDate(d.getDate() - getDaysForRange(range));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Muscle Group Colors ──────────────────────────────────────────

const KG_TO_LB = 2.20462;

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#EF4444',
  back: '#3B82F6',
  shoulders: '#F59E0B',
  legs: '#10B981',
  arms: '#8B5CF6',
  core: '#EC4899',
  cardio: '#06B6D4',
  full_body: '#6366F1',
};

export default function ProgressTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();
  const isHealthConnected = useHealthStore((s) => s.isConnected);
  const recentWeight = useHealthStore((s) => s.recentWeight);
  const syncEnabled = useHealthStore((s) => s.syncEnabled);
  const healthInitialized = useHealthStore((s) => s.isInitialized);
  const initHealth = useHealthStore((s) => s.initialize);
  const isInitialized = useWorkoutStore((s) => s.isInitialized);
  const exercises = useWorkoutStore((s) => s.exercises);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);
  const nutritionTargets = useNutritionStore((s) => s.targets);

  const { totalWorkouts, totalVolume, totalPRs, weeklyVolume, history } = useWorkoutHistory();
  const { allRecords, recentPRs, getExercisePRHistory } = usePersonalRecords();
  const { targets } = useNutritionDashboard();

  // Measurements store
  const measurements = useMeasurementsStore((s) => s.measurements);
  const measurementsInitialized = useMeasurementsStore((s) => s.isInitialized);
  const initMeasurements = useMeasurementsStore((s) => s.initialize);

  // Achievements store
  const earnedAchievements = useAchievementsStore((s) => s.earned);
  const checkAchievements = useAchievementsStore((s) => s.checkAchievements);
  const clearNewlyEarned = useAchievementsStore((s) => s.clearNewlyEarned);
  const initAchievements = useAchievementsStore((s) => s.initialize);
  const achievementsInitialized = useAchievementsStore((s) => s.isInitialized);

  // Profile
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const imperial = unitPref === 'imperial';

  // Congrats toast state
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsAchievements, setCongratsAchievements] = useState<string[]>([]);

  const photoCount = useMeasurementsStore((s) => s.photos.length);
  const totalMealsLogged = useMemo(() => {
    return Object.values(dailyLogs).reduce((sum, log: any) => sum + (log?.meals?.length ?? 0), 0);
  }, [dailyLogs]);

  const demo = isDemoMode();
  const providerLabel = getHealthProviderName();
  const showHealthData = (isHealthConnected && Platform.OS !== 'web') || demo;

  const [selectedRange, setSelectedRange] = useState<DateRange>('month');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  // Demo data
  const demoHistory = useMemo(() => (demo ? getDemoWorkoutHistory() : []), [demo]);
  const demoVolume = useMemo(() => (demo ? getDemoWeeklyVolume() : []), [demo]);
  const demoPRs = useMemo(() => (demo ? getDemoPersonalRecords() : []), [demo]);
  const demoNutritionWeek = useMemo(() => (demo ? getDemoNutritionWeek() : []), [demo]);

  const displayTotalWorkouts = demo ? 10 : totalWorkouts;
  const displayTotalVolume = demo ? demoHistory.reduce((s, h) => s + h.totalVolume, 0) : totalVolume;
  const displayStreak = useMemo(() => {
    if (demo) return DEMO_STREAK.currentStreak;
    const h = history ?? [];
    if (h.length === 0) return 0;
    // Get unique workout dates sorted descending
    const dates = [...new Set(h.map((s: any) => {
      const d = new Date(s.completedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }))].sort().reverse();
    let streak = 0;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;
    let expected = new Date(dates[0]);
    for (const d of dates) {
      const expStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
      if (d === expStr) {
        streak++;
        expected = new Date(expected.getTime() - 86400000);
      } else if (d < expStr) {
        break;
      }
    }
    return streak;
  }, [demo, history]);
  const displayPRs = demo ? demoPRs : allRecords;
  const displayRecentPRs = demo
    ? demoPRs.map((pr) => ({
        exerciseId: pr.exerciseId,
        type: 'weight' as const,
        value: pr.heaviestWeight?.weight ?? 0,
        date: pr.heaviestWeight?.date ?? '',
        reps: pr.heaviestWeight?.reps ?? 0,
      }))
    : recentPRs.map((pr) => ({ ...pr, reps: 0 }));
  const displayVolume = demo ? demoVolume : weeklyVolume;
  const displayWeight = demo ? DEMO_HEALTH_DATA.recentWeight : recentWeight;
  const displayHistory: CompletedSession[] = demo ? demoHistory : history;

  // Initialize sub-stores
  useEffect(() => {
    if (!measurementsInitialized) initMeasurements();
    if (!achievementsInitialized) initAchievements();
    if (!healthInitialized) initHealth();
  }, [measurementsInitialized, achievementsInitialized, healthInitialized, initMeasurements, initAchievements, initHealth]);

  // Check achievements when data changes
  useEffect(() => {
    if (!isInitialized && !demo) return;
    if (!achievementsInitialized) return;
    const newly = checkAchievements();
    if (newly.length > 0) {
      setCongratsAchievements(newly);
      setShowCongrats(true);
    }
  }, [isInitialized, achievementsInitialized, totalWorkouts, totalPRs, measurements.length]);

  const handleDismissCongrats = useCallback(() => {
    setShowCongrats(false);
    setCongratsAchievements([]);
    clearNewlyEarned();
  }, [clearNewlyEarned]);

  // ── Measurements data for card ─────────────────────────────────

  const latestMeasurement = measurements.length > 0 ? measurements[0] : null;
  const prevMeasurement = measurements.length > 1 ? measurements[1] : null;
  const latestWeight = latestMeasurement?.weightKg;
  const prevWeight = prevMeasurement?.weightKg;
  const weightTrend =
    latestWeight != null && prevWeight != null
      ? latestWeight > prevWeight ? 'up' : latestWeight < prevWeight ? 'down' : 'same'
      : null;
  const displayMeasurementWeight = (kg: number) =>
    imperial ? `${(kg * KG_TO_LB).toFixed(1)} lbs` : `${kg.toFixed(1)} kg`;

  // ── Achievements data ──────────────────────────────────────────

  const earnedIds = new Set(earnedAchievements.map((e) => e.id));
  const earnedCount = earnedAchievements.length;
  const totalAchievementCount = ACHIEVEMENTS.length;

  // ── Filtered history by date range ─────────────────────────────

  const filteredHistory = useMemo(() => {
    const start = getStartDate(selectedRange);
    return displayHistory.filter((s) => new Date(s.completedAt) >= start);
  }, [displayHistory, selectedRange]);

  // ── Monthly Volume Comparison ──────────────────────────────────

  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let currentVol = 0;
    let prevVol = 0;

    for (const session of displayHistory) {
      const date = new Date(session.completedAt);
      if (date >= thisMonthStart) {
        currentVol += session.totalVolume;
      } else if (date >= lastMonthStart && date <= lastMonthEnd) {
        prevVol += session.totalVolume;
      }
    }

    const change = prevVol > 0 ? ((currentVol - prevVol) / prevVol) * 100 : currentVol > 0 ? 100 : 0;
    return { current: currentVol, previous: prevVol, change };
  }, [displayHistory]);

  // ── Workout Frequency ──────────────────────────────────────────

  const workoutFrequency = useMemo(() => {
    const days = getDaysForRange(selectedRange);
    const numWeeks = Math.max(Math.ceil(days / 7), 1);
    const weeks: { label: string; count: number }[] = [];

    for (let w = numWeeks - 1; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const count = filteredHistory.filter((s) => {
        const d = new Date(s.completedAt);
        return d >= weekStart && d <= weekEnd;
      }).length;

      const label = `W${numWeeks - w}`;
      weeks.push({ label, count });
    }

    // Cap to reasonable display
    const displayWeeks = weeks.slice(-Math.min(weeks.length, selectedRange === 'year' ? 12 : selectedRange === '3months' ? 12 : selectedRange === 'month' ? 4 : 1));
    const avg = displayWeeks.length > 0 ? displayWeeks.reduce((s, w) => s + w.count, 0) / displayWeeks.length : 0;

    return { weeks: displayWeeks, avgPerWeek: avg };
  }, [filteredHistory, selectedRange]);

  // ── Muscle Group Balance ───────────────────────────────────────

  const muscleGroupBalance = useMemo(() => {
    const counts: Record<string, number> = {};
    const exerciseLib = exercises;

    for (const session of filteredHistory) {
      for (const ex of session.exercises) {
        const libEntry = exerciseLib.find((e) => e.id === ex.exerciseId);
        const category = libEntry?.category ?? 'full_body';
        const setCount = ex.sets.filter((s) => s.setType !== 'warmup').length;
        counts[category] = (counts[category] ?? 0) + setCount;
      }
    }

    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    const groups = Object.entries(counts)
      .map(([group, sets]) => ({
        group: group as MuscleGroup,
        label: MUSCLE_GROUP_LABELS[group as MuscleGroup] ?? group,
        sets,
        pct: total > 0 ? (sets / total) * 100 : 0,
        color: MUSCLE_COLORS[group] ?? colors.primary,
      }))
      .sort((a, b) => b.sets - a.sets);

    return { groups, total };
  }, [filteredHistory, exercises, colors.primary]);

  // ── Nutrition Adherence Over Time ──────────────────────────────

  const nutritionAdherenceData = useMemo(() => {
    const calorieTarget = demo ? DEMO_NUTRITION_TARGETS.calories : nutritionTargets.calories;
    if (!calorieTarget) return { days: [], weeklyAvg: 0 };

    if (demo && demoNutritionWeek.length > 0) {
      const days = demoNutritionWeek.map((d, i) => {
        const pct = (d.consumed.calories / calorieTarget) * 100;
        const deviation = Math.abs(pct - 100);
        return {
          label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i % 7],
          pct,
          status: deviation <= 10 ? ('green' as const) : deviation <= 25 ? ('yellow' as const) : ('red' as const),
        };
      });
      const avg = days.reduce((s, d) => s + d.pct, 0) / days.length;
      return { days, weeklyAvg: avg };
    }

    const start = getStartDate(selectedRange);
    const days: { label: string; pct: number; status: 'green' | 'yellow' | 'red' }[] = [];
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const now = new Date();
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const log = dailyLogs[dateStr];
      if (!log || !log.meals || log.meals.length === 0) continue;

      const consumed = log.meals.reduce((sum, m) => sum + m.items.reduce((s, i) => s + i.calories, 0), 0);
      const pct = (consumed / calorieTarget) * 100;
      const deviation = Math.abs(pct - 100);

      days.push({
        label: dayLabels[d.getDay()],
        pct,
        status: deviation <= 10 ? 'green' : deviation <= 25 ? 'yellow' : 'red',
      });
    }

    // Take last 14 days max for chart display
    const displayDays = days.slice(-14);
    const avg = displayDays.length > 0 ? displayDays.reduce((s, d) => s + d.pct, 0) / displayDays.length : 0;
    return { days: displayDays, weeklyAvg: avg };
  }, [demo, demoNutritionWeek, dailyLogs, nutritionTargets, selectedRange]);

  // ── Volume chart ───────────────────────────────────────────────

  const maxVol = Math.max(...displayVolume.map((d) => d.volume), 1);
  const dayLabels = displayVolume.map((d) => {
    const date = new Date(d.date);
    return ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][date.getDay()];
  });

  // ── Exercises with PRs for strength progress ───────────────────

  const exerciseOptions = useMemo(() => {
    const lookupName = (id: string) =>
      exercises.find((e: any) => e.id === id)?.name ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    if (demo) {
      return demoPRs.map((pr) => ({ id: pr.exerciseId, name: lookupName(pr.exerciseId) }));
    }
    return allRecords.map((pr) => ({ id: pr.exerciseId, name: lookupName(pr.exerciseId) }));
  }, [demo, demoPRs, allRecords, exercises]);

  const selectedPRData = useMemo(() => {
    if (!selectedExercise) return null;
    if (demo) {
      const pr = demoPRs.find((p) => p.exerciseId === selectedExercise);
      return pr
        ? [
            { date: 'Week 1', maxWeight: (pr.heaviestWeight?.weight ?? 0) - 2.5, maxVolume: 0 },
            { date: 'Week 2', maxWeight: pr.heaviestWeight?.weight ?? 0, maxVolume: 0 },
          ]
        : null;
    }
    const data = getExercisePRHistory(selectedExercise);
    return data.length > 0 ? data : null;
  }, [selectedExercise, demo, demoPRs, getExercisePRHistory]);

  // ── Best PRs (enhanced) ────────────────────────────────────────

  const bestPRs = useMemo(() => {
    const prs: Array<{
      exerciseId: string;
      exerciseName: string;
      weight: number;
      reps: number;
      date: string;
    }> = [];

    const lookupName = (id: string) =>
      exercises.find((e: any) => e.id === id)?.name ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    const records = demo ? demoPRs : allRecords;

    for (const record of records) {
      if (record.heaviestWeight) {
        prs.push({
          exerciseId: record.exerciseId,
          exerciseName: lookupName(record.exerciseId),
          weight: record.heaviestWeight.weight,
          reps: record.heaviestWeight.reps,
          date: record.heaviestWeight.date,
        });
      }
    }

    return prs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [demo, demoPRs, allRecords, exercises]);

  // ── Inline Insight (workout / streak) ──────────────────────────
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);
  const progressInsight = useMemo(() => {
    const recentPRList = bestPRs.map((pr) => ({
      exercise: pr.exerciseName,
      weight: pr.weight,
      date: pr.date,
    }));
    const wTrend: 'up' | 'down' | 'stable' | undefined =
      weightTrend === 'up' ? 'up' : weightTrend === 'down' ? 'down' : weightTrend === 'same' ? 'stable' : undefined;
    const ctx: InsightCtx = {
      timeOfDay: new Date().getHours(),
      workoutsThisWeek: filteredHistory.length,
      currentStreak: displayStreak,
      lastWorkoutDate: displayHistory[0]?.completedAt?.split('T')[0],
      recentPRs: recentPRList,
      weightTrend: wTrend,
    };
    return generateInsights(ctx)
      .filter((i) => i.category === 'workout' || i.category === 'streak')
      .slice(0, 1)[0] ?? null;
  }, [bestPRs, weightTrend, filteredHistory, displayStreak, displayHistory]);

  const handleAskInsight = useCallback((prompt: string) => {
    setPrefilledContext('progress', prompt);
    router.push('/(tabs)/coach');
  }, [setPrefilledContext, router]);

  // ── Quick Actions ──────────────────────────────────────────────

  const quickActions = useQuickActions();

  const handleStatLongPress = useCallback(
    (label: string, expandFn: () => void) => {
      quickActions.show({
        title: label,
        subtitle: 'Quick Actions',
        actions: [
          {
            id: 'see-trend',
            label: 'See Full Trend',
            icon: 'analytics-outline',
            onPress: expandFn,
          },
          {
            id: 'set-goal',
            label: 'Set Goal',
            icon: 'flag-outline',
            onPress: () => {},
            badge: 'Soon',
            disabled: true,
          },
          {
            id: 'share',
            label: 'Share',
            icon: 'share-outline',
            onPress: () => {},
            badge: 'Soon',
            disabled: true,
          },
        ],
      });
    },
    [quickActions],
  );

  const handlePRLongPress = useCallback(
    (exerciseName: string, expandFn: () => void) => {
      quickActions.show({
        title: exerciseName,
        subtitle: 'PR Actions',
        actions: [
          {
            id: 'view-history',
            label: 'View Exercise History',
            icon: 'time-outline',
            onPress: expandFn,
          },
          {
            id: 'challenge',
            label: 'Challenge Yourself',
            icon: 'flash-outline',
            onPress: () => {},
            badge: 'AI',
            disabled: true,
          },
        ],
      });
    },
    [quickActions],
  );

  // ── Sparkline Data for Stat Cards ────────────────────────────────

  const workoutSparkline = useMemo(() => {
    // Group workouts by week over the last 12 weeks
    const weeks: number[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const count = displayHistory.filter((s) => {
        const d = new Date(s.completedAt);
        return d >= weekStart && d <= weekEnd;
      }).length;
      weeks.push(count);
    }
    return weeks;
  }, [displayHistory]);

  const volumeSparkline = useMemo(() => {
    const weeks: number[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const vol = displayHistory
        .filter((s) => {
          const d = new Date(s.completedAt);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((sum, s) => sum + s.totalVolume, 0);
      weeks.push(vol);
    }
    return weeks;
  }, [displayHistory]);

  const getTrendDirection = useCallback((data: number[]): 'up' | 'steady' | 'down' => {
    if (data.length < 2) return 'steady';
    const recent = data.slice(-3);
    const earlier = data.slice(-6, -3);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const earlierAvg = earlier.length > 0 ? earlier.reduce((s, v) => s + v, 0) / earlier.length : recentAvg;
    const pctChange = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
    if (pctChange > 5) return 'up';
    if (pctChange < -5) return 'down';
    return 'steady';
  }, []);

  const trendArrow = useCallback((dir: 'up' | 'steady' | 'down') => {
    switch (dir) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  }, []);

  const trendColor = useCallback((dir: 'up' | 'steady' | 'down', colors: { success: string; error: string; textTertiary: string }) => {
    switch (dir) {
      case 'up': return colors.success;
      case 'down': return colors.error;
      default: return colors.textTertiary;
    }
  }, []);

  // ── Measurement sparkline ────────────────────────────────────────

  const weightSparkline = useMemo(() => {
    return measurements
      .filter((m) => m.weightKg != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-12)
      .map((m) => m.weightKg as number);
  }, [measurements]);

  // ── Muscle anatomy highlights ────────────────────────────────────

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);

  const muscleAnatomyHighlights = useMemo(() => {
    const muscleGroupToMuscleIds: Record<string, MuscleId[]> = {
      chest: ['pectoralis_major', 'pectoralis_minor'],
      back: ['latissimus_dorsi', 'trapezius', 'rhomboids', 'erector_spinae'],
      shoulders: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
      legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'hip_flexors'],
      arms: ['biceps', 'triceps', 'forearms', 'brachialis'],
      core: ['rectus_abdominis', 'obliques', 'transverse_abdominis'],
    };

    const maxSets = Math.max(...muscleGroupBalance.groups.map((g) => g.sets), 1);
    const highlights: Array<{ muscleId: MuscleId; state: 'fresh' | 'targeted' | 'recovering' | 'inactive'; opacity: number }> = [];

    for (const group of muscleGroupBalance.groups) {
      const ids = muscleGroupToMuscleIds[group.group];
      if (!ids) continue;
      const intensity = group.sets / maxSets;
      const state = intensity > 0.6 ? 'targeted' as const : intensity > 0.2 ? 'fresh' as const : 'inactive' as const;
      for (const id of ids) {
        highlights.push({ muscleId: id, state, opacity: Math.max(intensity, 0.2) });
      }
    }
    return highlights;
  }, [muscleGroupBalance]);

  // ── ExpandableCard ref triggers ──────────────────────────────────
  // We track expanded states so long-press quick actions can expand cards
  const [expandedStats, setExpandedStats] = useState<Record<string, boolean>>({});
  const statExpandToggle = useCallback((key: string) => {
    setExpandedStats((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!isInitialized && !demo) {
    return (
      <ScreenContainer>
        <ProgressTabSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: colors.text }]}>Progress</Text>
          <SmartHeader tab="progress" />
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Date Range Selector */}
      <View style={[styles.rangeSelector, { marginBottom: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }]}>
        {DATE_RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSelectedRange(opt.key)}
            style={[
              styles.rangeOption,
              {
                backgroundColor: selectedRange === opt.key ? colors.surface : 'transparent',
                borderRadius: radius.sm,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                typography.label,
                {
                  color: selectedRange === opt.key ? colors.primary : colors.textSecondary,
                  textAlign: 'center',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Overview — ExpandableCard + AnimatedNumber */}
      <View style={[styles.statsRow, { marginBottom: spacing.base, gap: spacing.sm }]}>
        {/* Workouts */}
        <View style={{ flex: 1 }}>
          <ExpandableCard
            expandedContent={
              <View>
                <Sparkline data={workoutSparkline} width={100} height={40} showFill animated />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                  <Text style={[typography.caption, { color: trendColor(getTrendDirection(workoutSparkline), colors) }]}>
                    {trendArrow(getTrendDirection(workoutSparkline))} {getTrendDirection(workoutSparkline) === 'up' ? 'Improving' : getTrendDirection(workoutSparkline) === 'down' ? 'Declining' : 'Steady'}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                  All-time: {displayTotalWorkouts} workouts
                </Text>
              </View>
            }
          >
            <Pressable
              onLongPress={() => handleStatLongPress('Workouts', () => statExpandToggle('workouts'))}
              style={styles.statCard}
            >
              <Ionicons name="barbell-outline" size={20} color={colors.primary} />
              <AnimatedNumber
                value={filteredHistory.length}
                animateOnMount
                style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Workouts</Text>
            </Pressable>
          </ExpandableCard>
        </View>

        {/* Streak */}
        <View style={{ flex: 1 }}>
          <ExpandableCard
            expandedContent={
              <View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Current streak
                </Text>
                <Text style={[typography.h3, { color: colors.warning, marginTop: spacing.xs }]}>
                  {displayStreak} days 🔥
                </Text>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                  Keep going! Consistency is key.
                </Text>
              </View>
            }
          >
            <Pressable
              onLongPress={() => handleStatLongPress('Streak', () => statExpandToggle('streak'))}
              style={styles.statCard}
            >
              <Ionicons name="flame-outline" size={20} color={colors.primary} />
              <AnimatedNumber
                value={displayStreak}
                animateOnMount
                style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}
                formatter={(n) => `${Math.round(n)}d`}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Streak</Text>
            </Pressable>
          </ExpandableCard>
        </View>

        {/* PRs */}
        <View style={{ flex: 1 }}>
          <ExpandableCard
            expandedContent={
              <View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Total personal records
                </Text>
                <Text style={[typography.h3, { color: colors.warning, marginTop: spacing.xs }]}>
                  {displayRecentPRs.length} PRs
                </Text>
                {displayRecentPRs.length > 0 && (
                  <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                    Latest: {displayRecentPRs[0]?.date
                      ? new Date(displayRecentPRs[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'N/A'}
                  </Text>
                )}
              </View>
            }
          >
            <Pressable
              onLongPress={() => handleStatLongPress('PRs', () => statExpandToggle('prs'))}
              style={styles.statCard}
            >
              <Ionicons name="trophy-outline" size={20} color={colors.primary} />
              <AnimatedNumber
                value={displayRecentPRs.length}
                animateOnMount
                style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>PRs</Text>
            </Pressable>
          </ExpandableCard>
        </View>
      </View>

      {/* Achievements Section — ExpandableCard per badge */}
      <View style={{ marginBottom: spacing.lg }}>
        <View style={[styles.sectionTitleRow, { marginBottom: spacing.md, justifyContent: 'space-between' }]}>
          <Text style={[typography.h3, { color: colors.text }]}>Achievements</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {earnedCount} of {totalAchievementCount} earned
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.base }}
        >
          {ACHIEVEMENTS.map((achievement) => {
            const earned = earnedIds.has(achievement.id);
            const earnedEntry = earnedAchievements.find((e) => e.id === achievement.id);
            return (
              <ExpandableCard
                key={achievement.id}
                style={{ width: 100 }}
                expandedContent={
                  <View>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      {achievement.description}
                    </Text>
                    {earned && earnedEntry?.dateEarned ? (
                      <Text style={[typography.caption, { color: colors.success }]}>
                        Earned {new Date(earnedEntry.dateEarned).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    ) : (
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {achievement.progressHint
                          ? achievement.progressHint({
                              totalWorkouts: displayTotalWorkouts,
                              totalPRs: displayRecentPRs.length,
                              totalVolumeLbs: displayTotalVolume * KG_TO_LB,
                              currentStreak: displayStreak,
                              totalMealsLogged,
                              consecutiveMealDays: 0, // TODO: compute consecutive days with meals logged
                              totalPhotos: photoCount,
                              completedAllPlannedThisWeek: false, // TODO: requires cross-referencing program schedule
                              history: [],
                            })
                          : 'Keep going!'}
                      </Text>
                    )}
                    <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                      Category: {achievement.category}
                    </Text>
                  </View>
                }
              >
                <AchievementBadge
                  achievement={achievement}
                  earned={earned}
                  earnedDate={earnedEntry?.dateEarned}
                  progressHint={
                    !earned && achievement.progressHint
                      ? achievement.progressHint({
                          totalWorkouts: displayTotalWorkouts,
                          totalPRs: displayRecentPRs.length,
                          totalVolumeLbs: displayTotalVolume * KG_TO_LB,
                          currentStreak: displayStreak,
                          totalMealsLogged,
                          consecutiveMealDays: 0, // TODO: compute consecutive days with meals logged
                          totalPhotos: photoCount,
                          completedAllPlannedThisWeek: false, // TODO: requires cross-referencing program schedule
                          history: [],
                        })
                      : undefined
                  }
                  size="sm"
                />
              </ExpandableCard>
            );
          })}
        </ScrollView>
      </View>

      {/* Monthly Volume Comparison — AnimatedNumber */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Monthly Volume
        </Text>
        <Card>
          <View style={styles.monthlyCompare}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>This Month</Text>
              <AnimatedNumber
                value={Math.round(monthlyComparison.current)}
                animateOnMount
                style={[typography.h2, { color: colors.text }]}
                formatter={(n) => `${Math.round(n).toLocaleString()} kg`}
              />
              <View style={[styles.volBar, { marginTop: spacing.sm }]}>
                <View
                  style={{
                    height: 8,
                    borderRadius: radius.sm,
                    backgroundColor: colors.primary,
                    width: monthlyComparison.previous > 0
                      ? `${Math.min((monthlyComparison.current / Math.max(monthlyComparison.current, monthlyComparison.previous)) * 100, 100)}%`
                      : monthlyComparison.current > 0 ? '100%' : '0%',
                  }}
                />
              </View>
            </View>
            <View style={{ width: spacing.base }} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Last Month</Text>
              <AnimatedNumber
                value={Math.round(monthlyComparison.previous)}
                animateOnMount
                style={[typography.h2, { color: colors.textSecondary }]}
                formatter={(n) => `${Math.round(n).toLocaleString()} kg`}
              />
              <View style={[styles.volBar, { marginTop: spacing.sm }]}>
                <View
                  style={{
                    height: 8,
                    borderRadius: radius.sm,
                    backgroundColor: colors.textTertiary,
                    width: monthlyComparison.current > 0
                      ? `${Math.min((monthlyComparison.previous / Math.max(monthlyComparison.current, monthlyComparison.previous)) * 100, 100)}%`
                      : monthlyComparison.previous > 0 ? '100%' : '0%',
                  }}
                />
              </View>
            </View>
          </View>
          {/* Change Indicator */}
          <View style={[styles.changeRow, { marginTop: spacing.md }]}>
            {monthlyComparison.previous === 0 && monthlyComparison.current > 0 ? (
              <>
                <Ionicons name="sparkles" size={16} color={colors.success} />
                <Text
                  style={[
                    typography.label,
                    { color: colors.success, marginLeft: 4 },
                  ]}
                >
                  New
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                  first month tracked
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name={monthlyComparison.change >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={16}
                  color={monthlyComparison.change >= 0 ? colors.success : colors.error}
                />
                <Text
                  style={[
                    typography.label,
                    {
                      color: monthlyComparison.change >= 0 ? colors.success : colors.error,
                      marginLeft: 4,
                    },
                  ]}
                >
                  {Math.abs(Math.round(monthlyComparison.change))}%
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                  vs last month
                </Text>
              </>
            )}
          </View>
        </Card>
      </View>

      {/* Weekly Volume Chart */}
      {displayVolume.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Workout Volume (This Week)
          </Text>
          <Card>
            <View style={styles.chartContainer}>
              {displayVolume.slice(-7).map((day, i) => {
                const height = maxVol > 0 ? (day.volume / maxVol) * 80 : 0;
                return (
                  <View key={day.date} style={styles.chartBar}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(height, 3),
                          backgroundColor: day.volume > 0 ? colors.primary : colors.surfaceSecondary,
                          borderRadius: radius.sm,
                        },
                      ]}
                    />
                    <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                      {dayLabels[i] ?? ''}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Total: </Text>
              <AnimatedNumber
                value={Math.round(displayVolume.reduce((s, d) => s + d.volume, 0))}
                animateOnMount
                style={[typography.bodySmall, { color: colors.textSecondary }]}
                formatter={(n) => `${Math.round(n).toLocaleString()} kg`}
              />
            </View>
          </Card>
        </View>
      )}

      {/* Workout Frequency Chart */}
      {workoutFrequency.weeks.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Workout Frequency
          </Text>
          <Card>
            <View style={styles.freqHeader}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Avg: {workoutFrequency.avgPerWeek.toFixed(1)} workouts/week
              </Text>
            </View>
            <View style={styles.chartContainer}>
              {(() => {
                const maxCount = Math.max(...workoutFrequency.weeks.map((w) => w.count), 1);
                return workoutFrequency.weeks.map((week, i) => {
                  const height = (week.count / maxCount) * 80;
                  return (
                    <View key={i} style={styles.chartBar}>
                      <Text style={[typography.caption, { color: colors.primary, marginBottom: 4 }]}>
                        {week.count}
                      </Text>
                      <View
                        style={{
                          height: Math.max(height, 3),
                          width: 24,
                          backgroundColor: week.count > 0 ? colors.info : colors.surfaceSecondary,
                          borderRadius: radius.sm,
                        }}
                      />
                      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                        {week.label}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
          </Card>
        </View>
      )}

      {/* Muscle Group Balance — ExpandableCard + MuscleAnatomyDiagram */}
      {muscleGroupBalance.groups.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Muscle Group Balance
          </Text>
          <ExpandableCard
            expandedContent={
              <View>
                {/* Interactive Muscle Anatomy Diagram */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                  <MuscleAnatomyDiagram
                    view="front"
                    highlights={muscleAnatomyHighlights}
                    width={130}
                    height={260}
                    interactive
                    onMusclePress={(muscleId) => {
                      // Map muscle ID back to group
                      const groupMap: Record<string, string> = {
                        pectoralis_major: 'chest', pectoralis_minor: 'chest',
                        latissimus_dorsi: 'back', trapezius: 'back', rhomboids: 'back', erector_spinae: 'back',
                        deltoid_anterior: 'shoulders', deltoid_lateral: 'shoulders', deltoid_posterior: 'shoulders',
                        quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
                        adductors: 'legs', hip_flexors: 'legs', abductors: 'legs',
                        biceps: 'arms', triceps: 'arms', forearms: 'arms', brachialis: 'arms',
                        rectus_abdominis: 'core', obliques: 'core', transverse_abdominis: 'core',
                      };
                      const group = groupMap[muscleId];
                      setSelectedMuscleGroup(group === selectedMuscleGroup ? null : (group ?? null));
                    }}
                    showLabels
                    variant="full"
                  />
                  <MuscleAnatomyDiagram
                    view="back"
                    highlights={muscleAnatomyHighlights}
                    width={130}
                    height={260}
                    interactive
                    onMusclePress={(muscleId) => {
                      const groupMap: Record<string, string> = {
                        latissimus_dorsi: 'back', trapezius: 'back', rhomboids: 'back',
                        erector_spinae: 'back', lower_back: 'back',
                        deltoid_posterior: 'shoulders', deltoid_lateral: 'shoulders',
                        hamstrings: 'legs', glutes: 'legs', gluteus_medius: 'legs',
                        calves: 'legs', gastrocnemius: 'legs', soleus: 'legs',
                        triceps: 'arms',
                      };
                      const group = groupMap[muscleId];
                      setSelectedMuscleGroup(group === selectedMuscleGroup ? null : (group ?? null));
                    }}
                    showLabels
                    variant="full"
                  />
                </View>
                {/* Selected muscle group detail */}
                {selectedMuscleGroup && (() => {
                  const group = muscleGroupBalance.groups.find((g) => g.group === selectedMuscleGroup);
                  if (!group) return null;
                  return (
                    <View style={[styles.muscleDetailCard, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                        <View style={[styles.colorDot, { backgroundColor: group.color }]} />
                        <Text style={[typography.label, { color: colors.text }]}>{group.label}</Text>
                      </View>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        {group.sets} sets · {Math.round(group.pct)}% of total
                      </Text>
                    </View>
                  );
                })()}
                <Text style={[typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
                  Tap a muscle group for details
                </Text>
              </View>
            }
          >
            {/* Collapsed: percentage bar list */}
            {muscleGroupBalance.groups.map((group) => {
              const isLow = group.pct < (100 / muscleGroupBalance.groups.length) * 0.5;
              return (
                <View key={group.group} style={[styles.muscleRow, { marginBottom: spacing.sm }]}>
                  <View style={styles.muscleLabel}>
                    <View style={[styles.colorDot, { backgroundColor: group.color }]} />
                    <Text
                      style={[
                        typography.label,
                        { color: isLow ? colors.warning : colors.text, flex: 1 },
                      ]}
                    >
                      {group.label}
                      {isLow ? ' ⚠' : ''}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {group.sets} sets · {Math.round(group.pct)}%
                    </Text>
                  </View>
                  <View style={[styles.muscleBarBg, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}>
                    <View
                      style={{
                        height: 6,
                        width: `${Math.min(group.pct, 100)}%`,
                        backgroundColor: group.color,
                        borderRadius: radius.sm,
                      }}
                    />
                  </View>
                </View>
              );
            })}
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              Based on {muscleGroupBalance.total} total sets in selected range
            </Text>
          </ExpandableCard>
        </View>
      )}

      {/* Weight Trend */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Weight Trend
        </Text>
        <Card>
          {displayWeight ? (
            <View>
              <View style={styles.weightRow}>
                <View>
                  <Text style={[typography.displayMedium, { color: colors.text }]}>
                    {displayWeight} kg
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    {demo ? 'Latest' : `via ${providerLabel}`}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.chartPlaceholder,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    height: 100,
                    marginTop: spacing.md,
                  },
                ]}
              >
                <Ionicons name="analytics-outline" size={28} color={colors.textTertiary} />
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                  Weight chart — add more weigh-ins
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.chartPlaceholder,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  height: 120,
                },
              ]}
            >
              <Ionicons name="analytics-outline" size={32} color={colors.textTertiary} />
              <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                Connect Health to track weight
              </Text>
            </View>
          )}
        </Card>
      </View>

      {/* Strength Progress per Exercise */}
      {exerciseOptions.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Strength Progress
          </Text>
          <View style={[styles.exerciseTabs, { gap: spacing.xs, marginBottom: spacing.md }]}>
            {exerciseOptions.slice(0, 4).map((ex) => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => setSelectedExercise(ex.id === selectedExercise ? null : ex.id)}
                style={[
                  styles.exerciseTab,
                  {
                    backgroundColor:
                      selectedExercise === ex.id ? colors.primary : colors.surfaceSecondary,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: selectedExercise === ex.id ? colors.textInverse : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {ex.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedPRData ? (
            <Card>
              {selectedPRData.map((point, i) => (
                <View
                  key={i}
                  style={[styles.progressPoint, { marginBottom: i < selectedPRData.length - 1 ? spacing.sm : 0 }]}
                >
                  <View
                    style={[
                      styles.progressDot,
                      { backgroundColor: colors.primary, borderRadius: radius.full },
                    ]}
                  />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>
                    {typeof point.date === 'string' && point.date.length > 10
                      ? new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : point.date}
                  </Text>
                  <Text style={[typography.label, { color: colors.text }]}>{point.maxWeight} kg</Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={[typography.body, { color: colors.textTertiary, textAlign: 'center', padding: spacing.md }]}>
                Select an exercise to see progress
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* Nutrition Adherence Chart */}
      {nutritionAdherenceData.days.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Nutrition Adherence
          </Text>
          <Card>
            <View style={styles.adherenceHeader}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Avg: {Math.round(nutritionAdherenceData.weeklyAvg)}% of calorie target
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
              <View style={styles.adherenceChart}>
                {nutritionAdherenceData.days.map((day, i) => {
                  const barHeight = Math.min((day.pct / 150) * 60, 60);
                  const statusColor =
                    day.status === 'green' ? colors.success :
                    day.status === 'yellow' ? colors.warning :
                    colors.error;
                  return (
                    <View key={i} style={[styles.adherenceBar, { marginRight: spacing.xs }]}>
                      <Text style={[{ fontSize: 9, color: colors.textTertiary, marginBottom: 2 }]}>
                        {Math.round(day.pct)}%
                      </Text>
                      <View
                        style={{
                          height: Math.max(barHeight, 3),
                          width: 16,
                          backgroundColor: statusColor,
                          borderRadius: radius.sm,
                        }}
                      />
                      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 3 }]}>
                        {day.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            {/* Legend */}
            <View style={[styles.legendRow, { marginTop: spacing.md }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={[typography.caption, { color: colors.textTertiary }]}>On target (±10%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                <Text style={[typography.caption, { color: colors.textTertiary }]}>Slight (±25%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                <Text style={[typography.caption, { color: colors.textTertiary }]}>Off target</Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Inline insight */}
      {progressInsight && (
        <View style={{ marginBottom: spacing.base }}>
          <InsightBadge
            insight={progressInsight}
            onAskMore={progressInsight.coachPrompt ? () => handleAskInsight(progressInsight.coachPrompt!) : undefined}
          />
        </View>
      )}

      {/* Best PRs Section — ExpandableCard per PR */}
      <View style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color={colors.warning} />
          <Text style={[typography.h3, { color: colors.text, marginLeft: spacing.xs }]}>
            Best PRs
          </Text>
        </View>
        {bestPRs.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No PRs Yet"
            description="Complete workouts to start tracking your personal records."
          />
        ) : (
          bestPRs.map((pr, index) => {
            const prHistory = demo ? null : getExercisePRHistory(pr.exerciseId);
            const prSparklineData = prHistory && prHistory.length >= 2
              ? prHistory.map((p) => p.maxWeight)
              : null;
            return (
              <View key={`${pr.exerciseId}-${index}`} style={{ marginBottom: spacing.sm }}>
                <ExpandableCard
                  expandedContent={
                    <View>
                      {prSparklineData ? (
                        <View>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                            Weight progression
                          </Text>
                          <Sparkline
                            data={prSparklineData}
                            width={260}
                            height={60}
                            showFill
                            showDots
                            animated
                          />
                          <View style={{ marginTop: spacing.sm }}>
                            {prHistory?.slice(-3).reverse().map((point, i) => (
                              <View key={i} style={[styles.progressPoint, { marginBottom: i < 2 ? spacing.xs : 0 }]}>
                                <View style={[styles.progressDot, { backgroundColor: colors.primary, borderRadius: radius.full }]} />
                                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>
                                  {typeof point.date === 'string' && point.date.length > 10
                                    ? new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : point.date}
                                </Text>
                                <Text style={[typography.label, { color: colors.text }]}>
                                  {point.maxWeight} kg
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : (
                        <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                          Log more sessions to see weight progression.
                        </Text>
                      )}
                    </View>
                  }
                >
                  <Pressable
                    onLongPress={() => handlePRLongPress(pr.exerciseName, () => {})}
                  >
                    <View style={styles.prRow}>
                      <View
                        style={[
                          styles.prRank,
                          {
                            backgroundColor: index === 0 ? colors.warningLight : colors.surfaceSecondary,
                            borderRadius: radius.md,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.label,
                            { color: index === 0 ? colors.warning : colors.textTertiary },
                          ]}
                        >
                          #{index + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={[typography.label, { color: colors.text }]}>
                          {pr.exerciseName}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                          {pr.weight} kg x {pr.reps} reps
                        </Text>
                      </View>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {pr.date
                          ? new Date(pr.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                </ExpandableCard>
              </View>
            );
          })
        )}
      </View>

      {/* Body Measurements — ExpandableCard with weight sparkline */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Body Measurements
        </Text>
        <ExpandableCard
          expandedContent={
            <View>
              {weightSparkline.length >= 2 ? (
                <View>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                    Weight trend
                  </Text>
                  <Sparkline
                    data={weightSparkline}
                    width={260}
                    height={60}
                    showFill
                    showDots
                    animated
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>
                      Low: {imperial
                        ? `${(Math.min(...weightSparkline) * KG_TO_LB).toFixed(1)} lbs`
                        : `${Math.min(...weightSparkline).toFixed(1)} kg`}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>
                      High: {imperial
                        ? `${(Math.max(...weightSparkline) * KG_TO_LB).toFixed(1)} lbs`
                        : `${Math.max(...weightSparkline).toFixed(1)} kg`}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                  Log more weigh-ins to see your trend.
                </Text>
              )}
              <TouchableOpacity
                onPress={() => router.push('/progress/measurements')}
                style={[styles.expandedLink, { marginTop: spacing.md }]}
              >
                <Text style={[typography.label, { color: colors.primary }]}>
                  View All Measurements
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          }
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/progress/measurements')}
          >
            {latestMeasurement && latestWeight != null ? (
              <View style={styles.measurementCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Latest Weight
                  </Text>
                  <View style={styles.weightTrendRow}>
                    <AnimatedNumber
                      value={imperial ? latestWeight * KG_TO_LB : latestWeight}
                      animateOnMount
                      decimals={1}
                      style={[typography.h2, { color: colors.text }]}
                      formatter={(n) => imperial ? `${n.toFixed(1)} lbs` : `${n.toFixed(1)} kg`}
                    />
                    {weightTrend && (
                      <Ionicons
                        name={
                          weightTrend === 'up'
                            ? 'arrow-up'
                            : weightTrend === 'down'
                              ? 'arrow-down'
                              : 'remove'
                        }
                        size={18}
                        color={
                          weightTrend === 'up'
                            ? colors.error
                            : weightTrend === 'down'
                              ? colors.success
                              : colors.textTertiary
                        }
                        style={{ marginLeft: spacing.xs }}
                      />
                    )}
                    {weightSparkline.length >= 2 && (
                      <Sparkline
                        data={weightSparkline}
                        variant="inline"
                        style={{ marginLeft: spacing.sm }}
                      />
                    )}
                  </View>
                  <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    {new Date(latestMeasurement.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' \u00B7 '}
                    {measurements.length} measurement{measurements.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
            ) : (
              <View style={styles.measurementCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                    <Ionicons name="body-outline" size={20} color={colors.textTertiary} />
                    <Text
                      style={[
                        typography.label,
                        { color: colors.text, marginLeft: spacing.sm },
                      ]}
                    >
                      Track your body
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Log weight, measurements, and progress photos
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
            )}
          </TouchableOpacity>
        </ExpandableCard>
      </View>

      {/* Congratulations Modal */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={handleDismissCongrats}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleDismissCongrats}
        >
          <View
            style={[
              styles.congratsContainer,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.xl,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.md }}>
              {String.fromCodePoint(0x1F3C6)}
            </Text>
            <Text
              style={[
                typography.h2,
                { color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
              ]}
            >
              Achievement Unlocked!
            </Text>
            {congratsAchievements.map((id) => {
              const achievement = ACHIEVEMENTS.find((a) => a.id === id);
              if (!achievement) return null;
              return (
                <View key={id} style={{ alignItems: 'center', marginTop: spacing.md }}>
                  <AchievementBadge
                    achievement={achievement}
                    earned
                    earnedDate={new Date().toISOString()}
                    size="md"
                  />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
                    ]}
                  >
                    {achievement.description}
                  </Text>
                </View>
              );
            })}
            <TouchableOpacity
              onPress={handleDismissCongrats}
              style={[
                styles.congratsButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  marginTop: spacing.xl,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xl,
                },
              ]}
            >
              <Text style={[typography.label, { color: colors.textInverse }]}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Action Sheet */}
      <QuickActionSheet {...quickActions.sheetProps} />

      <CoachFAB context="progress" label="Analyze My Progress" prefilledMessage="Analyze my progress this week" />
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeSelector: {
    flexDirection: 'row',
  },
  rangeOption: {
    flex: 1,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCard: {
    alignItems: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: 16,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    minHeight: 3,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseTab: {
    minWidth: 70,
  },
  progressPoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prRank: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyCompare: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  volBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freqHeader: {
    marginBottom: 8,
  },
  muscleRow: {},
  muscleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  muscleBarBg: {
    height: 6,
    overflow: 'hidden',
  },
  adherenceHeader: {},
  adherenceChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 90,
    paddingTop: 10,
  },
  adherenceBar: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurementCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  congratsContainer: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  congratsButton: {
    alignItems: 'center',
    width: '100%',
  },
  muscleDetailCard: {},
  expandedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
