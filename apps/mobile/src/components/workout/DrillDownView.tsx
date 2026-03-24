import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Badge } from '../ui';
import { useWorkoutStore } from '../../stores/workout-store';
import { useProfileStore } from '../../stores/profile-store';
import { getSuggestedLoad } from '../../lib/suggested-load';
import { predictNextSet } from '../../lib/progression-calculator';
import type { SetPrediction } from '../../lib/progression-calculator';
import { mediumImpact, weightIncrement as weightIncrementHaptic, successNotification } from '../../lib/haptics';
import { useGhostSet } from '../../hooks/useGhostSet';
import type {
  ActiveWorkoutSession,
  ActiveExercise,
  ActiveSet,
} from '../../types/workout';
import { Image } from 'expo-image';
import { ExerciseIllustration } from '../ExerciseIllustration';
import { ExerciseImageViewer } from './ExerciseImageViewer';
import { getExerciseImages } from '../../lib/exercise-image-map';
import { WorkoutInputToolbar } from './WorkoutInputToolbar';
import type { InputType } from './WorkoutInputToolbar';

// ── Props ────────────────────────────────────────────────────────────

export interface DrillDownViewProps {
  activeSession: ActiveWorkoutSession;
  exercise: ActiveExercise;
  exerciseIndex: number;
  totalExercises: number;
  onBack: () => void;
  onLogSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number, isAutoFilled?: boolean) => void;
  onCompleteSet: (exerciseInstanceId: string, setId: string) => void;
  onStartRestTimer: (durationSeconds: number) => void;
  onSetCurrentExerciseIndex: (index: number) => void;
  onNextExercise: () => void;
  onFinishWorkout: () => void;
  onReplaceExercise: (exercise: ActiveExercise) => void;
  supersetInfo?: {
    groupId: string;
    position: number;
    total: number;
    nextExerciseName?: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function findNextIncompleteSetIndex(exercise: ActiveExercise): number {
  return exercise.sets.findIndex((s) => !s.isCompleted);
}

function getSupersetGroupMembers(
  session: ActiveWorkoutSession,
  groupId: string,
): ActiveExercise[] {
  return session.exercises.filter((e) => e.supersetGroupId === groupId && !e.isSkipped);
}

// ── Gold theme constants ─────────────────────────────────────────────

const GOLD_DARK = '#CFAE80';
const GOLD_LIGHT = '#B8944F';

// ── Component ────────────────────────────────────────────────────────

export function DrillDownView({
  activeSession,
  exercise,
  exerciseIndex,
  totalExercises,
  onBack,
  onLogSet,
  onCompleteSet,
  onStartRestTimer,
  onSetCurrentExerciseIndex,
  onNextExercise,
  onFinishWorkout,
  onReplaceExercise,
  supersetInfo,
}: DrillDownViewProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // ── Exercise library entry ──────────────────────────────────────────
  const allExercises = useWorkoutStore((s) => s.exercises);
  const getExerciseRestTime = useWorkoutStore((s) => s.getExerciseRestTime);
  const updateExerciseRestTime = useWorkoutStore((s) => s.updateExerciseRestTime);
  const exerciseLib = useMemo(
    () => allExercises.find((e) => e.id === exercise.exerciseId),
    [allExercises, exercise.exerciseId],
  );

  // ── Toolbar focus tracking ─────────────────────────────────────────
  const [focusedInput, setFocusedInput] = useState<InputType | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputFocus = useCallback((type: InputType) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setFocusedInput(type);
  }, []);

  const handleInputBlur = useCallback(() => {
    // Small delay to avoid flicker when switching between weight/reps inputs
    blurTimeoutRef.current = setTimeout(() => {
      setFocusedInput(null);
    }, 120);
  }, []);

  // ── Form Check mode ─────────────────────────────────────────────────
  const [formCheckMode, setFormCheckMode] = useState(false);
  const exerciseImages = useMemo(() => getExerciseImages(exercise.exerciseId), [exercise.exerciseId]);
  const hasImages = !!exerciseImages;

  // ── Suggestion engine ───────────────────────────────────────────────
  const history = useWorkoutStore((s) => s.history);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const isMetric = unitPref === 'metric';
  const unit = isMetric ? 'kg' : 'lbs';

  const suggestion = useMemo(
    () => getSuggestedLoad(exercise.exerciseId, '8-12', exercise.sets.length, history, isMetric),
    [exercise.exerciseId, exercise.sets.length, history, isMetric],
  );

  // ── Current set tracking (user-controlled index for navigation) ────
  const autoSetIndex = useMemo(() => findNextIncompleteSetIndex(exercise), [exercise]);
  const [currentSetIndex, setCurrentSetIndex] = useState<number>(
    autoSetIndex >= 0 ? autoSetIndex : exercise.sets.length - 1,
  );

  // Auto-advance to next incomplete set when exercise sets change
  useEffect(() => {
    if (autoSetIndex >= 0) {
      setCurrentSetIndex(autoSetIndex);
    }
  }, [autoSetIndex]);

  const currentSet: ActiveSet | undefined = exercise.sets[currentSetIndex];
  const completedCount = useMemo(() => exercise.sets.filter((s) => s.isCompleted).length, [exercise]);
  const totalSets = exercise.sets.length;
  const allComplete = completedCount === totalSets;
  const isLastSet = currentSetIndex === totalSets - 1;
  const isLastExercise = exerciseIndex === totalExercises - 1;

  // ── Predictive progression ─────────────────────────────────────────
  const prediction: SetPrediction | null = useMemo(
    () => predictNextSet(exercise.exerciseId, currentSetIndex, history, isMetric),
    [exercise.exerciseId, currentSetIndex, history, isMetric],
  );

  // "Applied ✓" feedback state
  const [predictionApplied, setPredictionApplied] = useState(false);
  const predictionAppliedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reanimated highlight flash for inputs on prediction apply
  const highlightOpacity = useSharedValue(0);
  const highlightAnimStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  // ── Local weight / reps state ───────────────────────────────────────
  const [localWeight, setLocalWeight] = useState('');
  const [localReps, setLocalReps] = useState('');

  // Sync local inputs when the current set changes
  useEffect(() => {
    if (currentSet) {
      setLocalWeight(currentSet.weight !== undefined ? currentSet.weight.toString() : '');
      setLocalReps(currentSet.reps !== undefined ? currentSet.reps.toString() : '');
    }
  }, [currentSet?.id, currentSet?.weight, currentSet?.reps]);

  // ── Ghost set (previous performance overlay) ──────────────────────
  const ghost = useGhostSet(exercise.exerciseId, currentSetIndex);
  const isBodyweight = exercise.isBodyweight ?? false;

  // Determine ghost comparison state: 'below' | 'matching' | 'exceeding' | 'none'
  const ghostState = useMemo(() => {
    if (!ghost) return 'none' as const;
    const w = parseFloat(localWeight) || 0;
    const ghostW = ghost.weight ?? 0;
    // For bodyweight exercises, compare reps instead
    if (isBodyweight || ghostW === 0) {
      const r = parseInt(localReps, 10) || 0;
      const ghostR = ghost.reps ?? 0;
      if (ghostR === 0) return 'none' as const;
      if (r === 0) return 'below' as const;
      if (r > ghostR) return 'exceeding' as const;
      if (r === ghostR) return 'matching' as const;
      return 'below' as const;
    }
    if (w === 0) return 'below' as const;
    if (w > ghostW) return 'exceeding' as const;
    if (w === ghostW) return 'matching' as const;
    return 'below' as const;
  }, [ghost, localWeight, localReps, isBodyweight]);

  // Animated values for ghost opacity and gold glow
  const ghostOpacity = useSharedValue(ghost ? 0.2 : 0);
  const goldGlow = useSharedValue(0); // 0 = no glow, 1 = full gold
  const ghostExceededRef = useRef(false);

  useEffect(() => {
    switch (ghostState) {
      case 'none':
        ghostOpacity.value = withTiming(0, { duration: 200 });
        goldGlow.value = withTiming(0, { duration: 200 });
        ghostExceededRef.current = false;
        break;
      case 'below':
        ghostOpacity.value = withTiming(0.2, { duration: 300 });
        goldGlow.value = withTiming(0, { duration: 200 });
        ghostExceededRef.current = false;
        break;
      case 'matching':
        ghostOpacity.value = withTiming(0.15, { duration: 300 });
        goldGlow.value = withTiming(0, { duration: 200 });
        ghostExceededRef.current = false;
        break;
      case 'exceeding':
        // Fade ghost out
        ghostOpacity.value = withTiming(0, { duration: 500 });
        // Gold glow: pulse once then settle
        goldGlow.value = withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0.7, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        );
        // Fire haptic only once per exceed
        if (!ghostExceededRef.current) {
          ghostExceededRef.current = true;
          successNotification();
        }
        break;
    }
  }, [ghostState, ghostOpacity, goldGlow]);

  // Reset ghost animation state when set changes
  useEffect(() => {
    ghostExceededRef.current = false;
    ghostOpacity.value = ghost ? 0.2 : 0;
    goldGlow.value = 0;
  }, [currentSetIndex, ghost, ghostOpacity, goldGlow]);

  const ghostTextStyle = useAnimatedStyle(() => ({
    opacity: ghostOpacity.value,
  }));

  const goldGlowOverlayStyle = useAnimatedStyle(() => ({
    opacity: goldGlow.value * 0.25,
  }));

  // ── Rest time state ─────────────────────────────────────────────────
  const restTime = useMemo(() => getExerciseRestTime(exercise.exerciseId), [exercise.exerciseId, getExerciseRestTime]);
  const [editingRest, setEditingRest] = useState(false);
  const [restInput, setRestInput] = useState('');

  const handleRestEdit = useCallback(() => {
    setRestInput(restTime.toString());
    setEditingRest(true);
  }, [restTime]);

  const handleRestSubmit = useCallback(() => {
    const val = parseInt(restInput, 10);
    if (!isNaN(val) && val > 0) {
      updateExerciseRestTime(exercise.id, val);
    }
    setEditingRest(false);
  }, [restInput, exercise.id, updateExerciseRestTime]);

  // ── Superset info ──────────────────────────────────────────────────
  const supersetGroupId = exercise.supersetGroupId;
  const supersetMembers = useMemo(
    () => (supersetGroupId ? getSupersetGroupMembers(activeSession, supersetGroupId) : []),
    [activeSession, supersetGroupId],
  );
  const isInSuperset = supersetMembers.length > 1;
  const supersetPosition = isInSuperset
    ? supersetMembers.findIndex((m) => m.id === exercise.id) + 1
    : 0;
  const supersetLabel = supersetMembers.length >= 3 ? 'Tri-Set' : 'Superset';

  // Next exercise name in superset
  const supersetNextName = useMemo(() => {
    if (!isInSuperset) return undefined;
    const currentMemberIdx = supersetMembers.findIndex((m) => m.id === exercise.id);
    const nextIdx = (currentMemberIdx + 1) % supersetMembers.length;
    return supersetMembers[nextIdx]?.exerciseName;
  }, [isInSuperset, supersetMembers, exercise.id]);

  // ── Input handlers ────────────────────────────────────────────────

  const incrementWeight = useCallback(
    (delta: number) => {
      setLocalWeight((prev) => {
        const newVal = Math.max(0, (parseFloat(prev) || 0) + delta);
        return newVal.toString();
      });
    },
    [],
  );

  const incrementReps = useCallback(
    (delta: number) => {
      setLocalReps((prev) => {
        const newVal = Math.max(0, (parseInt(prev, 10) || 0) + delta);
        return newVal.toString();
      });
    },
    [],
  );

  const handleUseSuggestion = useCallback(() => {
    if (!suggestion || !currentSet) return;
    const w = suggestion.suggestedWeight;
    const r = suggestion.suggestedReps;
    setLocalWeight(w.toString());
    setLocalReps(r.toString());
    onLogSet(exercise.id, currentSet.id, w, r);
  }, [suggestion, currentSet, exercise.id, onLogSet]);

  const handleApplyPrediction = useCallback(() => {
    if (!prediction || !currentSet) return;
    setLocalWeight(prediction.weight.toString());
    setLocalReps(prediction.reps.toString());
    onLogSet(exercise.id, currentSet.id, prediction.weight, prediction.reps);
    weightIncrementHaptic();

    // Flash highlight on inputs
    highlightOpacity.value = withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }),
    );

    // Show "Applied ✓" briefly
    setPredictionApplied(true);
    if (predictionAppliedTimeout.current) clearTimeout(predictionAppliedTimeout.current);
    predictionAppliedTimeout.current = setTimeout(() => setPredictionApplied(false), 1500);
  }, [prediction, currentSet, exercise.id, onLogSet, highlightOpacity]);

  // ── Animations ─────────────────────────────────────────────────────
  const logBtnScale = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // ── Log Set handler ────────────────────────────────────────────────
  const handleLogSet = useCallback(() => {
    if (!currentSet) return;

    const w = parseFloat(localWeight);
    const r = parseInt(localReps, 10);
    if (isNaN(w) || isNaN(r)) return;

    // Button scale animation
    Animated.sequence([
      Animated.timing(logBtnScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(logBtnScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    // Green flash
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start();

    // 1. Log weight/reps then complete the set
    onLogSet(exercise.id, currentSet.id, w, r);
    onCompleteSet(exercise.id, currentSet.id);
    mediumImpact();

    // 2. Auto-fill: if the next incomplete set has empty weight/reps, pre-populate it
    const nextIncomplete = exercise.sets.find(
      (s) => !s.isCompleted && s.id !== currentSet.id,
    );
    if (nextIncomplete && nextIncomplete.weight === undefined && nextIncomplete.reps === undefined) {
      onLogSet(exercise.id, nextIncomplete.id, w, r, true);
    }

    // 3. Determine what happens after logging
    if (isInSuperset) {
      // Superset flow: cycle to next exercise in the group
      const currentMemberIdx = supersetMembers.findIndex((m) => m.id === exercise.id);
      const nextMemberIdx = (currentMemberIdx + 1) % supersetMembers.length;
      const nextMember = supersetMembers[nextMemberIdx];

      // Check if we just completed a full round (cycled back to first member)
      if (nextMemberIdx === 0) {
        onStartRestTimer(restTime);
      }

      // Navigate to the next superset member
      const globalIdx = activeSession.exercises.findIndex((e) => e.id === nextMember.id);
      if (globalIdx !== -1 && globalIdx !== exerciseIndex) {
        onSetCurrentExerciseIndex(globalIdx);
      }
    } else {
      // Not in a superset - start rest timer
      onStartRestTimer(restTime);

      // If this was the last set and last exercise, finish workout
      if (isLastSet && isLastExercise && !nextIncomplete) {
        // Don't auto-finish, let user tap the CTA
      }
    }
  }, [
    currentSet,
    localWeight,
    localReps,
    exercise,
    onLogSet,
    onCompleteSet,
    onStartRestTimer,
    restTime,
    isInSuperset,
    supersetMembers,
    activeSession.exercises,
    exerciseIndex,
    onSetCurrentExerciseIndex,
    isLastSet,
    isLastExercise,
  ]);

  // ── CTA button logic ───────────────────────────────────────────────

  const ctaLabel = useMemo(() => {
    if (allComplete) {
      if (isLastExercise) return 'FINISH WORKOUT';
      return 'NEXT EXERCISE';
    }
    if (isLastSet && isLastExercise) return 'LOG SET & FINISH';
    if (isLastSet && !isLastExercise) return 'LOG SET & NEXT EXERCISE';
    return 'LOG SET';
  }, [allComplete, isLastSet, isLastExercise]);

  const handleCTAPress = useCallback(() => {
    if (allComplete) {
      if (isLastExercise) {
        onFinishWorkout();
      } else {
        onNextExercise();
      }
      return;
    }
    // Log the set first
    handleLogSet();

    // If it was the last set, auto-advance after logging
    if (isLastSet && !isLastExercise && !isInSuperset) {
      // Small delay so the user sees the flash, then advance
      setTimeout(() => {
        onNextExercise();
      }, 300);
    }
  }, [allComplete, isLastExercise, isLastSet, isInSuperset, onFinishWorkout, onNextExercise, handleLogSet]);

  // ── Set type label ────────────────────────────────────────────────
  const setTypeLabel = currentSet
    ? currentSet.setType === 'warmup'
      ? 'Warm-up'
      : currentSet.setType === 'drop'
        ? 'Drop Set'
        : currentSet.setType === 'failure'
          ? 'Failure'
          : 'Working'
    : '';

  // ── Set navigation ────────────────────────────────────────────────

  const canGoPrevSet = currentSetIndex > 0;
  const canGoNextSet = currentSetIndex < totalSets - 1;

  const goToPrevSet = useCallback(() => {
    if (canGoPrevSet) {
      setCurrentSetIndex((prev) => prev - 1);
    }
  }, [canGoPrevSet]);

  const goToNextSet = useCallback(() => {
    if (canGoNextSet) {
      setCurrentSetIndex((prev) => prev + 1);
    }
  }, [canGoNextSet]);

  const handleDotPress = useCallback((index: number) => {
    setCurrentSetIndex(index);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Back Navigation Bar ─────────────────────────────────────── */}
      <View style={[styles.backBar, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary, marginLeft: 2 }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
          {exerciseIndex + 1} of {totalExercises}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Superset Label ──────────────────────────────────────── */}
        {isInSuperset && (
          <View style={[styles.supersetBanner, { backgroundColor: colors.primaryMuted, marginHorizontal: spacing.base, borderRadius: radius.lg, padding: spacing.sm }]}>
            <Badge label={supersetLabel} variant="info" />
            <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}>
              {supersetPosition} of {supersetMembers.length}
              {supersetNextName ? ` → Next: ${supersetNextName}` : ''}
            </Text>
          </View>
        )}

        {/* ── Exercise Image ──────────────────────────────────────── */}
        {formCheckMode && exerciseImages ? (
          <View style={{ paddingHorizontal: spacing.base }}>
            <View style={{ flexDirection: 'row', height: 200, borderRadius: radius.lg, overflow: 'hidden' }}>
              <View style={{ flex: 1, position: 'relative', backgroundColor: colors.surface }}>
                <Image source={{ uri: exerciseImages.startPosition }} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" />
                <View style={styles.formCheckLabel}>
                  <Text style={styles.formCheckLabelText}>Start</Text>
                </View>
              </View>
              <View style={{ width: 2, backgroundColor: colors.background }} />
              <View style={{ flex: 1, position: 'relative', backgroundColor: colors.surface }}>
                <Image source={{ uri: exerciseImages.endPosition }} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" />
                <View style={styles.formCheckLabel}>
                  <Text style={styles.formCheckLabelText}>End</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <ExerciseImageViewer
            exerciseId={exercise.exerciseId}
            size="focused"
            isResting={!!activeSession.restTimerEndAt && new Date(activeSession.restTimerEndAt) > new Date()}
            style={{ width: '100%' }}
          />
        )}

        {/* ── Form Check toggle ──────────────────────────────────── */}
        {hasImages && (
          <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setFormCheckMode((prev) => !prev)}
              activeOpacity={0.7}
              style={[
                styles.formCheckToggle,
                {
                  backgroundColor: formCheckMode ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              <Ionicons
                name="images-outline"
                size={14}
                color={formCheckMode ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  typography.labelSmall,
                  {
                    color: formCheckMode ? colors.textInverse : colors.textSecondary,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                Form Check
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Exercise Header ─────────────────────────────────────── */}
        <View style={[styles.headerSection, { paddingHorizontal: spacing.base }]}>
          {exerciseLib && (
            <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
              <ExerciseIllustration
                exerciseId={exercise.exerciseId}
                category={exerciseLib.category}
                equipment={exerciseLib.equipment}
                primaryMuscles={exerciseLib.primaryMuscles}
                size="medium"
              />
            </View>
          )}

          <Text
            style={[typography.displayMedium, { color: colors.text, textAlign: 'center' }]}
            numberOfLines={2}
          >
            {exercise.exerciseName}
          </Text>

          {/* ── Action Bar ──────────────────────────────────────── */}
          <View style={[styles.actionBar, { marginTop: spacing.sm, gap: spacing.md }]}>
            {/* Rest Time Badge */}
            {editingRest ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.restEditInput,
                    typography.labelSmall,
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
                  onSubmitEditing={handleRestSubmit}
                  onBlur={handleRestSubmit}
                />
                <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 2 }]}>s</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleRestEdit}
                style={[styles.actionChip, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full }]}
                activeOpacity={0.7}
              >
                <Ionicons name="timer-outline" size={14} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                  {restTime}s
                </Text>
              </TouchableOpacity>
            )}

            {/* Replace button */}
            <TouchableOpacity
              onPress={() => onReplaceExercise(exercise)}
              style={[styles.actionChip, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full }]}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={colors.textSecondary} />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                Replace
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Tappable Set Progress Dots ─────────────────────── */}
          <View style={[styles.progressRow, { marginTop: spacing.md }]}>
            {exercise.sets.map((s, i) => {
              const isCurrent = i === currentSetIndex;
              const isCompleted = s.isCompleted;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => handleDotPress(i)}
                  activeOpacity={0.6}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: isCompleted
                        ? colors.success
                        : isCurrent
                          ? 'transparent'
                          : colors.surfaceSecondary,
                      borderColor: isCurrent ? GOLD_DARK : 'transparent',
                      borderWidth: isCurrent ? 2.5 : 0,
                      width: isCurrent ? 32 : 28,
                      height: isCurrent ? 32 : 28,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: isCompleted
                          ? colors.textInverse
                          : isCurrent
                            ? GOLD_DARK
                            : colors.textTertiary,
                        fontWeight: isCurrent ? '700' : '500',
                      },
                    ]}
                  >
                    {isCompleted ? '✓' : s.setNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[typography.label, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            {allComplete
              ? 'All sets complete!'
              : `Set ${currentSetIndex + 1} of ${totalSets} · ${setTypeLabel}`}
          </Text>
        </View>

        {/* ── Input Section ───────────────────────────────────────── */}
        {currentSet ? (
          <View style={[styles.inputSection, { paddingHorizontal: spacing.base }]}>
            {/* Green flash overlay */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.success,
                  opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                },
              ]}
            />
            {/* Prediction-apply highlight flash */}
            <Reanimated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#4CAF50' },
                highlightAnimStyle,
              ]}
            />

            {/* Prediction / Suggestion banner */}
            {!currentSet.isCompleted && (prediction || suggestion) && (
              <View style={[styles.suggestionCard, {
                backgroundColor: prediction
                  ? prediction.confidence === 'high' ? colors.successLight : prediction.confidence === 'medium' ? colors.warningLight ?? colors.primaryMuted : colors.primaryMuted
                  : suggestion?.confidence === 'high' ? colors.successLight : colors.primaryMuted,
                borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
              }]}>
                {prediction ? (
                  /* ── Predictive suggestion ── */
                  <>
                    <View style={styles.predictionHeader}>
                      <View style={[
                        styles.confidenceDot,
                        { backgroundColor: prediction.confidence === 'high' ? '#4CAF50' : prediction.confidence === 'medium' ? '#FFC107' : '#9E9E9E' },
                      ]} />
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 6, flex: 1 }]}>
                        {prediction.reasoning}
                      </Text>
                    </View>
                    {predictionApplied ? (
                      <Text style={[typography.h2, { color: colors.success, textAlign: 'center', marginTop: spacing.xs }]}>
                        Applied ✓
                      </Text>
                    ) : (
                      <>
                        <Text style={[typography.h2, {
                          color: prediction.confidence === 'high' ? '#4CAF50' : prediction.confidence === 'medium' ? '#FFC107' : colors.textSecondary,
                          textAlign: 'center',
                          marginTop: spacing.xs,
                        }]}>
                          {prediction.weight > 0
                            ? `${prediction.weight} ${unit} × ${prediction.reps}`
                            : `${prediction.reps} reps`}
                        </Text>
                        {prediction.delta !== 0 && (
                          <Text style={[typography.labelSmall, { color: '#4CAF50', textAlign: 'center', marginTop: 2 }]}>
                            ↑{prediction.delta} from last
                          </Text>
                        )}
                        <TouchableOpacity
                          onPress={handleApplyPrediction}
                          style={[styles.useSuggestionBtn, {
                            backgroundColor: prediction.confidence === 'high' ? '#4CAF50' : prediction.confidence === 'medium' ? '#FFC107' : colors.primary,
                            borderRadius: radius.md, marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
                          }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="flash" size={16} color={prediction.confidence === 'medium' ? '#000' : colors.textInverse} />
                          <Text style={[typography.labelSmall, {
                            color: prediction.confidence === 'medium' ? '#000' : colors.textInverse,
                            marginLeft: spacing.xs,
                          }]}>Use Prediction</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                ) : suggestion ? (
                  /* ── Fallback: existing suggestion engine ── */
                  <>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      Based on your last workout, try:
                    </Text>
                    <Text style={[typography.h2, { color: suggestion.confidence === 'high' ? colors.success : colors.primary, textAlign: 'center' }]}>
                      {suggestion.suggestedWeight} {unit} × {suggestion.suggestedReps} reps
                    </Text>
                    <TouchableOpacity
                      onPress={handleUseSuggestion}
                      style={[styles.useSuggestionBtn, { backgroundColor: suggestion.confidence === 'high' ? colors.success : colors.primary, borderRadius: radius.md, marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.base }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={16} color={colors.textInverse} />
                      <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: spacing.xs }]}>Use Suggestion</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {/* Ghost overlay — previous session hint */}
            {ghost && !currentSet.isCompleted && (
              <Reanimated.View pointerEvents="none" style={[styles.ghostRow, ghostTextStyle]}>
                <Text style={[styles.ghostLabel, { color: colors.textTertiary }]}>Last time</Text>
                <Text style={[styles.ghostNumbers, { color: colors.textTertiary }]}>
                  {ghost.weight != null && ghost.weight > 0
                    ? `${ghost.weight} ${unit} × ${ghost.reps ?? '?'}`
                    : `${ghost.reps ?? '?'} reps`}
                </Text>
                {ghostState === 'matching' && (
                  <Text style={[styles.ghostIndicator, { color: colors.textTertiary }]}>=</Text>
                )}
                {ghostState === 'exceeding' && (
                  <Reanimated.Text style={[styles.ghostIndicator, { color: GOLD_DARK }]}>↑</Reanimated.Text>
                )}
              </Reanimated.View>
            )}

            {/* Weight - Scoreboard style */}
            <View style={styles.inputBlock}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center', letterSpacing: 2 }]}>
                WEIGHT ({unit})
              </Text>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  onPress={() => incrementWeight(-5)}
                  style={[
                    styles.bigIncBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
                  ]}
                >
                  <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>−</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 14 }}>
                  <TextInput
                    style={[
                      styles.bigInput,
                      {
                        color: ghostState === 'exceeding' ? GOLD_DARK : colors.text,
                        backgroundColor: colors.surface,
                        borderColor: ghostState === 'exceeding' ? GOLD_DARK : colors.border,
                        borderRadius: radius.lg,
                        fontSize: 48,
                        fontWeight: '700',
                        letterSpacing: -1,
                        marginHorizontal: 0,
                      },
                    ]}
                    value={localWeight}
                    onChangeText={setLocalWeight}
                    onFocus={() => handleInputFocus('weight')}
                    onBlur={handleInputBlur}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    selectTextOnFocus
                  />
                  {/* Gold glow shadow overlay */}
                  {ghostState === 'exceeding' && (
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        styles.goldGlowOverlay,
                        { borderRadius: radius.lg, borderColor: GOLD_DARK },
                        goldGlowOverlayStyle,
                      ]}
                    />
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => incrementWeight(5)}
                  style={[
                    styles.bigIncBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
                  ]}
                >
                  <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reps - Scoreboard style */}
            <View style={[styles.inputBlock, { marginTop: spacing.xl }]}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center', letterSpacing: 2 }]}>
                REPS
              </Text>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  onPress={() => incrementReps(-1)}
                  style={[
                    styles.bigIncBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
                  ]}
                >
                  <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>−</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 14 }}>
                  <TextInput
                    style={[
                      styles.bigInput,
                      {
                        color: ghostState === 'exceeding' ? GOLD_DARK : colors.text,
                        backgroundColor: colors.surface,
                        borderColor: ghostState === 'exceeding' ? GOLD_DARK : colors.border,
                        borderRadius: radius.lg,
                        fontSize: 48,
                        fontWeight: '700',
                        letterSpacing: -1,
                        marginHorizontal: 0,
                      },
                    ]}
                    value={localReps}
                    onChangeText={setLocalReps}
                    onFocus={() => handleInputFocus('reps')}
                    onBlur={handleInputBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    selectTextOnFocus
                  />
                  {/* Gold glow shadow overlay */}
                  {ghostState === 'exceeding' && (
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        styles.goldGlowOverlay,
                        { borderRadius: radius.lg, borderColor: GOLD_DARK },
                        goldGlowOverlayStyle,
                      ]}
                    />
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => incrementReps(1)}
                  style={[
                    styles.bigIncBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
                  ]}
                >
                  <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Completed sets summary chips */}
            {completedCount > 0 && (
              <View style={[styles.completedSummary, { marginTop: spacing.lg }]}>
                {exercise.sets
                  .filter((s) => s.isCompleted)
                  .map((s) => (
                    <View
                      key={s.id}
                      style={[
                        styles.completedSetChip,
                        {
                          backgroundColor: s.isPR ? colors.warningLight : colors.successLight,
                          borderRadius: radius.sm,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xs,
                        },
                      ]}
                    >
                      <Text style={[typography.labelSmall, { color: s.isPR ? colors.warning : colors.success }]}>
                        {s.weight ?? 0} × {s.reps ?? 0}
                        {s.isPR ? ' 🏆' : ''}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        ) : (
          /* All sets done */
          <View style={[styles.allDoneSection, { paddingHorizontal: spacing.xl }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={[typography.h2, { color: colors.success, marginTop: spacing.md }]}>
              All Sets Complete!
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
              {isLastExercise ? 'Ready to finish your workout!' : 'Move to the next exercise.'}
            </Text>

            {/* Completed sets summary */}
            <View style={[styles.completedSummary, { marginTop: spacing.lg }]}>
              {exercise.sets
                .filter((s) => s.isCompleted)
                .map((s) => (
                  <View
                    key={s.id}
                    style={[
                      styles.completedSetChip,
                      {
                        backgroundColor: s.isPR ? colors.warningLight : colors.successLight,
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      },
                    ]}
                  >
                    <Text style={[typography.labelSmall, { color: s.isPR ? colors.warning : colors.success }]}>
                      Set {s.setNumber}: {s.weight ?? 0} × {s.reps ?? 0}
                      {s.isPR ? ' 🏆' : ''}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Section (fixed) ────────────────────────────────── */}
      <View style={[styles.bottomSection, { backgroundColor: colors.surface, borderTopColor: colors.borderLight, paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.lg }]}>
        {/* Contextual input toolbar */}
        {focusedInput && (
          <WorkoutInputToolbar
            inputType={focusedInput}
            currentValue={
              focusedInput === 'weight'
                ? parseFloat(localWeight) || 0
                : parseInt(localReps, 10) || 0
            }
            lastSessionValue={ghost?.weight}
            unitLabel={unit}
            onSetValue={(val) => {
              if (focusedInput === 'weight') {
                setLocalWeight(val.toString());
                const r = parseInt(localReps, 10);
                if (!isNaN(r) && currentSet) {
                  onLogSet(exercise.id, currentSet.id, val, r);
                }
              } else {
                setLocalReps(val.toString());
                const w = parseFloat(localWeight);
                if (!isNaN(w) && currentSet) {
                  onLogSet(exercise.id, currentSet.id, w, val);
                }
              }
            }}
            visible
          />
        )}

        {/* Prominent CTA Button */}
        <Animated.View style={{ transform: [{ scale: logBtnScale }] }}>
          <TouchableOpacity
            onPress={handleCTAPress}
            style={[
              styles.ctaButton,
              {
                backgroundColor: GOLD_DARK,
                borderRadius: radius.xl,
                height: 56,
                shadowColor: GOLD_DARK,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={allComplete ? (isLastExercise ? 'flag' : 'arrow-forward-circle') : 'checkmark-circle'}
              size={28}
              color="#FFFFFF"
            />
            <Text style={[styles.ctaText, { marginLeft: spacing.sm }]}>
              {ctaLabel}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Prev Set / Next Set Navigation */}
        <View style={[styles.setNavRow, { marginTop: spacing.sm }]}>
          <TouchableOpacity
            onPress={goToPrevSet}
            disabled={!canGoPrevSet}
            style={styles.setNavButton}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-back"
              size={16}
              color={canGoPrevSet ? colors.primary : colors.textTertiary}
            />
            <Text
              style={[
                typography.labelSmall,
                { color: canGoPrevSet ? colors.primary : colors.textTertiary, marginLeft: 2 },
              ]}
            >
              Prev Set
            </Text>
          </TouchableOpacity>

          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            Set {currentSetIndex + 1}/{totalSets}
          </Text>

          <TouchableOpacity
            onPress={goToNextSet}
            disabled={!canGoNextSet}
            style={styles.setNavButton}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Text
              style={[
                typography.labelSmall,
                { color: canGoNextSet ? colors.primary : colors.textTertiary, marginRight: 2 },
              ]}
            >
              Next Set
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={canGoNextSet ? colors.primary : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  supersetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  progressDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    paddingTop: 8,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ghostLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  ghostNumbers: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ghostIndicator: {
    fontSize: 13,
    fontWeight: '700',
  },
  goldGlowOverlay: {
    borderWidth: 2,
    shadowColor: '#CFAE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  inputBlock: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIncBtn: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigInput: {
    flex: 1,
    textAlign: 'center',
    borderWidth: 2,
    minHeight: 80,
    marginHorizontal: 14,
    paddingHorizontal: 8,
  },
  completedSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  completedSetChip: {},
  suggestionCard: {
    alignItems: 'center',
  },
  useSuggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allDoneSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  bottomSection: {
    borderTopWidth: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  restEditInput: {
    borderWidth: 1,
    textAlign: 'center',
    width: 44,
    minHeight: 28,
    paddingHorizontal: 4,
  },
  formCheckToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formCheckLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  formCheckLabelText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
