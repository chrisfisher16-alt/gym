import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { Button, Card, ScreenContainer, Badge } from '../../src/components/ui';
import { formatSessionDate, formatDuration, formatVolume } from '../../src/lib/workout-utils';
import { CoachFAB } from '../../src/components/CoachFAB';

export default function WorkoutTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const initialize = useWorkoutStore((s) => s.initialize);
  const isInitialized = useWorkoutStore((s) => s.isInitialized);
  const { isActive, startEmptyWorkout, activeSession } = useActiveWorkout();
  const { activeProgram, getTodayWorkout } = useWorkoutPrograms();
  const { recentWorkouts, weeklyVolume, totalWorkouts } = useWorkoutHistory();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  const todayWorkout = activeProgram ? getTodayWorkout() : null;

  const handleQuickStart = () => {
    if (isActive) {
      router.push('/workout/active');
      return;
    }
    startEmptyWorkout();
    router.push('/workout/active');
  };

  const handleStartToday = () => {
    if (isActive) {
      Alert.alert('Workout in Progress', 'Please finish or cancel your current workout first.');
      return;
    }
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
  };

  // Simple weekly volume chart bars
  const maxVolume = Math.max(...weeklyVolume.map((d) => d.volume), 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Workout</Text>
        {isActive && (
          <TouchableOpacity onPress={() => router.push('/workout/active')}>
            <Badge label="In Progress" variant="success" />
          </TouchableOpacity>
        )}
      </View>

      {/* Resume active workout */}
      {isActive && activeSession && (
        <Card style={{ marginBottom: spacing.base, borderColor: colors.success, borderWidth: 2 }}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash" size={20} color={colors.success} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              Workout in Progress
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {activeSession.name}
          </Text>
          <Button
            title="Resume Workout"
            size="md"
            onPress={() => router.push('/workout/active')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      {/* Today's Workout */}
      {!isActive && todayWorkout && activeProgram && (
        <Card style={{ marginBottom: spacing.base }}>
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
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Start an empty workout and add exercises as you go.
          </Text>
          <Button
            title="Start Empty Workout"
            variant="secondary"
            size="md"
            onPress={handleQuickStart}
            style={{ marginTop: spacing.md }}
          />
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
