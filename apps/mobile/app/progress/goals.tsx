// ── Goals Dashboard ─────────────────────────────────────────────────
// Shows the user's configured goals alongside concrete progress metrics
// pulled from the workout, nutrition, and measurements stores.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { Card, Badge, Button, EmptyState, ProgressBar } from '../../src/components/ui';
import { useProfileStore } from '../../src/stores/profile-store';
import { useMeasurementsStore } from '../../src/stores/measurements-store';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import type { HealthGoal } from '../../src/stores/profile-store';

const KG_TO_LB = 2.20462;

const HEALTH_GOAL_LABELS: Record<HealthGoal, string> = {
  lose_weight: 'Lose Weight',
  gain_muscle: 'Gain Muscle',
  build_lean_muscle: 'Build Lean Muscle',
  improve_endurance: 'Improve Endurance',
  maintain_weight: 'Maintain Weight',
  improve_general_health: 'Improve General Health',
};

const HEALTH_GOAL_ICONS: Record<HealthGoal, keyof typeof Ionicons.glyphMap> = {
  lose_weight: 'trending-down-outline',
  gain_muscle: 'barbell-outline',
  build_lean_muscle: 'body-outline',
  improve_endurance: 'pulse-outline',
  maintain_weight: 'scale-outline',
  improve_general_health: 'heart-outline',
};

// ── Helpers ─────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // treat Monday as start
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatWeight(kg: number, imperial: boolean): string {
  return imperial ? `${(kg * KG_TO_LB).toFixed(1)} lbs` : `${kg.toFixed(1)} kg`;
}

