import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, MacroBar, ProgressBar, LoadingSpinner, EmptyState } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import { useHealthStore } from '../../src/stores/health-store';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { usePersonalRecords } from '../../src/hooks/usePersonalRecords';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { getHealthProviderName } from '../../src/lib/health';
import { CoachFAB } from '../../src/components/CoachFAB';
import { isDemoMode, DEMO_STREAK, DEMO_HEALTH_DATA, getDemoTodayNutrition, DEMO_NUTRITION_TARGETS } from '../../src/lib/demo-mode';

export default function TodayTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isHealthConnected = useHealthStore((s) => s.isConnected);
  const todaySteps = useHealthStore((s) => s.todaySteps);
  const todayActiveEnergy = useHealthStore((s) => s.todayActiveEnergy);
  const lastSleepHours = useHealthStore((s) => s.lastSleepHours);
  const syncEnabled = useHealthStore((s) => s.syncEnabled);

  const { recentWorkouts, totalWorkouts, weeklyVolume } = useWorkoutHistory();
  const { recentPRs } = usePersonalRecords();
  const { targets, consumed, progress } = useNutritionDashboard();
  const { activeProgram, getTodayWorkout } = useWorkoutPrograms();

  const demo = isDemoMode();
  const demoNutrition = useMemo(() => (demo ? getDemoTodayNutrition() : null), [demo]);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const providerLabel = getHealthProviderName();
  const showHealthData = (isHealthConnected && Platform.OS !== 'web') || demo;

  const displaySteps = demo ? DEMO_HEALTH_DATA.todaySteps : todaySteps;
  const displayActiveEnergy = demo ? DEMO_HEALTH_DATA.todayActiveEnergy : todayActiveEnergy;
  const displaySleepHours = demo ? DEMO_HEALTH_DATA.lastSleepHours : lastSleepHours;

  const displayConsumed = demo && demoNutrition ? demoNutrition.consumed : consumed;
  const displayTargets = demo ? DEMO_NUTRITION_TARGETS : targets;
  const calProgress =
    displayTargets.calories > 0 ? displayConsumed.calories / displayTargets.calories : 0;

  // Streak calculation
  const streak = useMemo(() => {
    if (demo) return DEMO_STREAK.currentStreak;
    if (totalWorkouts === 0) return 0;
    // Simple streak: count consecutive days with workouts going back from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const hasWorkout = weeklyVolume.some((v) => v.date === dateKey && v.volume > 0);
      const hasRecent = recentWorkouts.some(
        (w) => new Date(w.completedAt).toISOString().split('T')[0] === dateKey,
      );
      if (hasWorkout || hasRecent) {
        count++;
      } else if (i > 0) {
        break;
      }
    }
    return count;
  }, [demo, totalWorkouts, weeklyVolume, recentWorkouts]);

  const todayWorkout = activeProgram ? getTodayWorkout() : null;
  const displayPRs = demo
    ? [
        { exerciseId: 'bench-press', type: 'weight' as const, value: 82.5, date: new Date().toISOString() },
        { exerciseId: 'squat', type: 'weight' as const, value: 120, date: new Date().toISOString() },
        { exerciseId: 'deadlift', type: 'weight' as const, value: 140, date: new Date().toISOString() },
      ]
    : recentPRs.slice(0, 3);

  const exerciseNames: Record<string, string> = {
    'bench-press': 'Bench Press',
    squat: 'Barbell Squat',
    deadlift: 'Deadlift',
    'overhead-press': 'Overhead Press',
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner fullScreen message="Loading your dashboard..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: colors.text }]}>
            {greeting}, {profile?.display_name ?? 'there'}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {dateStr}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <View
            style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderRadius: radius.full }]}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Streak Counter */}
      {streak > 0 && (
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.streakRow}>
            <View style={[styles.streakIcon, { backgroundColor: colors.warningLight, borderRadius: radius.md }]}>
              <Ionicons name="flame" size={24} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.h2, { color: colors.text }]}>{streak} Day Streak</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Keep it going! Consistency is key.
              </Text>
            </View>
            <Text style={[typography.displayMedium, { color: colors.warning }]}>🔥</Text>
          </View>
        </Card>
      )}

      {/* Health Activity Summary */}
      {showHealthData && (demo || syncEnabled.steps || syncEnabled.activeEnergy || syncEnabled.sleep) && (
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.cardHeader}>
            <Ionicons name="heart-outline" size={20} color={colors.primary} />
            <Text
              style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}
            >
              Today&apos;s Activity
            </Text>
            {providerLabel && !demo && (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                via {providerLabel}
              </Text>
            )}
          </View>
          <View style={[styles.healthGrid, { marginTop: spacing.md, gap: spacing.md }]}>
            {(demo || syncEnabled.steps) && (
              <View
                style={[
                  styles.healthStat,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
                ]}
              >
                <Ionicons name="footsteps-outline" size={18} color={colors.primary} />
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {displaySteps.toLocaleString()}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Steps</Text>
              </View>
            )}
            {(demo || syncEnabled.activeEnergy) && (
              <View
                style={[
                  styles.healthStat,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
                ]}
              >
                <Ionicons name="flame-outline" size={18} color={colors.warning} />
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {displayActiveEnergy.toLocaleString()}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Active Cal</Text>
              </View>
            )}
            {(demo || syncEnabled.sleep) && displaySleepHours !== null && (
              <View
                style={[
                  styles.healthStat,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
                ]}
              >
                <Ionicons name="moon-outline" size={18} color={colors.info} />
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {displaySleepHours}h
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Sleep</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Today's Workout */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.cardHeader}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
            Today&apos;s Workout
          </Text>
        </View>
        {todayWorkout ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={[typography.label, { color: colors.text }]}>{todayWorkout.name}</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {todayWorkout.exercises.length} exercises
            </Text>
            <TouchableOpacity
              style={[styles.cardAction, { marginTop: spacing.md }]}
              onPress={() => router.push('/(tabs)/workout')}
              activeOpacity={0.7}
            >
              <Text style={[typography.label, { color: colors.primary }]}>Start Workout</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {demo ? 'Rest day — recovery is important!' : 'No workout scheduled for today.'}
            </Text>
            <TouchableOpacity
              style={[styles.cardAction, { marginTop: spacing.md }]}
              onPress={() => router.push('/(tabs)/workout')}
              activeOpacity={0.7}
            >
              <Text style={[typography.label, { color: colors.primary }]}>Start a workout</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Nutrition Progress Card */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.cardHeader}>
          <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
            Nutrition
          </Text>
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <View style={styles.calorieRow}>
            <Text style={[typography.displayMedium, { color: colors.text }]}>
              {Math.round(displayConsumed.calories).toLocaleString()}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {' '}
              / {displayTargets.calories.toLocaleString()} cal
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(calProgress, 1)}
            color={calProgress > 1 ? colors.warning : colors.calories}
            height={8}
          />
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <MacroBar
              label="Protein"
              current={Math.round(displayConsumed.protein_g)}
              target={displayTargets.protein_g}
              color={colors.protein}
            />
            <MacroBar
              label="Carbs"
              current={Math.round(displayConsumed.carbs_g)}
              target={displayTargets.carbs_g}
              color={colors.carbs}
            />
            <MacroBar
              label="Fat"
              current={Math.round(displayConsumed.fat_g)}
              target={displayTargets.fat_g}
              color={colors.fat}
            />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.cardAction, { marginTop: spacing.md }]}
          onPress={() => router.push('/(tabs)/nutrition')}
          activeOpacity={0.7}
        >
          <Text style={[typography.label, { color: colors.primary }]}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </Card>

      {/* Coach Tip / Weekly Insight */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/coach')} activeOpacity={0.7}>
        <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.primary} />
            <Text
              style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}
            >
              Coach Tip
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
          <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
            {demo
              ? "Great consistency this week, Alex! You've hit 5 workouts and your protein intake is improving. Consider adding a deload week soon."
              : 'Stay consistent with your workouts and nutrition tracking. Small daily habits lead to big results over time.'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.primary, marginTop: spacing.sm }]}>
            Ask Coach for personalized advice
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={[styles.quickActions, { marginBottom: spacing.base, gap: spacing.sm }]}>
        {[
          {
            icon: 'barbell-outline' as const,
            label: 'Log Workout',
            route: '/(tabs)/workout' as const,
          },
          {
            icon: 'restaurant-outline' as const,
            label: 'Log Meal',
            route: '/(tabs)/nutrition' as const,
          },
          {
            icon: 'chatbubble-outline' as const,
            label: 'Ask Coach',
            route: '/(tabs)/coach' as const,
          },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={() => router.push(action.route)}
            activeOpacity={0.7}
            style={[
              styles.quickActionBtn,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderColor: colors.borderLight,
                padding: spacing.md,
              },
            ]}
          >
            <Ionicons name={action.icon} size={24} color={colors.primary} />
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: spacing.xs }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent PRs */}
      {displayPRs.length > 0 && (
        <View style={{ marginBottom: spacing.base }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Recent PRs 🏆
          </Text>
          {displayPRs.map((pr) => (
            <Card key={`${pr.exerciseId}-${pr.type}`} style={{ marginBottom: spacing.sm }}>
              <View style={styles.prRow}>
                <View
                  style={[
                    styles.prIcon,
                    { backgroundColor: colors.warningLight, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="trophy" size={16} color={colors.warning} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.text }]}>
                    {exerciseNames[pr.exerciseId] ?? pr.exerciseId}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {pr.value} kg — New {pr.type} PR
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Recent Activity */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Recent Activity
        </Text>
        {recentWorkouts.length === 0 && !demo ? (
          <View
            style={[
              styles.emptyRecent,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.lg,
                padding: spacing['2xl'],
              },
            ]}
          >
            <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
            <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              No recent activity yet
            </Text>
          </View>
        ) : (
          (demo
            ? [
                { id: '1', name: 'Push Day — Chest & Shoulders', totalVolume: 12400, durationSeconds: 4200, completedAt: new Date().toISOString() },
                { id: '2', name: 'Pull Day — Back & Biceps', totalVolume: 10800, durationSeconds: 3900, completedAt: new Date(Date.now() - 86400000).toISOString() },
              ]
            : recentWorkouts.slice(0, 2)
          ).map((session) => (
            <Card key={session.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.activityRow}>
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: colors.primaryMuted, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="barbell" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.text }]}>{session.name}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {Math.round(session.totalVolume).toLocaleString()} kg •{' '}
                    {Math.round(session.durationSeconds / 60)} min
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
      <CoachFAB context="general" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  healthStat: {
    flex: 1,
    alignItems: 'center',
    minWidth: 90,
  },
  quickActions: {
    flexDirection: 'row',
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 72,
    justifyContent: 'center',
  },
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
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
