import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useExerciseLibrary } from '../../src/hooks/useExerciseLibrary';
import { usePersonalRecords } from '../../src/hooks/usePersonalRecords';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { Badge, Card, Button, BottomSheet } from '../../src/components/ui';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_ICONS } from '../../src/lib/exercise-data';
import { getExerciseHistory } from '../../src/lib/workout-db';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { formatFullDate, formatWeight } from '../../src/lib/workout-utils';
import { ExerciseIllustration } from '../../src/components/ExerciseIllustration';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { checkWorkoutLogLimit, incrementUsage } from '../../src/lib/usage-limits';

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { getExerciseById } = useExerciseLibrary();
  const { getRecordForExercise, getExercisePRHistory } = usePersonalRecords();
  const { isActive, addExerciseToSession } = useActiveWorkout();
  const history = useWorkoutStore((s) => s.history);
  const startEmptyWorkout = useWorkoutStore((s) => s.startEmptyWorkout);
  const [showStartSheet, setShowStartSheet] = useState(false);
  const { canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();

  const exercise = getExerciseById(exerciseId ?? '');
  const record = getRecordForExercise(exerciseId ?? '');
  const recentHistory = getExerciseHistory(exerciseId ?? '', history, 5);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';

  if (!exercise) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Exercise not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleAddToWorkout = () => {
    addExerciseToSession(exercise);
    // Go back 2 screens: [exerciseId] -> exercises -> active
    if (router.canDismiss()) {
      router.dismiss(2);
    } else {
      router.replace('/workout/active');
    }
  };

  const handleBuildOwn = () => {
    setShowStartSheet(false);

    const doStart = () => {
      startEmptyWorkout();
      addExerciseToSession(exercise);
      router.push('/workout/active');
    };

    if (canAccess('unlimited_workouts')) {
      doStart();
      return;
    }
    // Free tier — check usage
    checkWorkoutLogLimit().then((usage) => {
      if (usage.allowed) {
        incrementUsage('workout_logs');
        doStart();
      } else {
        crossPlatformAlert(
          'Workout Limit Reached',
          `You've used all ${usage.limit} free workouts this month. Upgrade to Workout Coach for unlimited workouts.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_workouts', source: 'exercise_detail' }) },
          ],
        );
      }
    });
  };

  const handleBuildForMuscles = () => {
    setShowStartSheet(false);
    router.push('/workout/ai-generate');
  };

  const handleWatchTutorial = () => {
    const query = encodeURIComponent(`how to do ${exercise.name} proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
          {exercise.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta */}
        <View style={[styles.metaRow, { marginBottom: spacing.base }]}>
          <Badge label={MUSCLE_GROUP_LABELS[exercise.category]} variant="info" />
          <Badge label={EQUIPMENT_LABELS[exercise.equipment]} variant="default" />
          {exercise.isCustom && <Badge label="Custom" variant="pro" />}
          {exercise.isTimeBased && <Badge label="Timed" variant="default" />}
        </View>

        {/* Exercise Illustration */}
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.illustrationPlaceholder}>
            <ExerciseIllustration
              exerciseId={exercise.id}
              category={exercise.category}
              equipment={exercise.equipment}
              primaryMuscles={exercise.primaryMuscles}
              size="large"
            />
            <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              {exercise.name}
            </Text>
          </View>
        </Card>

        {/* Primary Muscles Visual */}
        <Card style={{ marginBottom: spacing.base }}>
          <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>Muscles</Text>
          <View style={styles.muscleChips}>
            {exercise.primaryMuscles.map((muscle) => (
              <View
                key={muscle}
                style={[
                  styles.muscleChip,
                  {
                    backgroundColor: colors.primaryMuted,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Ionicons name="fitness" size={12} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                  {muscle}
                </Text>
              </View>
            ))}
          </View>
          {exercise.secondaryMuscles.length > 0 && (
            <View style={[styles.muscleChips, { marginTop: spacing.xs }]}>
              {exercise.secondaryMuscles.map((muscle) => (
                <View
                  key={muscle}
                  style={[
                    styles.muscleChip,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                    {muscle}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Instructions */}
        <Card style={{ marginBottom: spacing.base }}>
          <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>Instructions</Text>
          {exercise.instructions.map((step, i) => (
            <View key={i} style={[styles.instructionRow, { marginBottom: spacing.xs }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primaryMuted }]}>
                <Text style={[typography.labelSmall, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
                {step}
              </Text>
            </View>
          ))}
        </Card>

        {/* PR Records */}
        {record && (
          <Card style={{ marginBottom: spacing.base }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              Personal Records
            </Text>
            {record.heaviestWeight && (
              <View style={[styles.prRow, { marginBottom: spacing.xs }]}>
                <Ionicons name="trophy" size={16} color={colors.warning} />
                <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                  Heaviest: {formatWeight(record.heaviestWeight.weight, unit)} × {record.heaviestWeight.reps}
                </Text>
              </View>
            )}
            {record.highestVolume && (
              <View style={[styles.prRow, { marginBottom: spacing.xs }]}>
                <Ionicons name="trending-up" size={16} color={colors.completed} />
                <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                  Best Volume: {record.highestVolume.volume.toLocaleString()} {unit}
                </Text>
              </View>
            )}
            {record.mostReps && (
              <View style={styles.prRow}>
                <Ionicons name="repeat" size={16} color={colors.info} />
                <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                  Most Reps: {record.mostReps.reps} @ {formatWeight(record.mostReps.weight, unit)}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Recent Sets */}
        {recentHistory.length > 0 && (
          <Card style={{ marginBottom: spacing.base }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              Recent Sessions
            </Text>
            {recentHistory.map((entry) => (
              <View key={entry.sessionId} style={[styles.historyEntry, { marginBottom: spacing.md }]}>
                <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                  {formatFullDate(entry.date)} — {entry.sessionName}
                </Text>
                <View style={[styles.setsRow, { marginTop: spacing.xs }]}>
                  {entry.sets
                    .filter((s) => s.setType !== 'warmup')
                    .map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.setChip,
                          {
                            backgroundColor: s.isPR ? colors.warningLight : colors.surfaceSecondary,
                            borderRadius: radius.sm,
                            marginRight: spacing.xs,
                          },
                        ]}
                      >
                        <Text style={[typography.bodySmall, { color: s.isPR ? colors.warning : colors.text }]}>
                          {s.weight ?? 0} × {s.reps ?? 0}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Watch Tutorial */}
        <Card style={{ marginBottom: spacing.base }}>
          <TouchableOpacity
            onPress={handleWatchTutorial}
            style={styles.tutorialButton}
            activeOpacity={0.7}
          >
            <View style={[styles.youtubeIcon, { backgroundColor: '#FF0000' }]}>
              <Ionicons name="logo-youtube" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.label, { color: colors.text }]}>Watch Tutorial</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Search YouTube for proper form
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Add to Workout / Start Workout FAB */}
      <View style={[styles.fab, { paddingHorizontal: spacing.base, paddingBottom: spacing.xl }]}>
        {isActive ? (
          <Button title="Add to Workout" onPress={handleAddToWorkout} />
        ) : (
          <Button title="Start Workout" onPress={() => setShowStartSheet(true)} />
        )}
      </View>

      <BottomSheet visible={showStartSheet} onClose={() => setShowStartSheet(false)} maxHeight={0.4} scrollable={false}>
        <View style={{ padding: spacing.base }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.base }]}>
            Start a Workout
          </Text>

          <TouchableOpacity
            onPress={handleBuildOwn}
            style={[styles.optionRow, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm }]}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="barbell-outline" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.label, { color: colors.text }]}>Build My Own Workout</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Start with {exercise.name} and add more exercises
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBuildForMuscles}
            style={[styles.optionRow, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base }]}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.completedMuted || colors.primaryMuted }]}>
              <Ionicons name="body-outline" size={24} color={colors.completed || colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.label, { color: colors.text }]}>Build for Muscle Groups</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Select target muscles and we'll build your workout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyEntry: {},
  setsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  setChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  illustrationPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  illustrationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tutorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youtubeIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
