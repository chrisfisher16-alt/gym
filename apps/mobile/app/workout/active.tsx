import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Modal,
  FlatList,
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { Card, Button, Badge } from '../../src/components/ui';
import { formatTimerDisplay, formatWeight, formatDuration } from '../../src/lib/workout-utils';
import { getLastPerformance, getSuggestedLoad } from '../../src/lib/suggested-load';
import { getSuggestedReplacements } from '../../src/lib/exercise-replacement';
import { EQUIPMENT_LABELS } from '../../src/lib/exercise-data';
import { REST_TIMER_PRESETS } from '../../src/types/workout';
import type { ActiveExercise, ActiveSet, ExerciseLibraryEntry, CompletedSession } from '../../src/types/workout';
import { InWorkoutCoach } from '../../src/components/InWorkoutCoach';
import { FocusedWorkoutView } from '../../src/components/FocusedWorkoutView';
import { ExerciseIllustration } from '../../src/components/ExerciseIllustration';

// Lazy-load native module (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

const DURATION_PRESETS = [30, 45, 60, 90, 120];

// ── Timed Set Row Component ─────────────────────────────────────────

const TimedSetRow = React.memo(function TimedSetRow({
  set,
  exerciseInstanceId,
  defaultDuration,
  onLogDuration,
  onComplete,
}: {
  set: ActiveSet;
  exerciseInstanceId: string;
  defaultDuration: number;
  onLogDuration: (setId: string, durationSeconds: number) => void;
  onComplete: (setId: string) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [selectedDuration, setSelectedDuration] = useState(set.durationSeconds ?? defaultDuration);
  const [timerActive, setTimerActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(selectedDuration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerActive) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerActive(false);
          Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onLogDuration(set.id, selectedDuration);
          onComplete(set.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive, selectedDuration, set.id, onLogDuration, onComplete]);

  const handleStart = () => {
    setSecondsLeft(selectedDuration);
    setTimerActive(true);
  };

  const handlePause = () => {
    setTimerActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleReset = () => {
    setTimerActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(selectedDuration);
  };

  const handleSelectDuration = (d: number) => {
    setSelectedDuration(d);
    setSecondsLeft(d);
    onLogDuration(set.id, d);
  };

  const handleManualComplete = () => {
    onLogDuration(set.id, selectedDuration);
    onComplete(set.id);
  };

  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';

  if (set.isCompleted) {
    return (
      <View
        style={[
          styles.setRow,
          {
            backgroundColor: colors.successLight,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            marginBottom: 2,
          },
        ]}
      >
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {setTypeLabel || set.setNumber}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[typography.label, { color: colors.success }]}>
            {set.durationSeconds ?? selectedDuration}s ✓
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.timedSetContainer,
        {
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          marginBottom: 4,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
    >
      <View style={styles.timedSetHeader}>
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {setTypeLabel || set.setNumber}
          </Text>
        </View>
        {/* Timer display */}
        <View style={styles.timerDisplay}>
          <Text style={[typography.h2, { color: timerActive ? colors.primary : colors.text }]}>
            {formatTimerDisplay(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* Duration presets */}
      {!timerActive && (
        <View style={styles.durationPresets}>
          {DURATION_PRESETS.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => handleSelectDuration(d)}
              style={[
                styles.durationChip,
                {
                  backgroundColor: selectedDuration === d ? colors.primary : colors.surface,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: selectedDuration === d ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: selectedDuration === d ? colors.textInverse : colors.text },
                ]}
              >
                {d}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Timer controls */}
      <View style={styles.timerControls}>
        {!timerActive ? (
          <>
            <TouchableOpacity
              onPress={handleStart}
              style={[styles.timerBtn, { backgroundColor: colors.success, borderRadius: radius.md }]}
            >
              <Ionicons name="play" size={16} color={colors.textInverse} />
              <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleManualComplete}
              style={[styles.timerBtn, { backgroundColor: colors.primaryMuted, borderRadius: radius.md }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={handlePause}
              style={[styles.timerBtn, { backgroundColor: colors.warning, borderRadius: radius.md }]}
            >
              <Ionicons name="pause" size={16} color={colors.textInverse} />
              <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.timerBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }]}
            >
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={[typography.labelSmall, { color: colors.text, marginLeft: 4 }]}>Reset</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

// ── Set Row Component ───────────────────────────────────────────────

const SetRow = React.memo(function SetRow({
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
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (set.weight !== undefined) setLocalWeight(set.weight.toString());
  }, [set.weight]);

  useEffect(() => {
    if (set.reps !== undefined) setLocalReps(set.reps.toString());
  }, [set.reps]);

  useEffect(() => {
    if (set.isPR && set.isCompleted) {
      Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // PR trophy bounce
      Animated.sequence([
        Animated.timing(prBounce, { toValue: 1.5, duration: 150, useNativeDriver: true }),
        Animated.spring(prBounce, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
  }, [set.isPR, set.isCompleted]);

  // Green flash when set completes
  useEffect(() => {
    if (set.isCompleted) {
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [set.isCompleted]);

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
    <Animated.View
      style={[
        styles.setRow,
        {
          backgroundColor: set.isCompleted ? (set.isPR ? colors.warningLight : colors.successLight) : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.md,
          marginBottom: 4,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Green flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.success,
            borderRadius: radius.md,
            opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
          },
        ]}
      />

      {/* Set number */}
      <View style={[styles.setNumber, { width: 28 }]}>
        <Text style={[typography.label, { color: setTypeLabel ? setTypeColor : colors.textSecondary, fontWeight: '600' }]}>
          {setTypeLabel || set.setNumber}
        </Text>
      </View>

      {/* Weight input with +/- */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPress={() => incrementWeight(-5)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
        >
          <Text style={[typography.label, { color: colors.text, fontWeight: '700' }]}>-5</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.numericInput,
            typography.labelLarge,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              fontWeight: '700',
              fontSize: 16,
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
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
        >
          <Text style={[typography.label, { color: colors.text, fontWeight: '700' }]}>+5</Text>
        </TouchableOpacity>
      </View>

      <Text style={[typography.label, { color: colors.textTertiary, marginHorizontal: 4 }]}>×</Text>

      {/* Reps input with +/- */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPress={() => incrementReps(-1)}
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
        >
          <Text style={[typography.label, { color: colors.text, fontWeight: '700' }]}>-1</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.numericInput,
            typography.labelLarge,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              fontWeight: '700',
              fontSize: 16,
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
          style={[styles.incBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
        >
          <Text style={[typography.label, { color: colors.text, fontWeight: '700' }]}>+1</Text>
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
            borderRadius: radius.md,
          },
        ]}
      >
        <Ionicons
          name={set.isCompleted ? 'checkmark' : 'checkmark-outline'}
          size={24}
          color={set.isCompleted ? colors.textInverse : colors.textTertiary}
        />
      </TouchableOpacity>

      {/* Remove set button - only for incomplete sets */}
      {!set.isCompleted && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Remove Set', 'Remove this set?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemove(set.id) },
            ]);
          }}
          style={[styles.removeBtn, { marginLeft: 4 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      )}

      {/* PR badge */}
      {set.isPR && (
        <Animated.View style={[styles.prBadge, { transform: [{ scale: prBounce }] }]}>
          <Ionicons name="trophy" size={16} color={colors.gold ?? colors.warning} />
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ── Exercise Replacement Modal ──────────────────────────────────────

function ExerciseReplacementModal({
  visible,
  exercise,
  onClose,
  onSelect,
}: {
  visible: boolean;
  exercise: ActiveExercise | null;
  onClose: () => void;
  onSelect: (newExercise: ExerciseLibraryEntry) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const allExercises = useWorkoutStore((s) => s.exercises);

  if (!exercise) return null;

  const currentLib = allExercises.find((e) => e.id === exercise.exerciseId);
  if (!currentLib) return null;

  const groups = getSuggestedReplacements(currentLib, allExercises);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.modalHeader, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            Replace {exercise.exerciseName}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.label} style={{ marginTop: spacing.base }}>
              <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
                {group.label}
              </Text>
              {group.exercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  style={[
                    styles.replacementItem,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.xs,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>{ex.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {EQUIPMENT_LABELS[ex.equipment]} · {ex.primaryMuscles.join(', ')}
                    </Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {groups.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No replacement exercises found</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Superset Selection Modal ────────────────────────────────────────

function SupersetSelectionModal({
  visible,
  sourceExerciseId,
  exercises,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  sourceExerciseId: string;
  exercises: ActiveExercise[];
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availableExercises = exercises.filter(
    (e) => e.id !== sourceExerciseId && !e.supersetGroupId && !e.isSkipped,
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // max 2 additional = 3 total
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onConfirm([sourceExerciseId, ...selectedIds]);
      setSelectedIds([]);
      onClose();
    }
  };

  const groupLabel = selectedIds.length === 1 ? 'Superset' : selectedIds.length === 2 ? 'Tri-Set' : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.modalHeader, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => { setSelectedIds([]); onClose(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            Create {groupLabel || 'Superset'}
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.md }}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Select 1-2 exercises to group (2 = Superset, 3 = Tri-Set)
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}>
          {availableExercises.map((ex) => {
            const isSelected = selectedIds.includes(ex.id);
            return (
              <TouchableOpacity
                key={ex.id}
                onPress={() => toggleId(ex.id)}
                style={[
                  styles.replacementItem,
                  {
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.borderLight,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.text, flex: 1 }]}>{ex.exerciseName}</Text>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.modalFooter, { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderTopColor: colors.borderLight }]}>
          <Button
            title={`Create ${groupLabel || 'Group'}`}
            onPress={handleConfirm}
            disabled={selectedIds.length === 0}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Exercise Card Component ─────────────────────────────────────────

const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  isCurrent,
  isInSuperset,
  supersetSize,
  supersetLabel,
  onSwapPress,
  onSupersetPress,
  onRemoveSupersetPress,
  isReorderMode,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  exercise: ActiveExercise;
  isCurrent: boolean;
  isInSuperset: boolean;
  supersetSize: number;
  supersetLabel: string;
  onSwapPress: (exercise: ActiveExercise) => void;
  onSupersetPress: (exerciseId: string) => void;
  onRemoveSupersetPress: (groupId: string) => void;
  isReorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const allExercises = useWorkoutStore((s) => s.exercises);
  const logSet = useWorkoutStore((s) => s.logSet);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const updateSetRPE = useWorkoutStore((s) => s.updateSetRPE);
  const addSet = useWorkoutStore((s) => s.addSet);
  const logTimedSet = useWorkoutStore((s) => s.logTimedSet);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const defaultRestSeconds = useWorkoutStore((s) => s.defaultRestSeconds);
  const updateExerciseRestTime = useWorkoutStore((s) => s.updateExerciseRestTime);

  // Exercise library entry for illustration
  const exerciseLib = useMemo(
    () => allExercises.find((e) => e.id === exercise.exerciseId),
    [allExercises, exercise.exerciseId],
  );

  // Per-exercise rest time state
  const [editingRestTime, setEditingRestTime] = useState(false);
  const [restTimeInput, setRestTimeInput] = useState('');
  const REST_PRESETS = [30, 60, 90, 120, 180];

  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const isMetric = unitPref === 'metric';
  const unit = isMetric ? 'kg' : 'lbs';
  const lastPerf = getLastPerformance(exercise.exerciseId, history, unit);

  // Suggestion engine
  const suggestion = useMemo(
    () => getSuggestedLoad(exercise.exerciseId, '8-12', exercise.sets.length, history, isMetric),
    [exercise.exerciseId, exercise.sets.length, history, isMetric],
  );

  // Pre-fill empty sets with suggestion on mount
  useEffect(() => {
    if (!suggestion) return;
    for (const set of exercise.sets) {
      if (!set.isCompleted && set.weight === undefined && set.reps === undefined) {
        logSet(exercise.id, set.id, suggestion.suggestedWeight, suggestion.suggestedReps);
      }
    }
  }, [suggestion?.suggestedWeight, suggestion?.suggestedReps]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    for (const set of exercise.sets) {
      if (!set.isCompleted) {
        logSet(exercise.id, set.id, suggestion.suggestedWeight, suggestion.suggestedReps);
      }
    }
  }, [suggestion, exercise.sets, exercise.id, logSet]);

  const isTimeBased = !!exercise.isTimeBased;
  const defaultDuration = exercise.defaultDurationSeconds ?? 60;

  // Superset bar color: blue for superset, purple for tri-set
  const supersetBarColor = supersetSize >= 3 ? '#9333EA' : colors.primary;

  const handleLogSet = useCallback(
    (setId: string, weight: number, reps: number) => {
      logSet(exercise.id, setId, weight, reps);
    },
    [logSet, exercise.id],
  );

  const handleLogTimedSet = useCallback(
    (setId: string, durationSeconds: number) => {
      logTimedSet(exercise.id, setId, durationSeconds);
    },
    [logTimedSet, exercise.id],
  );

  const handleCompleteSet = useCallback(
    (setId: string) => {
      completeSet(exercise.id, setId);
      Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Auto-start rest timer using per-exercise override or stored default
      if (!isInSuperset) {
        startRestTimer(exercise.restSeconds ?? defaultRestSeconds);
      }
    },
    [completeSet, exercise.id, exercise.restSeconds, startRestTimer, isInSuperset, defaultRestSeconds],
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

  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  const handleYouTube = () => {
    const query = encodeURIComponent(`how to do ${exercise.exerciseName} proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
    setShowOverflowMenu(false);
  };

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
        <View style={[styles.supersetBar, { backgroundColor: supersetBarColor, borderRadius: 2 }]} />
      )}

      {/* Exercise header row */}
      <View style={styles.exerciseHeaderRow}>
        {/* Reorder drag handle */}
        {isReorderMode && (
          <View style={styles.reorderHandle}>
            <Ionicons name="reorder-three" size={22} color={colors.textTertiary} />
          </View>
        )}
        {/* Exercise illustration (small) */}
        {exerciseLib && !isReorderMode && (
          <ExerciseIllustration
            exerciseId={exercise.exerciseId}
            category={exerciseLib.category}
            equipment={exerciseLib.equipment}
            primaryMuscles={exerciseLib.primaryMuscles}
            size="small"
            style={{ marginRight: spacing.sm }}
          />
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.exerciseNameRow}>
            <Text style={[typography.labelLarge, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {exercise.exerciseName}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {isInSuperset && !isReorderMode && (
              <Badge label={supersetLabel} variant="info" />
            )}
            {!isReorderMode && (
              <TouchableOpacity
                onPress={() => {
                  setRestTimeInput((exercise.restSeconds ?? defaultRestSeconds).toString());
                  setEditingRestTime(true);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[typography.caption, { color: colors.primary }]}>
                  Rest: {exercise.restSeconds ?? defaultRestSeconds}s
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Reorder arrows */}
        {isReorderMode ? (
          <View style={styles.reorderBtns}>
            {!isFirst && (
              <TouchableOpacity
                onPress={onMoveUp}
                style={[styles.reorderArrow, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-up" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {!isLast && (
              <TouchableOpacity
                onPress={onMoveDown}
                style={[styles.reorderArrow, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-down" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Overflow menu button - hides YouTube, swap, superset */
          <TouchableOpacity
            onPress={() => setShowOverflowMenu(!showOverflowMenu)}
            style={[styles.overflowBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Overflow menu items */}
      {showOverflowMenu && !isReorderMode && (
        <View style={[
          styles.overflowMenu,
          { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
        ]}>
          <TouchableOpacity
            onPress={() => { onSwapPress(exercise); setShowOverflowMenu(false); }}
            style={[styles.overflowMenuItem, { paddingVertical: spacing.sm }]}
          >
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>Swap Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleYouTube} style={[styles.overflowMenuItem, { paddingVertical: spacing.sm }]}>
            <Ionicons name="logo-youtube" size={16} color="#FF0000" />
            <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>Watch Form Video</Text>
          </TouchableOpacity>
          {!isInSuperset ? (
            <TouchableOpacity
              onPress={() => { onSupersetPress(exercise.id); setShowOverflowMenu(false); }}
              style={[styles.overflowMenuItem, { paddingVertical: spacing.sm }]}
            >
              <Ionicons name="git-merge-outline" size={16} color={colors.primary} />
              <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>Create Superset</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => { onRemoveSupersetPress(exercise.supersetGroupId!); setShowOverflowMenu(false); }}
              style={[styles.overflowMenuItem, { paddingVertical: spacing.sm }]}
            >
              <Ionicons name="git-merge-outline" size={16} color={colors.error} />
              <Text style={[typography.label, { color: colors.error, marginLeft: spacing.sm }]}>Remove Superset</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Per-exercise rest time editor */}
      {editingRestTime && !isReorderMode && (
        <View style={[
          styles.restTimeEditor,
          { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
        ]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Rest Time</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {REST_PRESETS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                onPress={() => {
                  updateExerciseRestTime(exercise.id, seconds);
                  setEditingRestTime(false);
                }}
                style={[
                  styles.restPresetChip,
                  {
                    backgroundColor: (exercise.restSeconds ?? defaultRestSeconds) === seconds
                      ? colors.primary
                      : colors.surface,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: (exercise.restSeconds ?? defaultRestSeconds) === seconds
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: (exercise.restSeconds ?? defaultRestSeconds) === seconds
                        ? colors.textInverse
                        : colors.text,
                    },
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 6 }}>
            <TextInput
              style={[
                styles.restCustomInput,
                typography.labelSmall,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                },
              ]}
              value={restTimeInput}
              onChangeText={setRestTimeInput}
              keyboardType="number-pad"
              placeholder="sec"
              placeholderTextColor={colors.textTertiary}
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => {
                const val = parseInt(restTimeInput, 10);
                if (!isNaN(val) && val > 0) {
                  updateExerciseRestTime(exercise.id, val);
                }
                setEditingRestTime(false);
              }}
              style={[
                styles.restApplyBtn,
                { backgroundColor: colors.primary, borderRadius: radius.sm },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.textInverse }]}>Set</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingRestTime(false)}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* In reorder mode, hide the detailed content */}
      {isReorderMode ? (
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
          {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
        </Text>
      ) : (
      <>

      {/* Previous performance */}
      {lastPerf && (
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
          Last: {lastPerf}
        </Text>
      )}

      {/* Suggestion banner */}
      {suggestion && !isTimeBased && (
        <TouchableOpacity
          onPress={handleApplySuggestion}
          activeOpacity={0.7}
          style={[
            styles.suggestionBanner,
            {
              backgroundColor: suggestion.confidence === 'high' ? colors.successLight : colors.primaryMuted,
              borderRadius: radius.md,
              padding: spacing.sm,
              marginTop: spacing.xs,
            },
          ]}
        >
          <View style={styles.suggestionRow}>
            <Ionicons name="trending-up" size={14} color={suggestion.confidence === 'high' ? colors.success : colors.primary} />
            <Text style={[typography.labelSmall, { color: suggestion.confidence === 'high' ? colors.success : colors.primary, marginLeft: 4, flex: 1 }]}>
              Suggested: {suggestion.suggestedWeight} {unit} × {suggestion.suggestedReps} reps
            </Text>
            <Ionicons name="arrow-forward-circle-outline" size={16} color={suggestion.confidence === 'high' ? colors.success : colors.primary} />
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 18 }]} numberOfLines={1}>
            {suggestion.explanation}
          </Text>
        </TouchableOpacity>
      )}

      {/* Time-based exercises */}
      {isTimeBased ? (
        <>
          <View style={[styles.setHeader, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 28 }]}>SET</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
              DURATION
            </Text>
          </View>
          {exercise.sets.map((set) => (
            <TimedSetRow
              key={set.id}
              set={set}
              exerciseInstanceId={exercise.id}
              defaultDuration={defaultDuration}
              onLogDuration={handleLogTimedSet}
              onComplete={handleCompleteSet}
            />
          ))}
        </>
      ) : (
        <>
          {/* Set header (weight/reps) */}
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
        </>
      )}

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
      </>
      )}
    </View>
  );
});

// ── Rest Timer Modal ────────────────────────────────────────────────

function RestTimerOverlay() {
  const { colors, spacing, radius, typography } = useTheme();
  const { isRestTimerActive, restSecondsLeft, clearRestTimer, startRestTimer } = useActiveWorkout();
  const [customSeconds, setCustomSeconds] = useState('');

  useEffect(() => {
    if (restSecondsLeft === 0 && isRestTimerActive) {
      Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [restSecondsLeft, isRestTimerActive]);

  const handleAdjust = (delta: number) => {
    const currentEnd = restSecondsLeft + delta;
    if (currentEnd > 0) {
      startRestTimer(currentEnd);
    }
  };

  const handleCustomStart = () => {
    const val = parseInt(customSeconds, 10);
    if (!isNaN(val) && val > 0) {
      startRestTimer(val);
      setCustomSeconds('');
    }
  };

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
        <Text style={[typography.displayLarge, { color: colors.primary, marginBottom: spacing.sm }]}>
          {formatTimerDisplay(restSecondsLeft)}
        </Text>

        {/* +15 / -15 adjustment buttons */}
        <View style={[styles.restPresets, { marginBottom: spacing.md }]}>
          <TouchableOpacity
            onPress={() => handleAdjust(-15)}
            style={[styles.presetBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
          >
            <Text style={[typography.labelSmall, { color: colors.text }]}>-15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleAdjust(15)}
            style={[styles.presetBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
          >
            <Text style={[typography.labelSmall, { color: colors.text }]}>+15s</Text>
          </TouchableOpacity>
        </View>

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

        {/* Custom time input */}
        <View style={[styles.restCustomRow, { marginTop: spacing.md }]}>
          <TextInput
            style={[
              styles.restCustomInput,
              typography.label,
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
            value={customSeconds}
            onChangeText={setCustomSeconds}
            keyboardType="number-pad"
            placeholder="sec"
            placeholderTextColor={colors.textTertiary}
            selectTextOnFocus
          />
          <TouchableOpacity
            onPress={handleCustomStart}
            style={[
              styles.restCustomBtn,
              { backgroundColor: colors.primary, borderRadius: radius.md },
            ]}
          >
            <Text style={[typography.labelSmall, { color: colors.textInverse }]}>Set</Text>
          </TouchableOpacity>
        </View>

        <Button title="Skip Rest" variant="ghost" size="md" onPress={clearRestTimer} style={{ marginTop: spacing.md }} />
      </View>
    </View>
  );
}

// ── Workout Summary Modal ────────────────────────────────────────────

function WorkoutSummaryModal({
  visible,
  session,
  onDone,
}: {
  visible: boolean;
  session: CompletedSession | null;
  onDone: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  if (!session) return null;

  const exercisesDone = session.exercises.length;
  const durationDisplay = formatDuration(session.durationSeconds);

  let message = 'Great workout!';
  if (session.prCount > 0 && session.totalSets >= 20) {
    message = 'Incredible session! New records smashed!';
  } else if (session.prCount > 0) {
    message = 'New personal records! Keep pushing!';
  } else if (session.totalSets >= 20) {
    message = 'Beast mode! Massive volume today!';
  } else if (session.durationSeconds >= 3600) {
    message = 'Solid grind! Over an hour of work!';
  }

  const prExercises = session.exercises.filter((e) =>
    e.sets.some((s) => s.isPR),
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDone}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}>
          <Ionicons name="trophy" size={56} color={colors.warning} style={{ marginBottom: spacing.md }} />
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginBottom: spacing.xs }]}>
            Workout Complete!
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
            {message}
          </Text>

          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.lg }]}>
            {session.name}
          </Text>

          {/* Stats grid */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryStatCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginTop: 4 }]}>{durationDisplay}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Duration</Text>
            </View>
            <View style={[styles.summaryStatCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <Ionicons name="barbell-outline" size={22} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginTop: 4 }]}>{session.totalVolume.toLocaleString()}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Volume (lbs)</Text>
            </View>
            <View style={[styles.summaryStatCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.success} />
              <Text style={[typography.h3, { color: colors.text, marginTop: 4 }]}>{session.totalSets}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Sets</Text>
            </View>
            <View style={[styles.summaryStatCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <Ionicons name="fitness-outline" size={22} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginTop: 4 }]}>{exercisesDone}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Exercises</Text>
            </View>
            {session.prCount > 0 && (
              <View style={[styles.summaryStatCard, { backgroundColor: colors.warningLight, borderRadius: radius.lg }]}>
                <Ionicons name="trophy" size={22} color={colors.warning} />
                <Text style={[typography.h3, { color: colors.text, marginTop: 4 }]}>{session.prCount}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>PRs</Text>
              </View>
            )}
          </View>

          {/* PR details */}
          {prExercises.length > 0 && (
            <View style={{ width: '100%', marginTop: spacing.lg }}>
              <Text style={[typography.labelLarge, { color: colors.warning, marginBottom: spacing.sm }]}>
                Personal Records
              </Text>
              {prExercises.map((ex) => (
                <View
                  key={ex.exerciseId}
                  style={[
                    styles.prSummaryRow,
                    { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs },
                  ]}
                >
                  <Ionicons name="trophy" size={16} color={colors.warning} />
                  <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                    {ex.exerciseName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {ex.sets
                      .filter((s) => s.isPR)
                      .map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`)
                      .join(', ')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Button
            title="Done"
            onPress={onDone}
            style={{ marginTop: spacing.xl, width: '100%' }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    replaceExercise,
    createSupersetGroup,
    removeSupersetGroup,
    goToNextExercise,
    goToPreviousExercise,
    reorderExercises,
    logSet,
    completeSet,
    startRestTimer,
    setCurrentExerciseIndex,
    defaultRestSeconds,
    setDefaultRestSeconds,
  } = useActiveWorkout();

  const [viewMode, setViewMode] = useState<'full' | 'focus'>('full');
  const [swapModalExercise, setSwapModalExercise] = useState<ActiveExercise | null>(null);
  const [supersetSourceId, setSupersetSourceId] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [editingRest, setEditingRest] = useState(false);
  const [restInput, setRestInput] = useState('');

  const doFinish = () => {
    const result = completeWorkout();
    if (result) {
      // Set both together - React batches these in event handlers
      setCompletedSession(result);
      setShowSummary(true);
    } else {
      router.replace('/(tabs)/workout');
    }
  };

  const handleFinish = () => {
    if (!activeSession) return;

    // Count incomplete working sets across non-skipped exercises
    let incompleteSets = 0;
    let exercisesWithIncomplete = 0;
    for (const exercise of activeSession.exercises) {
      if (exercise.isSkipped) continue;
      const incompleteInExercise = exercise.sets.filter(
        (s) => s.setType !== 'warmup' && !s.isCompleted,
      ).length;
      if (incompleteInExercise > 0) {
        incompleteSets += incompleteInExercise;
        exercisesWithIncomplete++;
      }
    }

    if (incompleteSets > 0) {
      Alert.alert(
        'Incomplete Sets',
        `You have ${incompleteSets} incomplete set${incompleteSets !== 1 ? 's' : ''} across ${exercisesWithIncomplete} exercise${exercisesWithIncomplete !== 1 ? 's' : ''}. Are you sure you want to finish?`,
        [
          { text: 'Keep Going', style: 'cancel' },
          { text: 'Finish Anyway', onPress: doFinish },
        ],
      );
    } else {
      Alert.alert('Finish Workout', 'All sets completed. Finish this workout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ]);
    }
  };

  const handleSummaryDone = () => {
    setShowSummary(false);
    setCompletedSession(null);
    router.replace('/(tabs)/workout');
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

  const [showCoach, setShowCoach] = useState(false);
  const exerciseLibrary = useWorkoutStore((s) => s.exercises);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);

  const handleCoachReplaceExercise = useCallback(
    (exerciseInstanceIdOrName: string, newExerciseName: string) => {
      const libEntry = exerciseLibrary.find(
        (e) => e.name.toLowerCase() === newExerciseName.toLowerCase(),
      );
      if (!libEntry) return;

      // Try direct ID match first
      const directMatch = activeSession?.exercises.find((e) => e.id === exerciseInstanceIdOrName);
      if (directMatch) {
        replaceExercise(directMatch.id, libEntry);
        return;
      }

      // Fall back to matching by exercise name (for multi-adjust where AI sends exercise name)
      const nameMatch = activeSession?.exercises.find(
        (e) => e.exerciseName.toLowerCase() === exerciseInstanceIdOrName.toLowerCase() && !e.isSkipped,
      );
      if (nameMatch) {
        replaceExercise(nameMatch.id, libEntry);
      }
    },
    [exerciseLibrary, replaceExercise, activeSession],
  );

  const handleCoachAdjustSets = useCallback(
    (exerciseInstanceId: string, targetSets?: number, _reps?: string) => {
      if (!activeSession || targetSets == null) return;
      const exercise = activeSession.exercises.find((e) => e.id === exerciseInstanceId);
      if (!exercise) return;
      const currentSets = exercise.sets.length;
      if (targetSets > currentSets) {
        for (let i = 0; i < targetSets - currentSets; i++) {
          addSet(exerciseInstanceId, 'working');
        }
      } else if (targetSets < currentSets) {
        // Remove from the end (uncompleted sets first)
        const uncompleted = [...exercise.sets].reverse().filter((s) => !s.isCompleted);
        const toRemove = Math.min(currentSets - targetSets, uncompleted.length);
        for (let i = 0; i < toRemove; i++) {
          removeSet(exerciseInstanceId, uncompleted[i].id);
        }
      }
    },
    [activeSession, addSet, removeSet],
  );

  const handleAddExercise = () => {
    router.push('/workout/exercises');
  };

  const handleSwapSelect = useCallback(
    (newExercise: ExerciseLibraryEntry) => {
      if (swapModalExercise) {
        replaceExercise(swapModalExercise.id, newExercise);
      }
    },
    [swapModalExercise, replaceExercise],
  );

  const handleCreateSupersetGroup = useCallback(
    (selectedIds: string[]) => {
      createSupersetGroup(selectedIds);
    },
    [createSupersetGroup],
  );

  const handleRemoveSupersetGroup = useCallback(
    (groupId: string) => {
      removeSupersetGroup(groupId);
    },
    [removeSupersetGroup],
  );

  const handleMoveExercise = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (!activeSession) return;
      const exercises = activeSession.exercises;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= exercises.length) return;

      const newOrder = exercises.map((e) => e.id);
      // Swap
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      reorderExercises(newOrder);
      Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeSession, reorderExercises],
  );

  if (!activeSession) {
    if (showSummary && completedSession) {
      return <WorkoutSummaryModal visible={true} session={completedSession} onDone={handleSummaryDone} />;
    }
    // If we're in the process of finishing (showSummary true but no session yet), show loading
    if (showSummary) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.label, { color: colors.textSecondary, marginTop: 16 }]}>Saving workout...</Text>
          </View>
        </SafeAreaView>
      );
    }
    // Not in finish flow - navigate away
    router.replace('/(tabs)/workout');
    return null;
  }

  // Build superset group info
  const supersetGroupMap = new Map<string, string[]>();
  activeSession.exercises.forEach((e) => {
    if (e.supersetGroupId) {
      const existing = supersetGroupMap.get(e.supersetGroupId) ?? [];
      existing.push(e.id);
      supersetGroupMap.set(e.supersetGroupId, existing);
    }
  });

  const getSupersetInfo = (exercise: ActiveExercise) => {
    if (!exercise.supersetGroupId) return { size: 0, label: '' };
    const members = supersetGroupMap.get(exercise.supersetGroupId) ?? [];
    const size = members.length;
    const label = size >= 3 ? 'Tri-Set' : 'Superset';
    return { size, label };
  };

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
          {editingRest ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[
                  styles.restEditInput,
                  typography.bodySmall,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.primary,
                    borderRadius: radius.sm,
                  },
                ]}
                value={restInput}
                onChangeText={setRestInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => {
                  const val = parseInt(restInput, 10);
                  if (!isNaN(val) && val > 0) setDefaultRestSeconds(val);
                  setEditingRest(false);
                }}
                onBlur={() => {
                  const val = parseInt(restInput, 10);
                  if (!isNaN(val) && val > 0) setDefaultRestSeconds(val);
                  setEditingRest(false);
                }}
              />
              <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 2 }]}>s</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setRestInput(defaultRestSeconds.toString());
                setEditingRest(true);
              }}
            >
              <Text style={[typography.bodySmall, { color: colors.primary }]}>
                Rest: {defaultRestSeconds}s
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setIsReorderMode((prev) => !prev)}
            style={[
              styles.reorderToggle,
              {
                backgroundColor: isReorderMode ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Ionicons
              name="reorder-three"
              size={16}
              color={isReorderMode ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                typography.caption,
                {
                  color: isReorderMode ? colors.textInverse : colors.textSecondary,
                  marginLeft: 3,
                },
              ]}
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode((m) => (m === 'full' ? 'focus' : 'full'))}
            style={[
              styles.viewToggle,
              {
                backgroundColor: viewMode === 'focus' ? colors.primaryMuted : colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Ionicons
              name={viewMode === 'focus' ? 'expand-outline' : 'contract-outline'}
              size={14}
              color={viewMode === 'focus' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                typography.caption,
                {
                  color: viewMode === 'focus' ? colors.primary : colors.textSecondary,
                  marginLeft: 3,
                },
              ]}
            >
              {viewMode === 'focus' ? 'Focus' : 'Full'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Exercise list (full view) or Focused view */}
        {viewMode === 'full' ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSession.exercises.map((exercise, index) => {
            const ssInfo = getSupersetInfo(exercise);
            const visibleExercises = activeSession.exercises.filter((e) => !e.isSkipped);
            const visibleIndex = visibleExercises.indexOf(exercise);
            return (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                isCurrent={index === activeSession.currentExerciseIndex}
                isInSuperset={!!exercise.supersetGroupId}
                supersetSize={ssInfo.size}
                supersetLabel={ssInfo.label}
                onSwapPress={setSwapModalExercise}
                onSupersetPress={setSupersetSourceId}
                onRemoveSupersetPress={handleRemoveSupersetGroup}
                isReorderMode={isReorderMode}
                onMoveUp={() => handleMoveExercise(index, 'up')}
                onMoveDown={() => handleMoveExercise(index, 'down')}
                isFirst={visibleIndex === 0}
                isLast={visibleIndex === visibleExercises.length - 1}
              />
            );
          })}

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
        ) : (
          <FocusedWorkoutView
            activeSession={activeSession}
            logSet={logSet}
            completeSet={completeSet}
            startRestTimer={startRestTimer}
            setCurrentExerciseIndex={setCurrentExerciseIndex}
            goToNextExercise={goToNextExercise}
            goToPreviousExercise={goToPreviousExercise}
          />
        )}

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

        {/* Exercise Replacement Modal */}
        <ExerciseReplacementModal
          visible={swapModalExercise !== null}
          exercise={swapModalExercise}
          onClose={() => setSwapModalExercise(null)}
          onSelect={handleSwapSelect}
        />

        {/* Coach Button */}
        <TouchableOpacity
          onPress={() => setShowCoach(true)}
          style={[
            styles.coachFab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.textInverse} />
        </TouchableOpacity>

        {/* In-Workout Coach */}
        <InWorkoutCoach
          visible={showCoach}
          onClose={() => setShowCoach(false)}
          activeSession={activeSession}
          exerciseLibrary={exerciseLibrary}
          onReplaceExercise={handleCoachReplaceExercise}
          onAdjustSets={handleCoachAdjustSets}
        />

        {/* Superset Selection Modal */}
        <SupersetSelectionModal
          visible={supersetSourceId !== null}
          sourceExerciseId={supersetSourceId ?? ''}
          exercises={activeSession.exercises}
          onClose={() => setSupersetSourceId(null)}
          onConfirm={handleCreateSupersetGroup}
        />
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
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exerciseCard: {
    position: 'relative',
    padding: 16,
  },
  supersetBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supersetLabelRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  swapBtn: {
    padding: 6,
    marginLeft: 8,
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericInput: {
    borderWidth: 1,
    textAlign: 'center',
    flex: 1,
    minHeight: 44,
    marginHorizontal: 3,
    paddingHorizontal: 4,
  },
  checkBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  overflowBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  overflowMenu: {
    gap: 2,
  },
  overflowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalFooter: {
    borderTopWidth: 1,
  },
  replacementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Timed set styles
  timedSetContainer: {},
  timedSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  durationPresets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coachFab: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50,
  },
  reorderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reorderHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  reorderBtns: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  reorderArrow: {
    padding: 4,
  },
  // Rest timer custom input
  restCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restCustomInput: {
    borderWidth: 1,
    textAlign: 'center',
    width: 70,
    minHeight: 36,
    paddingHorizontal: 8,
  },
  restCustomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  // Stats bar rest edit
  restEditInput: {
    borderWidth: 1,
    textAlign: 'center',
    width: 44,
    minHeight: 28,
    paddingHorizontal: 4,
  },
  // Summary modal
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
  },
  summaryStatCard: {
    alignItems: 'center',
    padding: 16,
    minWidth: 130,
    flex: 1,
  },
  prSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionBanner: {},
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Per-exercise rest time editor
  restTimeEditor: {},
  restPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
