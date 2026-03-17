import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, EmptyState, LoadingSpinner } from '../../src/components/ui';
import { useHealthStore } from '../../src/stores/health-store';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { usePersonalRecords } from '../../src/hooks/usePersonalRecords';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { getHealthProviderName } from '../../src/lib/health';
import { CoachFAB } from '../../src/components/CoachFAB';
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

export default function ProgressTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const isHealthConnected = useHealthStore((s) => s.isConnected);
  const recentWeight = useHealthStore((s) => s.recentWeight);
  const syncEnabled = useHealthStore((s) => s.syncEnabled);
  const isInitialized = useWorkoutStore((s) => s.isInitialized);

  const { totalWorkouts, totalVolume, totalPRs, weeklyVolume } = useWorkoutHistory();
  const { allRecords, recentPRs, getExercisePRHistory } = usePersonalRecords();
  const { targets } = useNutritionDashboard();

  const demo = isDemoMode();
  const providerLabel = getHealthProviderName();
  const showHealthData = (isHealthConnected && Platform.OS !== 'web') || demo;

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
      }))
    : recentPRs;
  const displayVolume = demo ? demoVolume : weeklyVolume;
  const displayWeight = demo ? DEMO_HEALTH_DATA.recentWeight : recentWeight;

  // Nutrition adherence
  const nutritionAdherence = useMemo(() => {
    if (demo && demoNutritionWeek.length > 0) {
      const hitDays = demoNutritionWeek.filter(
        (d) =>
          d.consumed.calories >= DEMO_NUTRITION_TARGETS.calories * 0.85 &&
          d.consumed.calories <= DEMO_NUTRITION_TARGETS.calories * 1.15,
      ).length;
      return Math.round((hitDays / demoNutritionWeek.length) * 100);
    }
    return null;
  }, [demo, demoNutritionWeek]);

  // Volume chart
  const maxVol = Math.max(...displayVolume.map((d) => d.volume), 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Exercises with PRs for the selector
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

      {/* Stats Overview */}
      <View style={[styles.statsRow, { marginBottom: spacing.base, gap: spacing.sm }]}>
        {[
          { label: 'Workouts', value: String(displayTotalWorkouts), icon: 'barbell-outline' as const },
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

      {/* Nutrition Adherence */}
      {(nutritionAdherence !== null || demo) && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Nutrition Adherence
          </Text>
          <Card>
            <View style={styles.adherenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.displayMedium, { color: colors.text }]}>
                  {nutritionAdherence ?? 0}%
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  of days hitting calorie targets (±15%)
                </Text>
              </View>
              <View
                style={[
                  styles.adherenceBadge,
                  {
                    backgroundColor:
                      (nutritionAdherence ?? 0) >= 80 ? colors.successLight : colors.warningLight,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.label,
                    {
                      color: (nutritionAdherence ?? 0) >= 80 ? colors.success : colors.warning,
                    },
                  ]}
                >
                  {(nutritionAdherence ?? 0) >= 80 ? 'On Track' : 'Needs Work'}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* PR Board */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Personal Records
        </Text>
        {displayRecentPRs.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No PRs Yet"
            description="Complete workouts to start tracking your personal records."
          />
        ) : (
          displayRecentPRs.slice(0, 5).map((pr) => {
            const exNames: Record<string, string> = {
              'bench-press': 'Bench Press',
              squat: 'Barbell Squat',
              deadlift: 'Deadlift',
              'overhead-press': 'Overhead Press',
            };
            return (
              <Card key={`${pr.exerciseId}-${pr.type}`} style={{ marginBottom: spacing.sm }}>
                <View style={styles.prRow}>
                  <View
                    style={[styles.prIcon, { backgroundColor: colors.warningLight, borderRadius: radius.md }]}
                  >
                    <Ionicons name="trophy" size={16} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.label, { color: colors.text }]}>
                      {exNames[pr.exerciseId] ?? pr.exerciseId}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {pr.value} kg — {pr.type} PR
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
            );
          })
        )}
      </View>

      {/* Body Measurements */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Body Measurements
        </Text>
        <EmptyState
          icon="body-outline"
          title="No Measurements"
          description="Track your body measurements to see your progress over time."
          actionLabel="Add Measurement"
          onAction={() => {}}
        />
      </View>

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
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adherenceBadge: {},
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
