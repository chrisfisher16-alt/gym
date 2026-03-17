import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useSuggestedLoad } from '../../src/hooks/useSuggestedLoad';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { Card, Button, Badge } from '../../src/components/ui';
import { formatTimerDisplay, formatWeight } from '../../src/lib/workout-utils';
import { getLastPerformance } from '../../src/lib/suggested-load';
import { REST_TIMER_PRESETS } from '../../src/types/workout';
import type { ActiveExercise, ActiveSet } from '../../src/types/workout';

// ── Set Row Component ───────────────────────────────────────────────

function SetRow({
  set,
  exerciseInstanceId,
  onLog,
  onComplete,
  onRemove,
  onRPE,
}: {
  set: ActiveSet;
  exerciseInstanceId: string;
  onLog: (setId: string, weight: number, reps: number) => void;
  onComplete: (setId: string) => void;
  onRemove: (setId: string) => void;
  onRPE: (setId: string, rpe: number) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? '');
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? '');

  useEffect(() => {
    if (set.weight !== undefined) setLocalWeight(set.weight.toString());
  }, [set.weight]);

  useEffect(() => {
    if (set.reps !== undefined) setLocalReps(set.reps.toString());
  }, [set.reps]);

  useEffect(() => {
    if (set.isPR && set.isCompleted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [set.isPR, set.isCompleted]);

  const handleWeightChange = (text: string) => {
    setLocalWeight(text);
    const w = parseFloat(text);
    const r = parseInt(localReps, 10);
    if (!isNaN(w) && !isNaN(r)) {
      onLog(set.id, w, r);
    }
  };

  const handleRepsChange = (text: string) => {
    setLocalReps(text);
    const w = parseFloat(localWeight);
    const r = parseInt(text, 10);
    if (!isNaN(w) && !isNaN(r)) {
      onLog(set.id, w, r);
    }
  };

  const incrementWeight = (delta: number) => {
    const current = parseFloat(localWeight) || 0;
    const newVal = Math.max(0, current + delta);
    setLocalWeight(newVal.toString());
    const r = parseInt(localReps, 10);
    if (!isNaN(r)) onLog(set.id, newVal, r);
  };

  const incrementReps = (delta: number) => {
    const current = parseInt(localReps, 10) || 0;
    const newVal = Math.max(0, current + delta);
    setLocalReps(newVal.toString());
    const w = parseFloat(localWeight);
    if (!isNaN(w)) onLog(set.id, w, newVal);
  };

  const handleComplete = () => {
    const w = parseFloat(localWeight);
    const r = parseInt(localReps, 10);
    if (!isNaN(w) && !isNaN(r)) {
      onLog(set.id, w, r);
    }
    onComplete(set.id);
  };

  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';
  const setTypeColor =
    set.setType === 'warmup' ? colors.warning : set.setType === 'drop' ? colors.info : colors.text;

  return (
    <View
      style={[
        styles.setRow,
        {
          backgroundColor: set.isCompleted ? (set.isPR ? colors.warningLight : colors.successLight) : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          marginBottom: 2,
        },
      ]}
    >
      {/* Set number */}
      <View style={[styles.setNumber, { width: 28 }]}>
        <Text style={[typography.labelSmall, { color: setTypeLabel ? setTypeColor : colors.textSecondary }]}>
          {setTypeLabel || set.setNumber}
        </Text>
      </View>

      {/* Weight input with +/- */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPress={() => incrementWeight(-5)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>-5</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.numericInput,
            typography.label,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.sm,
            },
          ]}
          value={localWeight}
          onChangeText={handleWeightChange}
          keyboardType="decimal-pad"
          placeholder="lbs"
          placeholderTextColor={colors.textTertiary}
          selectTextOnFocus
        />
        <TouchableOpacity
          onPress={() => incrementWeight(5)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>+5</Text>
        </TouchableOpacity>
      </View>

      <Text style={[typography.bodySmall, { color: colors.textTertiary, marginHorizontal: 2 }]}>×</Text>

      {/* Reps input with +/- */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPress={() => incrementReps(-1)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>-1</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.numericInput,
            typography.label,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.sm,
            },
          ]}
          value={localReps}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          placeholder="reps"
          placeholderTextColor={colors.textTertiary}
          selectTextOnFocus
        />
        <TouchableOpacity
          onPress={() => incrementReps(1)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>+1</Text>
        </TouchableOpacity>
      </View>

      {/* Complete checkmark */}
      <TouchableOpacity
        onPress={handleComplete}
        disabled={set.isCompleted}
        style={[
          styles.checkBtn,
          {
            backgroundColor: set.isCompleted ? colors.success : colors.surfaceSecondary,
            borderRadius: radius.sm,
          },
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={set.isCompleted ? 'checkmark' : 'checkmark-outline'}
          size={20}
          color={set.isCompleted ? colors.textInverse : colors.textTertiary}
        />
      </TouchableOpacity>

      {/* PR badge */}
      {set.isPR && (
        <View style={styles.prBadge}>
          <Ionicons name="trophy" size={14} color={colors.warning} />
        </View>
      )}
    </View>
  );
}

// ── Exercise Card Component ─────────────────────────────────────────

function ExerciseCard({
  exercise,
  isCurrent,
  isInSuperset,
}: {
  exercise: ActiveExercise;
  isCurrent: boolean;
  isInSuperset: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const logSet = useWorkoutStore((s) => s.logSet);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const updateSetRPE = useWorkoutStore((s) => s.updateSetRPE);
  const addSet = useWorkoutStore((s) => s.addSet);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);

  const unit = 'lbs'; // TODO: from prefs
  const lastPerf = getLastPerformance(exercise.exerciseId, history, unit);

  const handleLogSet = useCallback(
    (setId: string, weight: number, reps: number) => {
      logSet(exercise.id, setId, weight, reps);
    },
    [logSet, exercise.id],
  );

  const handleCompleteSet = useCallback(
    (setId: string) => {
      completeSet(exercise.id, setId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Auto-start rest timer (90s default)
      if (!isInSuperset) {
        startRestTimer(90);
      }
    },
    [completeSet, exercise.id, startRestTimer, isInSuperset],
  );

  const handleRemoveSet = useCallback(
    (setId: string) => {
      removeSet(exercise.id, setId);
    },
    [removeSet, exercise.id],
  );

  const handleRPE = useCallback(
    (setId: string, rpe: number) => {
      updateSetRPE(exercise.id, setId, rpe);
    },
    [updateSetRPE, exercise.id],
  );

  if (exercise.isSkipped) return null;

  return (
    <View
      style={[
        styles.exerciseCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          marginBottom: spacing.md,
          borderWidth: isCurrent ? 2 : 1,
          borderColor: isCurrent ? colors.primary : colors.borderLight,
        },
      ]}
    >
      {/* Superset indicator */}
      {isInSuperset && (
        <View style={[styles.supersetBar, { backgroundColor: colors.primary, borderRadius: 2 }]} />
      )}

      {/* Exercise name */}
      <Text style={[typography.labelLarge, { color: colors.text }]}>{exercise.exerciseName}</Text>

      {/* Previous performance */}
      {lastPerf && (
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
          Last: {lastPerf}
        </Text>
      )}

      {/* Set header */}
      <View style={[styles.setHeader, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
        <Text style={[typography.caption, { color: colors.textTertiary, width: 28 }]}>SET</Text>
        <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
          WEIGHT
        </Text>
        <Text style={{ width: 14 }} />
        <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
          REPS
        </Text>
        <Text style={{ width: 34 }} />
      </View>

      {/* Sets */}
      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          exerciseInstanceId={exercise.id}
          onLog={handleLogSet}
          onComplete={handleCompleteSet}
          onRemove={handleRemoveSet}
          onRPE={handleRPE}
        />
      ))}

      {/* Add set buttons */}
      <View style={[styles.addSetRow, { marginTop: spacing.sm }]}>
        <TouchableOpacity
          onPress={() => addSet(exercise.id, 'working')}
          style={styles.addSetBtn}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>Add Set</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => addSet(exercise.id, 'warmup')}
          style={styles.addSetBtn}
        >
          <Ionicons name="add" size={16} color={colors.warning} />
          <Text style={[typography.labelSmall, { color: colors.warning, marginLeft: 4 }]}>Warmup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Rest Timer Modal ────────────────────────────────────────────────

function RestTimerOverlay() {
  const { colors, spacing, radius, typography } = useTheme();
  const { isRestTimerActive, restSecondsLeft, clearRestTimer, startRestTimer } = useActiveWorkout();

  useEffect(() => {
    if (restSecondsLeft === 0 && isRestTimerActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [restSecondsLeft, isRestTimerActive]);

  if (!isRestTimerActive) return null;

  return (
    <View style={[styles.restOverlay, { backgroundColor: colors.overlay }]}>
      <View
        style={[
          styles.restCard,
          { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
        ]}
      >
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>Rest Timer</Text>
        <Text style={[typography.displayLarge, { color: colors.primary, marginBottom: spacing.lg }]}>
          {formatTimerDisplay(restSecondsLeft)}
        </Text>

        <View style={styles.restPresets}>
          {REST_TIMER_PRESETS.map((seconds) => (
            <TouchableOpacity
              key={seconds}
              onPress={() => startRestTimer(seconds)}
              style={[
                styles.presetBtn,
                { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.text }]}>
                {formatTimerDisplay(seconds)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button title="Skip Rest" variant="ghost" size="md" onPress={clearRestTimer} style={{ marginTop: spacing.md }} />
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    activeSession,
    isActive,
    elapsedDisplay,
    totalVolume,
    completedSets,
    completeWorkout,
    cancelWorkout,
    addExerciseToSession,
    goToNextExercise,
    goToPreviousExercise,
  } = useActiveWorkout();

  useEffect(() => {
    if (!isActive) {
      router.replace('/(tabs)/workout');
    }
  }, [isActive, router]);

  const handleFinish = () => {
    Alert.alert('Finish Workout', 'Are you sure you want to finish this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          completeWorkout();
          router.replace('/(tabs)/workout');
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('Cancel Workout', 'This will discard all progress. Are you sure?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          router.replace('/(tabs)/workout');
        },
      },
    ]);
  };

  const handleAddExercise = () => {
    router.push('/workout/exercises');
  };

  if (!activeSession) return null;

  // Determine superset groups
  const supersetGroupIds = new Set<string>();
  activeSession.exercises.forEach((e) => {
    if (e.supersetGroupId) supersetGroupIds.add(e.supersetGroupId);
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.error} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              {activeSession.name}
            </Text>
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                {elapsedDisplay}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleFinish}
            style={[styles.finishBtn, { backgroundColor: colors.success, borderRadius: radius.md }]}
          >
            <Text style={[typography.labelSmall, { color: colors.textInverse }]}>Finish</Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={[styles.statsBar, { paddingHorizontal: spacing.base, paddingVertical: spacing.sm }]}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Sets: {completedSets}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Volume: {totalVolume.toLocaleString()} lbs
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Exercises: {activeSession.exercises.filter((e) => !e.isSkipped).length}
          </Text>
        </View>

        {/* Exercise list */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSession.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isCurrent={index === activeSession.currentExerciseIndex}
              isInSuperset={!!exercise.supersetGroupId}
            />
          ))}

          {/* Add Exercise button */}
          <TouchableOpacity
            onPress={handleAddExercise}
            style={[
              styles.addExerciseCard,
              { borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>
              Add Exercise
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom nav */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderLight,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <TouchableOpacity
            onPress={goToPreviousExercise}
            style={[styles.navBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            disabled={activeSession.currentExerciseIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={activeSession.currentExerciseIndex === 0 ? colors.textTertiary : colors.text}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: activeSession.currentExerciseIndex === 0 ? colors.textTertiary : colors.text,
                  marginLeft: 4,
                },
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {activeSession.currentExerciseIndex + 1} / {activeSession.exercises.length}
          </Text>

          <TouchableOpacity
            onPress={goToNextExercise}
            style={[styles.navBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            disabled={activeSession.currentExerciseIndex >= activeSession.exercises.length - 1}
          >
            <Text
              style={[
                typography.labelSmall,
                {
                  color:
                    activeSession.currentExerciseIndex >= activeSession.exercises.length - 1
                      ? colors.textTertiary
                      : colors.text,
                  marginRight: 4,
                },
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                activeSession.currentExerciseIndex >= activeSession.exercises.length - 1
                  ? colors.textTertiary
                  : colors.text
              }
            />
          </TouchableOpacity>
        </View>

        {/* Rest Timer Overlay */}
        <RestTimerOverlay />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  finishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  exerciseCard: {
    position: 'relative',
  },
  supersetBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  incBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  numericInput: {
    borderWidth: 1,
    textAlign: 'center',
    flex: 1,
    minHeight: 36,
    marginHorizontal: 2,
    paddingHorizontal: 4,
  },
  checkBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  prBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  addSetRow: {
    flexDirection: 'row',
    gap: 16,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  restOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  restCard: {
    width: '85%',
    alignItems: 'center',
  },
  restPresets: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
