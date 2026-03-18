import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { Button, Card, ScreenContainer, Badge, LoadingSpinner, ErrorState, ProgressBar } from '../../src/components/ui';
import { formatSessionDate, formatDuration, formatVolume } from '../../src/lib/workout-utils';
import { DayType, DAY_TYPE_LABELS, DAY_TYPE_COLORS, DAY_TYPE_ICONS } from '../../src/types/workout';
import { CoachFAB } from '../../src/components/CoachFAB';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { UpgradeBanner } from '../../src/components/UpgradeBanner';
import { checkWorkoutLogLimit, incrementUsage, type UsageCheck } from '../../src/lib/usage-limits';
import { WorkoutMilestones } from '../../src/components/WorkoutMilestones';

export default function WorkoutTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const initialize = useWorkoutStore((s) => s.initialize);
  const isInitialized = useWorkoutStore((s) => s.isInitialized);
  const { isActive, startEmptyWorkout, activeSession, cancelWorkout } = useActiveWorkout();
  const { activeProgram, programs, getTodayWorkout, setActiveProgram } = useWorkoutPrograms();
  const { recentWorkouts, weeklyVolume, totalWorkouts } = useWorkoutHistory();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const getProgramProgress = useWorkoutStore((s) => s.getProgramProgress);
  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [workoutUsage, setWorkoutUsage] = useState<UsageCheck | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Check free tier workout limits
  useEffect(() => {
    if (tier === 'free') {
      checkWorkoutLogLimit().then(setWorkoutUsage);
    }
  }, [tier]);

  const handleWorkoutLimitCheck = useCallback(
    (proceed: () => void) => {
      if (canAccess('unlimited_workouts')) {
        proceed();
        return;
      }
      // Free tier — check usage
      checkWorkoutLogLimit().then((usage) => {
        setWorkoutUsage(usage);
        if (usage.allowed) {
          incrementUsage('workout_logs');
          proceed();
        } else {
          Alert.alert(
            'Workout Limit Reached',
            `You've used all ${usage.limit} free workouts this month. Upgrade to Workout Coach for unlimited workouts.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_workouts', source: 'workout_tab' }) },
            ],
          );
        }
      });
    },
    [canAccess, showPaywall],
  );

  const todayWorkout = activeProgram ? getTodayWorkout() : null;

  // Program progress
  const programProgress = useMemo(() => {
    if (!activeProgram) return null;
    return getProgramProgress(activeProgram.id);
  }, [activeProgram, getProgramProgress]);

  // Weekly day tracking: how many days done this week
  const weeklyDayProgress = useMemo(() => {
    if (!activeProgram) return { completedThisWeek: 0, totalDays: 0 };
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const history = useWorkoutStore.getState().history;
    const completedThisWeek = history.filter((s) => {
      if (s.programId !== activeProgram.id) return false;
      return new Date(s.completedAt) >= startOfWeek;
    }).length;

    return { completedThisWeek, totalDays: activeProgram.daysPerWeek };
  }, [activeProgram]);

  const inactivePrograms = useMemo(
    () => programs.filter((p) => !p.isActive),
    [programs],
  );

  const handleQuickStart = () => {
    if (isActive) {
      router.push('/workout/active');
      return;
    }
    handleWorkoutLimitCheck(() => {
      startEmptyWorkout();
      router.push('/workout/active');
    });
  };

  const handleStartToday = () => {
    if (isActive) {
      router.push('/workout/active');
      return;
    }
    if (!todayWorkout || !activeProgram) return;

    handleWorkoutLimitCheck(() => {
      if (!todayWorkout || !activeProgram) return;
      startWorkout({
      name: `${activeProgram.name} — ${todayWorkout.name}`,
      programId: activeProgram.id,
      dayId: todayWorkout.id,
      exercises: todayWorkout.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        supersetGroupId: e.supersetGroupId,
      })),
      });
      router.push('/workout/active');
    });
  };

  // Simple weekly volume chart bars
  const maxVolume = Math.max(...weeklyVolume.map((d) => d.volume), 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (!isInitialized) {
    return (
      <ScreenContainer>
        <LoadingSpinner fullScreen message="Loading workouts..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Upgrade Banner for free users */}
      {tier === 'free' && (
        <UpgradeBanner
          plan="workout_coach"
          feature="unlimited_workouts"
          source="workout_tab"
          message="Unlock unlimited workouts with Workout Coach"
        />
      )}

      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Workout</Text>
        {isActive && (
          <TouchableOpacity onPress={() => router.push('/workout/active')}>
            <Badge label="In Progress" variant="success" />
          </TouchableOpacity>
        )}
      </View>

      {/* Today's Workout — active session */}
      {isActive && activeSession && (
        <Card style={{ marginBottom: spacing.base, borderColor: colors.success, borderWidth: 2 }}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              Today&apos;s Workout
            </Text>
            <Badge label="IN PROGRESS" variant="success" />
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {activeSession.name}
          </Text>
          {/* Progress stats */}
          <View style={[styles.progressDetails, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {activeSession.exercises.reduce((acc, e) => acc + e.sets.filter(s => s.isCompleted).length, 0)}/
              {activeSession.exercises.reduce((acc, e) => acc + e.sets.length, 0)} sets
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000)} min elapsed
            </Text>
          </View>
          {/* Exercise list preview */}
          <View style={[styles.exercisePreview, { marginTop: spacing.sm }]}>
            {activeSession.exercises.slice(0, 3).map((e) => {
              const completedSets = e.sets.filter(s => s.isCompleted).length;
              const totalSets = e.sets.length;
              return (
                <View key={e.exerciseId} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons
                    name={completedSets === totalSets ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={completedSets === totalSets ? colors.success : colors.textTertiary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={[typography.bodySmall, { color: completedSets === totalSets ? colors.success : colors.textTertiary }]}>
                    {e.exerciseName} ({completedSets}/{totalSets})
                  </Text>
                </View>
              );
            })}
            {activeSession.exercises.length > 3 && (
              <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
                + {activeSession.exercises.length - 3} more
              </Text>
            )}
          </View>
          <Button
            title="Resume Workout"
            size="md"
            onPress={() => router.push('/workout/active')}
            style={{ marginTop: spacing.md, backgroundColor: colors.success }}
          />
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Discard Workout',
                'Are you sure you want to discard this workout? All progress will be lost.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => cancelWorkout() },
                ],
              );
            }}
            style={{ alignSelf: 'center', marginTop: spacing.sm }}
          >
            <Text style={[typography.bodySmall, { color: colors.error }]}>Discard Workout</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Today's Workout — no active session */}
      {!isActive && todayWorkout && activeProgram && (
        <Card style={{ marginBottom: spacing.base }}>
          {todayWorkout.dayType === 'lifting' ? (
            <>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                  Today&apos;s Workout
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                {todayWorkout.name} — {todayWorkout.exercises.length} exercises
              </Text>
              <View style={[styles.exercisePreview, { marginTop: spacing.sm }]}>
                {todayWorkout.exercises.slice(0, 3).map((e) => (
                  <Text key={e.id} style={[typography.bodySmall, { color: colors.textTertiary }]}>
                    • {e.exerciseName} ({e.targetSets}×{e.targetReps})
                  </Text>
                ))}
                {todayWorkout.exercises.length > 3 && (
                  <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                    + {todayWorkout.exercises.length - 3} more
                  </Text>
                )}
              </View>
              <Button
                title="Start Today's Workout"
                size="md"
                onPress={handleStartToday}
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : todayWorkout.dayType === 'cardio' ? (
            <>
              <View style={styles.cardHeader}>
                <Ionicons name={DAY_TYPE_ICONS.cardio as any} size={20} color={DAY_TYPE_COLORS.cardio} />
                <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                  {DAY_TYPE_LABELS.cardio}
                </Text>
                <Badge label={DAY_TYPE_LABELS.cardio} variant="default" />
              </View>
              {todayWorkout.cardioSuggestions && todayWorkout.cardioSuggestions.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  {todayWorkout.cardioSuggestions.slice(0, 2).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i > 0 ? spacing.xs : 0 }}>
                      <Ionicons name={(s.icon || 'heart-outline') as any} size={16} color={DAY_TYPE_COLORS.cardio} />
                      <Text style={[typography.body, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                        {s.name} — {s.duration}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {todayWorkout.recoveryNotes && (
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                  {todayWorkout.recoveryNotes}
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <Ionicons name={DAY_TYPE_ICONS[todayWorkout.dayType] as any} size={20} color={DAY_TYPE_COLORS[todayWorkout.dayType]} />
                <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                  {DAY_TYPE_LABELS[todayWorkout.dayType]}
                </Text>
                <Badge label={DAY_TYPE_LABELS[todayWorkout.dayType]} variant="default" />
              </View>
              {todayWorkout.recoveryNotes && (
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  {todayWorkout.recoveryNotes}
                </Text>
              )}
            </>
          )}
        </Card>
      )}

      {/* Active Program Progress */}
      {!isActive && activeProgram && programProgress && (
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart-outline" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              {activeProgram.name}
            </Text>
            <Badge label={`${programProgress.percentComplete}%`} variant="default" />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <ProgressBar progress={programProgress.percentComplete / 100} height={8} />
          </View>
          <View style={[styles.progressDetails, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Day {weeklyDayProgress.completedThisWeek} of {weeklyDayProgress.totalDays} this week
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {programProgress.completedDays}/{programProgress.totalDays} sessions done
            </Text>
          </View>
        </Card>
      )}

      {/* Quick Start */}
      {!isActive && (
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
              Quick Start
            </Text>
            {tier === 'free' && workoutUsage && (
              <Badge
                label={`${workoutUsage.remaining}/${workoutUsage.limit} left`}
                variant={workoutUsage.remaining <= 2 ? 'warning' : 'default'}
              />
            )}
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Start an empty workout or let AI build one for you.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Empty Workout"
                variant="secondary"
                size="md"
                onPress={handleQuickStart}
                icon={<Ionicons name="add-outline" size={18} color={colors.primary} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="AI Workout"
                variant="secondary"
                size="md"
                onPress={() => router.push('/workout/ai-generate')}
                icon={<Ionicons name="sparkles" size={18} color="#8B5CF6" />}
              />
            </View>
          </View>
        </Card>
      )}

      {/* Navigation Cards */}
      <View style={[styles.navGrid, { marginBottom: spacing.base }]}>
        <TouchableOpacity
          style={[styles.navCard, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
          activeOpacity={0.7}
          onPress={() => router.push('/workout/programs')}
        >
          <Ionicons name="clipboard-outline" size={28} color={colors.primary} />
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.sm }]}>Programs</Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {activeProgram ? activeProgram.name : 'Browse plans'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navCard, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
          activeOpacity={0.7}
          onPress={() => router.push('/workout/exercises')}
        >
          <Ionicons name="search-outline" size={28} color={colors.primary} />
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.sm }]}>Exercises</Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>Browse library</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Volume Chart */}
      {weeklyVolume.length > 0 && (
        <Card style={{ marginBottom: spacing.base }}>
          <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
            This Week
          </Text>
          <View style={styles.chartContainer}>
            {weeklyVolume.slice(-7).map((day, i) => {
              const height = maxVolume > 0 ? (day.volume / maxVolume) * 80 : 0;
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
        </Card>
      )}

      {/* Milestones */}
      <WorkoutMilestones />

      {/* Choose a Program */}
      {inactivePrograms.length > 0 && (
        <View style={{ marginBottom: spacing.base }}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.h3, { color: colors.text }]}>Choose a Program</Text>
            <TouchableOpacity onPress={() => router.push('/workout/programs')}>
              <Text style={[typography.label, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {inactivePrograms.slice(0, 3).map((program) => (
            <TouchableOpacity
              key={program.id}
              activeOpacity={0.7}
              onPress={() => {
                setActiveProgram(program.id);
              }}
            >
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>{program.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {program.daysPerWeek} days/week · {program.difficulty}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent History */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>Recent Workouts</Text>
          {totalWorkouts > 0 && (
            <TouchableOpacity onPress={() => router.push('/workout/history')}>
              <Text style={[typography.label, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentWorkouts.length === 0 ? (
          <Card>
            <View style={styles.emptyRecent}>
              <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                No workouts yet. Start your first one!
              </Text>
            </View>
          </Card>
        ) : (
          recentWorkouts.map((session) => (
            <TouchableOpacity
              key={session.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/workout/session/${session.id}`)}
            >
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>{session.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {formatSessionDate(session.completedAt)} · {formatDuration(session.durationSeconds)} · {session.totalSets} sets
                    </Text>
                  </View>
                  {session.prCount > 0 && (
                    <View style={styles.prBadge}>
                      <Ionicons name="trophy" size={14} color={colors.warning} />
                      <Text style={[typography.caption, { color: colors.warning, marginLeft: 2 }]}>
                        {session.prCount}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: spacing.sm }} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
      <CoachFAB context="workout" label="Ask Coach" prefilledMessage="Help me with my workout" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exercisePreview: {},
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  navCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
  },
  chartBar: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  bar: {
    width: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyRecent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
