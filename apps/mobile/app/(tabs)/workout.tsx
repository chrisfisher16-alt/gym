import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Pressable } from 'react-native';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { useWorkoutStore } from '../../src/stores/workout-store';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Button,
  Card,
  ScreenContainer,
  Badge,
  ErrorState,
  ProgressBar,
  ExpandableCard,
  AnimatedNumber,
  QuickActionSheet,
  SmartHeader,
  WorkoutFingerprint,
} from '../../src/components/ui';
import type { QuickAction } from '../../src/components/ui/QuickActionSheet';
import { useQuickActions } from '../../src/hooks/useQuickActions';
import { WorkoutTabSkeleton } from '../../src/components/ui/SkeletonLayouts';
import { formatSessionDate, formatDuration, formatVolume } from '../../src/lib/workout-utils';
import { DayType, DAY_TYPE_LABELS, DAY_TYPE_COLORS, DAY_TYPE_ICONS } from '../../src/types/workout';
import type { CompletedSession } from '../../src/types/workout';
import { CoachFAB } from '../../src/components/CoachFAB';
import { StartWorkoutSheet } from '../../src/components/workout/StartWorkoutSheet';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { UpgradeBanner } from '../../src/components/UpgradeBanner';
import { checkWorkoutLogLimit, incrementUsage, type UsageCheck } from '../../src/lib/usage-limits';
import { WorkoutMilestones } from '../../src/components/WorkoutMilestones';
import { WeeklyCalendarRow } from '../../src/components/workout/WeeklyCalendarRow';
import { mediumImpact } from '../../src/lib/haptics';

