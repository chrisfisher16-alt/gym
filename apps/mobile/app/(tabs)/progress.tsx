import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, EmptyState, LoadingSpinner } from '../../src/components/ui';
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
  const displayStreak = demo ? DEMO_STREAK.currentStreak : 0;
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
  }, [measurementsInitialized, achievementsInitialized, initMeasurements, initAchievements]);

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
      const dateStr = d.toISOString().split('T')[0];
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
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // ── Exercises with PRs for strength progress ───────────────────

  const exerciseOptions = useMemo(() => {
    const names: Record<string, string> = {
      'bench-press': 'Bench Press',
      squat: 'Barbell Squat',
      deadlift: 'Deadlift',
      'overhead-press': 'Overhead Press',
      'barbell-row': 'Barbell Row',
      'lat-pulldown': 'Lat Pulldown',
      'barbell-curl': 'Barbell Curl',
      'incline-db-press': 'Incline DB Press',
    };
    if (demo) {
      return demoPRs.map((pr) => ({ id: pr.exerciseId, name: names[pr.exerciseId] ?? pr.exerciseId }));
    }
    return allRecords.map((pr) => ({ id: pr.exerciseId, name: names[pr.exerciseId] ?? pr.exerciseId }));
  }, [demo, demoPRs, allRecords]);

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

    const exNames: Record<string, string> = {
      'bench-press': 'Bench Press',
      squat: 'Barbell Squat',
      deadlift: 'Deadlift',
      'overhead-press': 'Overhead Press',
      'barbell-row': 'Barbell Row',
      'lat-pulldown': 'Lat Pulldown',
      'barbell-curl': 'Barbell Curl',
      'incline-db-press': 'Incline DB Press',
    };

    const records = demo ? demoPRs : allRecords;

    for (const record of records) {
      if (record.heaviestWeight) {
        prs.push({
          exerciseId: record.exerciseId,
          exerciseName: exNames[record.exerciseId] ?? record.exerciseId,
          weight: record.heaviestWeight.weight,
          reps: record.heaviestWeight.reps,
          date: record.heaviestWeight.date,
        });
      }
    }

    return prs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [demo, demoPRs, allRecords]);

  if (!isInitialized && !demo) {
    return (
      <ScreenContainer>
        <LoadingSpinner fullScreen message="Loading your progress..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Progress</Text>
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

      {/* Stats Overview */}
      <View style={[styles.statsRow, { marginBottom: spacing.base, gap: spacing.sm }]}>
        {[
          { label: 'Workouts', value: String(filteredHistory.length), icon: 'barbell-outline' as const },
          { label: 'Streak', value: `${displayStreak}d`, icon: 'flame-outline' as const },
          { label: 'PRs', value: String(displayRecentPRs.length), icon: 'trophy-outline' as const },
        ].map((stat) => (
          <Card key={stat.label} style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name={stat.icon} size={20} color={colors.primary} />
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
              {stat.value}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {/* Achievements Section */}
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
              <AchievementBadge
                key={achievement.id}
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
                        totalMealsLogged: 0,
                        consecutiveMealDays: 0,
                        totalPhotos: useMeasurementsStore.getState().photos.length,
                        completedAllPlannedThisWeek: false,
                        history: [],
                      })
                    : undefined
                }
                size="sm"
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Monthly Volume Comparison */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Monthly Volume
        </Text>
        <Card>
          <View style={styles.monthlyCompare}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>This Month</Text>
              <Text style={[typography.h2, { color: colors.text }]}>
                {Math.round(monthlyComparison.current).toLocaleString()} kg
              </Text>
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
              <Text style={[typography.h2, { color: colors.textSecondary }]}>
                {Math.round(monthlyComparison.previous).toLocaleString()} kg
              </Text>
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
                      {dayLabels[i % 7]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
              Total: {Math.round(displayVolume.reduce((s, d) => s + d.volume, 0)).toLocaleString()} kg
            </Text>
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

      {/* Muscle Group Balance */}
      {muscleGroupBalance.groups.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Muscle Group Balance
          </Text>
          <Card>
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
          </Card>
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

      {/* Best PRs Section (Enhanced) */}
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
          bestPRs.map((pr, index) => (
            <Card key={`${pr.exerciseId}-${index}`} style={{ marginBottom: spacing.sm }}>
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
            </Card>
          ))
        )}
      </View>

      {/* Body Measurements Card */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Body Measurements
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/progress/measurements')}
        >
          <Card>
            {latestMeasurement && latestWeight != null ? (
              <View style={styles.measurementCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Latest Weight
                  </Text>
                  <View style={styles.weightTrendRow}>
                    <Text style={[typography.h2, { color: colors.text }]}>
                      {displayMeasurementWeight(latestWeight)}
                    </Text>
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
          </Card>
        </TouchableOpacity>
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

      <CoachFAB context="progress" label="Analyze My Progress" prefilledMessage="Analyze my progress this week" />
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
});