// ── Main ────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();

  const profile = useProfileStore((s) => s.profile);
  const measurements = useMeasurementsStore((s) => s.measurements);
  const history = useWorkoutStore((s) => s.history);
  const nutritionTargets = useNutritionStore((s) => s.targets);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const imperial = profile.unitPreference === 'imperial';

  // ── Weight progress ────────────────────────────────────────────────

  const weightProgress = useMemo(() => {
    const target = profile.targetWeightKg;
    if (target == null) return null;

    const latestMeasurementWeight = measurements[0]?.weightKg;
    const current = latestMeasurementWeight ?? profile.weightKg;
    if (current == null) return null;

    // Starting weight: earliest measurement, or profile weight if no history.
    const startKg =
      measurements.length > 1 ? measurements[measurements.length - 1].weightKg : current;
    const start = startKg ?? current;

    const direction = target < start ? 'lose' : target > start ? 'gain' : 'maintain';
    const totalDelta = Math.abs(target - start);
    const travelled = Math.abs(current - start);
    const pct = totalDelta > 0 ? Math.min(100, Math.max(0, (travelled / totalDelta) * 100)) : 100;

    const remaining = Math.abs(target - current);

    return {
      start,
      current,
      target,
      direction,
      pct,
      remaining,
    };
  }, [profile.targetWeightKg, profile.weightKg, measurements]);

  // ── Training days this week vs target ──────────────────────────────

  const trainingProgress = useMemo(() => {
    const targetDays = profile.trainingDaysPerWeek;
    if (!targetDays) return null;

    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const completed = history.filter((s) => {
      const d = new Date(s.completedAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    return {
      completed,
      target: targetDays,
      pct: Math.min(100, (completed / targetDays) * 100),
    };
  }, [profile.trainingDaysPerWeek, history]);

  // ── Nutrition adherence (last 7 days) ──────────────────────────────

  const nutritionProgress = useMemo(() => {
    if (!nutritionTargets.calories) return null;

    const now = new Date();
    let daysOnTarget = 0;
    let daysLogged = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const log = dailyLogs[key];
      if (!log || log.meals.length === 0) continue;
      daysLogged++;
      const consumed = log.meals.reduce(
        (sum, m) => sum + m.items.reduce((s, item) => s + item.calories, 0),
        0,
      );
      const ratio = consumed / nutritionTargets.calories;
      if (ratio >= 0.85 && ratio <= 1.15) daysOnTarget++;
    }

    return {
      daysOnTarget,
      daysLogged,
      pct: daysLogged > 0 ? (daysOnTarget / daysLogged) * 100 : 0,
    };
  }, [nutritionTargets.calories, dailyLogs]);

  // ── Render ─────────────────────────────────────────────────────────

  const hasAnyGoals =
    !!profile.primaryGoal ||
    profile.healthGoals.length > 0 ||
    profile.targetWeightKg != null ||
    !!profile.trainingDaysPerWeek;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
          Goals
        </Text>
        <TouchableOpacity onPress={() => router.push('/profile')} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {!hasAnyGoals ? (
        <View style={{ flex: 1, padding: spacing.base, justifyContent: 'center' }}>
          <EmptyState
            icon="flag-outline"
            title="No Goals Set"
            description="Set your fitness goals in your profile to track progress here."
            actionLabel="Set Goals"
            onAction={() => router.push('/profile')}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: spacing['3xl'] }}>
          {/* Primary Goal */}
          {profile.primaryGoal ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Primary Goal
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.primaryRow}>
                  <View
                    style={[
                      styles.primaryIcon,
                      { backgroundColor: colors.primaryMuted, borderRadius: radius.md },
                    ]}
                  >
                    <Ionicons name="flag" size={22} color={colors.primary} />
                  </View>
                  <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                    {profile.primaryGoal}
                  </Text>
                </View>
                {profile.healthGoalDescription ? (
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                    {profile.healthGoalDescription}
                  </Text>
                ) : null}
              </Card>
            </View>
          ) : null}

          {/* Health Goals (multi-select) */}
          {profile.healthGoals.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Focus Areas
              </Text>
              <View style={[styles.badgeRow, { marginTop: spacing.sm }]}>
                {profile.healthGoals.map((g) => (
                  <View key={g} style={[styles.badgeItem, { marginRight: spacing.xs, marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center' }]}>
                    <Ionicons
                      name={HEALTH_GOAL_ICONS[g]}
                      size={14}
                      color={colors.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Badge label={HEALTH_GOAL_LABELS[g] ?? g} variant="pro" />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Weight Goal */}
          {weightProgress ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Weight Goal
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.weightRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>Current</Text>
                    <Text style={[typography.h2, { color: colors.text }]}>
                      {formatWeight(weightProgress.current, imperial)}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      weightProgress.direction === 'lose'
                        ? 'arrow-down'
                        : weightProgress.direction === 'gain'
                          ? 'arrow-up'
                          : 'remove'
                    }
                    size={18}
                    color={colors.textTertiary}
                  />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>Target</Text>
                    <Text style={[typography.h2, { color: colors.primary }]}>
                      {formatWeight(weightProgress.target, imperial)}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <ProgressBar progress={weightProgress.pct / 100} color={colors.primary} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
                  {weightProgress.direction === 'maintain'
                    ? 'Maintaining target weight'
                    : `${formatWeight(weightProgress.remaining, imperial)} to go · ${Math.round(weightProgress.pct)}% there`}
                </Text>
              </Card>
            </View>
          ) : profile.healthGoals.includes('lose_weight') || profile.healthGoals.includes('gain_muscle') || profile.healthGoals.includes('maintain_weight') ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Weight Goal
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Add a target weight in your profile to track progress here.
                </Text>
                <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}>
                  <Button
                    title="Set Target Weight"
                    onPress={() => router.push('/profile')}
                    variant="secondary"
                    size="sm"
                  />
                </View>
              </Card>
            </View>
          ) : null}

          {/* Training Days This Week */}
          {trainingProgress ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Training This Week
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.weightRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>Completed</Text>
                    <Text style={[typography.h2, { color: colors.text }]}>
                      {trainingProgress.completed} / {trainingProgress.target}
                    </Text>
                  </View>
                  <Ionicons
                    name={trainingProgress.completed >= trainingProgress.target ? 'checkmark-circle' : 'ellipse-outline'}
                    size={28}
                    color={trainingProgress.completed >= trainingProgress.target ? colors.success : colors.textTertiary}
                  />
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <ProgressBar
                    progress={trainingProgress.pct / 100}
                    color={trainingProgress.completed >= trainingProgress.target ? colors.success : colors.primary}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
                  {trainingProgress.completed >= trainingProgress.target
                    ? 'You hit your training target this week — nice work.'
                    : `${trainingProgress.target - trainingProgress.completed} more workout${trainingProgress.target - trainingProgress.completed > 1 ? 's' : ''} to hit your weekly target.`}
                </Text>
              </Card>
            </View>
          ) : null}

          {/* Nutrition Adherence */}
          {nutritionProgress && nutritionProgress.daysLogged > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Nutrition Adherence (Last 7 Days)
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.weightRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>On target</Text>
                    <Text style={[typography.h2, { color: colors.text }]}>
                      {nutritionProgress.daysOnTarget} / {nutritionProgress.daysLogged} days
                    </Text>
                  </View>
                  <Ionicons
                    name="restaurant-outline"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <ProgressBar
                    progress={nutritionProgress.pct / 100}
                    color={
                      nutritionProgress.pct >= 70
                        ? colors.success
                        : nutritionProgress.pct >= 40
                          ? colors.warning
                          : colors.error
                    }
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
                  {`Within ±15% of your ${nutritionTargets.calories} cal target on ${Math.round(nutritionProgress.pct)}% of logged days.`}
                </Text>
              </Card>
            </View>
          ) : null}

          {/* Experience + Schedule context */}
          {(profile.trainingExperience || profile.preferredWorkoutDays.length > 0) ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.labelSmall, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Plan
              </Text>
              <Card style={{ marginTop: spacing.sm }}>
                {profile.trainingExperience ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="school-outline" size={18} color={colors.textSecondary} />
                    <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                      Experience:
                    </Text>
                    <Text style={[typography.body, { color: colors.textSecondary, textTransform: 'capitalize' }]}>
                      {profile.trainingExperience}
                    </Text>
                  </View>
                ) : null}
                {profile.preferredWorkoutDays.length > 0 ? (
                  <View style={[styles.infoRow, { marginTop: spacing.sm }]}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                      Preferred days:
                    </Text>
                    <Text style={[typography.body, { color: colors.textSecondary }]}>
                      {profile.preferredWorkoutDays
                        .map((d) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase()))
                        .join(', ')}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeItem: {},
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