export default function WorkoutTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const initialize = useWorkoutStore((s) => s.initialize);
  const isInitialized = useWorkoutStore((s) => s.isInitialized);
  const { isActive, startEmptyWorkout, activeSession, cancelWorkout } = useActiveWorkout();
  const { activeProgram, programs, getTodayWorkout, weeklyProgress, setActiveProgram } = useWorkoutPrograms();
  const { recentWorkouts, weeklyVolume, totalWorkouts, totalVolume } = useWorkoutHistory();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const getProgramProgress = useWorkoutStore((s) => s.getProgramProgress);
  const deleteSession = useWorkoutStore((s) => s.deleteSession);
  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [workoutUsage, setWorkoutUsage] = useState<UsageCheck | null>(null);
  const [showStartSheet, setShowStartSheet] = useState(false);
  const [exercisesExpanded, setExercisesExpanded] = useState(false);

  // Quick actions
  const { show: showQuickActions, sheetProps } = useQuickActions();

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
          proceed();
        } else {
          crossPlatformAlert(
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
      mediumImpact();
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
      mediumImpact();
      router.push('/workout/active');
    });
  };

  // ── Quick Action Handlers ──────────────────────────────────────

  const handleRepeatWorkout = useCallback(
    (session: CompletedSession) => {
      handleWorkoutLimitCheck(() => {
        startWorkout({
          name: session.name,
          programId: session.programId,
          dayId: session.dayId,
          exercises: session.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            targetSets: e.sets.length,
            targetReps: e.sets[0]?.reps?.toString() ?? '8-12',
            restSeconds: e.restSeconds ?? 90,
          })),
        });
        mediumImpact();
        router.push('/workout/active');
      });
    },
    [handleWorkoutLimitCheck, startWorkout, router],
  );

  const handleDeleteSession = useCallback(
    (session: CompletedSession) => {
      crossPlatformAlert(
        'Delete Workout',
        `Are you sure you want to delete "${session.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteSession(session.id),
          },
        ],
      );
    },
    [deleteSession],
  );

  const showRecentWorkoutActions = useCallback(
    (session: CompletedSession) => {
      const actions: QuickAction[] = [
        {
          id: 'repeat',
          label: 'Repeat This Workout',
          icon: 'repeat-outline',
          onPress: () => handleRepeatWorkout(session),
        },
        {
          id: 'view',
          label: 'View Details',
          icon: 'expand-outline',
          onPress: () => router.push(`/workout/session/${session.id}`),
        },
        {
          id: 'share',
          label: 'Share',
          icon: 'share-outline',
          onPress: () => {},
          disabled: true,
          badge: 'Soon',
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: 'trash-outline',
          onPress: () => handleDeleteSession(session),
          destructive: true,
        },
      ];

      showQuickActions({
        title: session.name,
        subtitle: formatSessionDate(session.completedAt),
        actions,
      });
    },
    [handleRepeatWorkout, handleDeleteSession, showQuickActions, router],
  );

  const showProgramActions = useCallback(() => {
    if (!activeProgram) return;

    const actions: QuickAction[] = [
      {
        id: 'start',
        label: "Start Today's Workout",
        icon: 'play-outline',
        onPress: handleStartToday,
      },
      {
        id: 'preview',
        label: 'Preview Exercises',
        icon: 'list-outline',
        onPress: () => {
          // The ExpandableCard toggle will be handled by tapping the card
        },
      },
      {
        id: 'switch',
        label: 'Switch Program',
        icon: 'swap-horizontal-outline',
        onPress: () => router.push('/workout/programs'),
      },
      {
        id: 'coach',
        label: 'Ask Coach to Modify',
        icon: 'chatbubble-ellipses-outline',
        onPress: () => router.push({
          pathname: '/(tabs)/coach',
          params: { prefill: `I'd like to modify my ${activeProgram.name} program` },
        }),
        badge: 'AI',
      },
    ];

    showQuickActions({
      title: activeProgram.name,
      subtitle: `${activeProgram.daysPerWeek} days/week · ${activeProgram.difficulty}`,
      actions,
    });
  }, [activeProgram, handleStartToday, showQuickActions, router]);

  // Simple weekly volume chart bars
  const maxVolume = Math.max(...weeklyVolume.map((d) => d.volume), 1);
  const dayLabels = weeklyVolume.map((d) => {
    const date = new Date(d.date);
    return ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][date.getDay()];
  });

  if (!isInitialized) {
    return (
      <ScreenContainer>
        <WorkoutTabSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
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
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: colors.text }]}>Workout</Text>
          <SmartHeader tab="workout" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {isActive && (
            <TouchableOpacity onPress={() => router.push('/workout/active')}>
              <Badge label="In Progress" variant="success" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
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
            {(exercisesExpanded ? activeSession.exercises : activeSession.exercises.slice(0, 3)).map((e) => {
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
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setExercisesExpanded(!exercisesExpanded);
                }}
                activeOpacity={0.7}
              >
                <Text style={[typography.bodySmall, { color: colors.primary, marginTop: 2 }]}>
                  {exercisesExpanded ? 'Show less' : `+ ${activeSession.exercises.length - 3} more`}
                </Text>
              </TouchableOpacity>
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
              crossPlatformAlert(
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

      {/* Weekly Calendar Row — below active session */}
      <WeeklyCalendarRow activeProgram={activeProgram} />

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
                {(exercisesExpanded ? todayWorkout.exercises : todayWorkout.exercises.slice(0, 3)).map((e) => (
                  <Text key={e.id} style={[typography.bodySmall, { color: colors.textTertiary }]}>
                    • {e.exerciseName} ({e.targetSets}×{e.targetReps})
                  </Text>
                ))}
                {todayWorkout.exercises.length > 3 && (
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExercisesExpanded(!exercisesExpanded);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[typography.bodySmall, { color: colors.primary, marginTop: 2 }]}>
                      {exercisesExpanded ? 'Show less' : `+ ${todayWorkout.exercises.length - 3} more`}
                    </Text>
                  </TouchableOpacity>
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
                <Ionicons name={DAY_TYPE_ICONS.cardio as keyof typeof Ionicons.glyphMap} size={20} color={DAY_TYPE_COLORS.cardio} />
                <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                  {DAY_TYPE_LABELS.cardio}
                </Text>
                <Badge label={DAY_TYPE_LABELS.cardio} variant="default" />
              </View>
              {todayWorkout.cardioSuggestions && todayWorkout.cardioSuggestions.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  {todayWorkout.cardioSuggestions.slice(0, 2).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i > 0 ? spacing.xs : 0 }}>
                      <Ionicons name={(s.icon || 'heart-outline') as keyof typeof Ionicons.glyphMap} size={16} color={DAY_TYPE_COLORS.cardio} />
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
                <Ionicons name={DAY_TYPE_ICONS[todayWorkout.dayType] as keyof typeof Ionicons.glyphMap} size={20} color={DAY_TYPE_COLORS[todayWorkout.dayType]} />
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

      {/* Active Program Progress — wrapped in ExpandableCard with long-press */}
      {!isActive && activeProgram && programProgress && (
        <Pressable onLongPress={showProgramActions} delayLongPress={400}>
          <ExpandableCard
            style={{ marginBottom: spacing.base }}
            expandedContent={
              <View>
                {/* Week schedule */}
                <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
                  This Week
                </Text>
                {activeProgram.days.map((day) => {
                  const isCompleted = programProgress.completedDayIds.includes(day.id);
                  return (
                    <View
                      key={day.id}
                      style={[styles.scheduleRow, { marginBottom: spacing.xs }]}
                    >
                      <Ionicons
                        name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={isCompleted ? colors.success : colors.textTertiary}
                        style={{ marginRight: spacing.sm }}
                      />
                      <Text
                        style={[
                          typography.bodySmall,
                          {
                            color: isCompleted ? colors.success : colors.text,
                            flex: 1,
                          },
                        ]}
                      >
                        Day {day.dayNumber}: {day.name}
                      </Text>
                      <Badge
                        label={DAY_TYPE_LABELS[day.dayType]}
                        variant={isCompleted ? 'success' : 'default'}
                      />
                    </View>
                  );
                })}

                {/* Volume vs target — show weekly volume if available */}
                {weeklyVolume.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <View style={styles.progressDetails}>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        Weekly Volume
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>
                        {formatVolume(weeklyVolume.reduce((s, d) => s + d.volume, 0))} lbs
                      </Text>
                    </View>
                  </View>
                )}

                {/* Switch Program action */}
                <Button
                  title="Switch Program"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/workout/programs')}
                  style={{ marginTop: spacing.md }}
                  icon={<Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />}
                />
              </View>
            }
          >
            {/* Collapsed: program name + current day */}
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
                Day {weeklyProgress?.completedThisWeek ?? 0} of {weeklyProgress?.totalLiftingDays ?? 0} this week
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {programProgress.completedDays}/{programProgress.totalDays} sessions done
              </Text>
            </View>
          </ExpandableCard>
        </Pressable>
      )}

      {/* Welcome banner for new users */}
      {!isActive && !activeProgram && totalWorkouts === 0 && (
        <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
          <Text style={[typography.h3, { color: colors.text }]}>Welcome to FormIQ</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Pick a workout program below to get started, or jump in with a quick workout.
          </Text>
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
                    {dayLabels[i] ?? ''}
                  </Text>
                </View>
              );
            })}
          </View>
          {/* Animated total weekly volume */}
          <View style={[styles.progressDetails, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Total Volume</Text>
            <AnimatedNumber
              value={weeklyVolume.reduce((s, d) => s + d.volume, 0)}
              style={[typography.bodySmall, { color: colors.text, fontWeight: '600' }]}
              formatter={(n: number) => `${formatVolume(Math.round(n))} lbs`}
            />
          </View>
        </Card>
      )}

      {/* Milestones — now with ExpandableCard + AnimatedNumber */}
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

      {/* Recent History — wrapped in ExpandableCard with long-press actions */}
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
            <Pressable
              key={session.id}
              onLongPress={() => showRecentWorkoutActions(session)}
              delayLongPress={400}
              onPress={() => router.push(`/workout/session/${session.id}`)}
            >
              <ExpandableCard
                style={{ marginBottom: spacing.sm }}
                expandedContent={
                  <View>
                    {/* Full exercise list */}
                    {session.exercises.map((exercise) => (
                      <View key={exercise.exerciseId} style={{ marginBottom: spacing.sm }}>
                        <Text style={[typography.label, { color: colors.text }]}>
                          {exercise.exerciseName}
                        </Text>
                        {exercise.sets.map((set) => (
                          <View key={set.id} style={[styles.setRow, { marginTop: 2 }]}>
                            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                              Set {set.setNumber}
                            </Text>
                            <Text style={[typography.bodySmall, { color: colors.text }]}>
                              {set.weight ? `${set.weight} lbs` : '—'} × {set.reps ?? '—'}
                              {set.isPR ? ' 🏆' : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}

                    {/* Stats row */}
                    <View style={[styles.expandedStats, { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm, marginTop: spacing.xs }]}>
                      <View style={styles.expandedStatItem}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>Volume</Text>
                        <AnimatedNumber
                          value={session.totalVolume}
                          style={[typography.label, { color: colors.text }]}
                          formatter={(n: number) => formatVolume(Math.round(n))}
                        />
                      </View>
                      <View style={styles.expandedStatItem}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>Duration</Text>
                        <Text style={[typography.label, { color: colors.text }]}>
                          {formatDuration(session.durationSeconds)}
                        </Text>
                      </View>
                      <View style={styles.expandedStatItem}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>PRs</Text>
                        <AnimatedNumber
                          value={session.prCount}
                          style={[typography.label, { color: session.prCount > 0 ? colors.warning : colors.text }]}
                        />
                      </View>
                    </View>

                    {/* Repeat This Workout button */}
                    <Button
                      title="Repeat This Workout"
                      variant="secondary"
                      size="sm"
                      onPress={() => handleRepeatWorkout(session)}
                      style={{ marginTop: spacing.md }}
                      icon={<Ionicons name="repeat-outline" size={16} color={colors.primary} />}
                    />
                  </View>
                }
              >
                {/* Collapsed: fingerprint + workout title + date + brief summary */}
                <View style={styles.historyRow}>
                  <WorkoutFingerprint session={session} size={36} style={{ marginRight: spacing.sm }} />
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
                </View>
              </ExpandableCard>
            </Pressable>
          ))
        )}
      </View>
      <CoachFAB context="workout" label="Ask Coach" prefilledMessage="Help me with my workout" />

      {/* Start Workout FAB */}
      <TouchableOpacity
        onPress={() => setShowStartSheet(true)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

      <StartWorkoutSheet
        visible={showStartSheet}
        onClose={() => setShowStartSheet(false)}
        todayWorkout={todayWorkout}
        activeProgram={activeProgram}
        onStartProgramWorkout={handleStartToday}
        onStartAIWorkout={() => {
          handleWorkoutLimitCheck(() => {
            router.push('/workout/ai-generate');
          });
        }}
        onStartEmptyWorkout={handleQuickStart}
      />

      {/* Quick Action Sheet */}
      <QuickActionSheet {...sheetProps} />
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
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 8,
  },
  expandedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  expandedStatItem: {
    alignItems: 'center',
  },
});
