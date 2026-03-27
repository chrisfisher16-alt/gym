import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
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
import { ExerciseImageViewer } from './ExerciseImageViewer';
import { getExerciseImages } from '../../lib/exercise-image-map';
import { WorkoutInputToolbar } from './WorkoutInputToolbar';
import type { InputType } from './WorkoutInputToolbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Props ────────────────────────────────────────────────────────────

export interface DrillDownViewProps {
  activeSession: ActiveWorkoutSession;
  exercise: ActiveExercise;
  exerciseIndex: number;
  totalExercises: number;
  onBack: () => void;
  onLogSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number, isAutoFilled?: boolean) => void;
  onCompleteSet: (exerciseInstanceId: string, setId: string) => void;
  onStartRestTimer: (durationSeconds: number, exerciseId?: string) => void;
  onSetCurrentExerciseIndex: (index: number) => void;
  onNextExercise: () => void;
  onFinishWorkout: () => void;
  onCascadeWeight?: (exerciseInstanceId: string, fromSetIndex: number, weight: number, reps: number) => void;
  onReplaceExercise: (exercise: ActiveExercise) => void;
  onCreateSuperset?: (exerciseId: string) => void;
  onRemoveSuperset?: (exerciseId: string) => void;
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
  onCascadeWeight,
  onReplaceExercise,
  onCreateSuperset,
  onRemoveSuperset,
  supersetInfo,
}: DrillDownViewProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const getExerciseRestTime = useWorkoutStore((s) => s.getExerciseRestTime);
  const updateExerciseRestTime = useWorkoutStore((s) => s.updateExerciseRestTime);
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

  // ── Superset hint (one-time) ──────────────────────────────────────
  const [showSupersetHint, setShowSupersetHint] = useState(false);
  useEffect(() => {
    const HINT_KEY = '@workout/superset_hint_seen';
    AsyncStorage.getItem(HINT_KEY).then((val) => {
      if (!val) setShowSupersetHint(true);
    }).catch(() => {});
  }, []);

  const dismissSupersetHint = useCallback(() => {
    setShowSupersetHint(false);
    AsyncStorage.setItem('@workout/superset_hint_seen', '1').catch(() => {});
  }, []);

  // Auto-dismiss hint once user is in a superset
  useEffect(() => {
    if (supersetInfo && showSupersetHint) dismissSupersetHint();
  }, [supersetInfo, showSupersetHint, dismissSupersetHint]);

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
  const loggingResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup all timeout refs on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (predictionAppliedTimeout.current) clearTimeout(predictionAppliedTimeout.current);
      if (loggingResetTimeout.current) clearTimeout(loggingResetTimeout.current);
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
  }, []);

  // Reanimated highlight flash for inputs on prediction apply
  const highlightOpacity = useSharedValue(0);
  const highlightAnimStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  // ── Local weight / reps state ───────────────────────────────────────
  const [localWeight, setLocalWeight] = useState('');
  const [localReps, setLocalReps] = useState('');

  const isTimeBased = exercise.isTimeBased ?? false;

  // For time-based exercises, use logTimedSet from store directly
  const logTimedSet = useWorkoutStore((s) => s.logTimedSet);

  // Sync local inputs when the current set changes
  useEffect(() => {
    if (currentSet) {
      if (isTimeBased) {
        setLocalReps(currentSet.durationSeconds ? Math.round(currentSet.durationSeconds / 60).toString() : '');
        setLocalWeight('');
      } else {
        setLocalWeight(currentSet.weight !== undefined ? currentSet.weight.toString() : '');
        setLocalReps(currentSet.reps !== undefined ? currentSet.reps.toString() : '');
      }
    }
  }, [currentSet?.id, currentSet?.weight, currentSet?.reps, currentSet?.durationSeconds, isTimeBased]);

  // ── Ghost set (previous performance overlay) ──────────────────────
  const ghost = useGhostSet(exercise.exerciseId, currentSetIndex);
  const isBodyweight = exercise.isBodyweight ?? false;

  // Determine ghost comparison state: 'below' | 'matching' | 'exceeding' | 'none'
  const ghostState = useMemo(() => {
    if (!ghost) return 'none' as const;
    if (isTimeBased) {
      // For time-based exercises, compare duration
      const d = parseInt(localReps, 10) || 0; // localReps stores minutes for time-based
      const ghostD = ghost.durationSeconds ? Math.round(ghost.durationSeconds / 60) : 0;
      if (ghostD === 0) return 'none' as const;
      if (d === 0) return 'below' as const;
      if (d > ghostD) return 'exceeding' as const;
      if (d === ghostD) return 'matching' as const;
      return 'below' as const;
    }
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
  }, [ghost, localWeight, localReps, isBodyweight, isTimeBased]);

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

  const weightStep = isMetric ? 2.5 : 5;

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
  const logBtnScale = useSharedValue(1);
  const flashAnim = useSharedValue(0);

  const logBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logBtnScale.value }],
  }));

  const flashAnimStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value * 0.15,
  }));
  const isLoggingRef = useRef(false);

  // ── Log Set handler ────────────────────────────────────────────────
  const handleLogSet = useCallback(() => {
    if (isLoggingRef.current) return;
    isLoggingRef.current = true;
    if (!currentSet) { isLoggingRef.current = false; return; }

    // Button scale animation
    logBtnScale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 180 }),
    );

    // Green flash
    flashAnim.value = 1;
    flashAnim.value = withTiming(0, { duration: 500 });

    const nextIncomplete = exercise.sets.find(
      (s) => !s.isCompleted && s.id !== currentSet.id,
    );

    if (isTimeBased) {
      // Time-based exercise: convert minutes → seconds and use logTimedSet
      const minutes = parseInt(localReps, 10);
      if (isNaN(minutes)) { isLoggingRef.current = false; return; }
      const durationSeconds = minutes * 60;
      logTimedSet(exercise.id, currentSet.id, durationSeconds);
      mediumImpact();
    } else {
      const w = parseFloat(localWeight);
      const r = parseInt(localReps, 10);
      if (isNaN(w) || isNaN(r)) { isLoggingRef.current = false; return; }

      // 1. Log weight/reps then complete the set
      onLogSet(exercise.id, currentSet.id, w, r);
      onCompleteSet(exercise.id, currentSet.id);
      onCascadeWeight?.(exercise.id, currentSetIndex, w, r);
      mediumImpact();

      // 2. Auto-fill: if the next incomplete set has empty weight/reps, pre-populate it
      if (nextIncomplete && nextIncomplete.weight === undefined && nextIncomplete.reps === undefined) {
        onLogSet(exercise.id, nextIncomplete.id, w, r, true);
      }
    }

    // 3. Determine what happens after logging
    if (isInSuperset) {
      // Superset flow: cycle to next exercise in the group
      const currentMemberIdx = supersetMembers.findIndex((m) => m.id === exercise.id);
      const nextMemberIdx = (currentMemberIdx + 1) % supersetMembers.length;
      const nextMember = supersetMembers[nextMemberIdx];

      // Check if we just completed a full round (cycled back to first member)
      if (nextMemberIdx === 0 && exercise.restTimerMode !== 'off' && exercise.restTimerMode !== 'disabled') {
        onStartRestTimer(restTime, exercise.exerciseId);
      }

      // Navigate to the next superset member
      const globalIdx = activeSession.exercises.findIndex((e) => e.id === nextMember.id);
      if (globalIdx !== -1 && globalIdx !== exerciseIndex) {
        onSetCurrentExerciseIndex(globalIdx);
      }
    } else {
      // Not in a superset - start rest timer
      if (exercise.restTimerMode !== 'off' && exercise.restTimerMode !== 'disabled') {
        onStartRestTimer(restTime, exercise.exerciseId);
      }

      // If this was the last set and last exercise, finish workout
      if (isLastSet && isLastExercise && !nextIncomplete) {
        // Don't auto-finish, let user tap the CTA
      }
    }
    if (loggingResetTimeout.current) clearTimeout(loggingResetTimeout.current);
    loggingResetTimeout.current = setTimeout(() => { isLoggingRef.current = false; }, 300);
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
    onCascadeWeight,
    currentSetIndex,
    isTimeBased,
    logTimedSet,
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
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
      autoAdvanceTimeout.current = setTimeout(() => {
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            <View style={{ flexDirection: 'row', height: 140, borderRadius: radius.lg, overflow: 'hidden' }}>
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

        {/* ── Action Bar (Rest Timer, Replace, Form Check) ──── */}
        <View style={[styles.actionBar, { marginTop: spacing.xs, gap: 6, paddingHorizontal: spacing.sm, flexWrap: 'wrap' }]}>
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

          {/* Form Check toggle */}
          {hasImages && (
            <TouchableOpacity
              onPress={() => setFormCheckMode((prev) => !prev)}
              activeOpacity={0.7}
              style={[
                styles.actionChip,
                {
                  backgroundColor: formCheckMode ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
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
                    marginLeft: 4,
                  },
                ]}
              >
                Form Check
              </Text>
            </TouchableOpacity>
          )}

          {/* Superset chip */}
          <TouchableOpacity
            onPress={() => {
              if (supersetInfo) {
                onRemoveSuperset?.(exercise.id);
              } else {
                onCreateSuperset?.(exercise.id);
              }
            }}
            activeOpacity={0.7}
            style={[
              styles.actionChip,
              {
                backgroundColor: supersetInfo ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.full,
              },
            ]}
          >
            <Ionicons
              name="link-outline"
              size={14}
              color={supersetInfo ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: supersetInfo ? colors.textInverse : colors.textSecondary,
                  marginLeft: 4,
                },
              ]}
            >
              {supersetInfo ? `Superset ${supersetInfo.position}/${supersetInfo.total}` : 'Superset'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Superset hint (first time only) ───────────────────── */}
        {showSupersetHint && !supersetInfo && (
          <TouchableOpacity
            onPress={dismissSupersetHint}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: spacing.xs,
              paddingVertical: 4,
              paddingHorizontal: spacing.md,
              gap: 6,
            }}
          >
            <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              Tap "Superset" above to pair exercises together
            </Text>
            <Ionicons name="close" size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* ── Exercise Header ─────────────────────────────────────── */}
        <View style={[styles.headerSection, { paddingHorizontal: spacing.base }]}>
          <Text
            style={[typography.h2, { color: colors.text, textAlign: 'left', alignSelf: 'flex-start' }]}
            numberOfLines={2}
          >
            {exercise.exerciseName}
          </Text>
        </View>

        {/* ── Compact Set Rows (Fitbod-style) ──────────────────── */}
        {currentSet ? (
          <View style={[styles.inputSection, { paddingHorizontal: spacing.base }]}>
            {/* Green flash overlay */}
            <Reanimated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.success },
                flashAnimStyle,
              ]}
            />

            {/* Column headers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 36 }}>
              <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
                {isTimeBased ? 'Duration' : 'Reps'}
              </Text>
              {!isTimeBased && (
                <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
                  {isBodyweight ? 'Added Weight' : `Weight (${unit})`}
                </Text>
              )}
            </View>

            {/* Set rows */}
            {exercise.sets.map((s, i) => {
              const isCurrent = i === currentSetIndex;
              const isCompleted = s.isCompleted;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => handleDotPress(i)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 4,
                    borderRadius: radius.md,
                    backgroundColor: isCurrent ? colors.surfaceSecondary : 'transparent',
                    borderWidth: isCurrent ? 1.5 : 0,
                    borderColor: isCurrent ? GOLD_DARK : 'transparent',
                  }}
                >
                  {/* Set number circle */}
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCompleted ? colors.success : isCurrent ? GOLD_DARK : colors.surfaceSecondary,
                    marginRight: 8,
                  }}>
                    <Text style={[typography.labelSmall, {
                      color: isCompleted || isCurrent ? '#FFFFFF' : colors.textTertiary,
                      fontWeight: '700',
                    }]}>
                      {isCompleted ? '✓' : s.setNumber}
                    </Text>
                  </View>

                  {/* Reps / Duration input */}
                  <View style={{ flex: 1, marginRight: isTimeBased ? 0 : 8 }}>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: isCurrent ? (ghostState === 'exceeding' ? GOLD_DARK : colors.border) : colors.borderLight ?? colors.border,
                        borderRadius: radius.md,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        fontSize: 18,
                        fontWeight: '600',
                        color: isCurrent && ghostState === 'exceeding' ? GOLD_DARK : colors.text,
                        backgroundColor: isCurrent ? colors.surface : 'transparent',
                        textAlign: 'center',
                        fontVariant: ['tabular-nums'] as any,
                      }}
                      value={isTimeBased
                        ? (isCurrent ? localReps : (s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}` : ''))
                        : (isCurrent ? localReps : (s.reps?.toString() ?? ''))}
                      onChangeText={isCurrent ? setLocalReps : undefined}
                      onFocus={() => { handleDotPress(i); handleInputFocus('reps'); }}
                      onBlur={handleInputBlur}
                      keyboardType="number-pad"
                      placeholder={isTimeBased ? 'min' : '0'}
                      placeholderTextColor={colors.textTertiary}
                      selectTextOnFocus
                      editable={isCurrent && !isCompleted}
                    />
                  </View>

                  {/* Weight input (hidden for time-based exercises) */}
                  {!isTimeBased && (
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={{
                          borderWidth: 1,
                          borderColor: isCurrent ? (ghostState === 'exceeding' ? GOLD_DARK : colors.border) : colors.borderLight ?? colors.border,
                          borderRadius: radius.md,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          fontSize: 18,
                          fontWeight: '600',
                          color: isCurrent && ghostState === 'exceeding' ? GOLD_DARK : colors.text,
                          backgroundColor: isCurrent ? colors.surface : 'transparent',
                          textAlign: 'center',
                          fontVariant: ['tabular-nums'] as any,
                        }}
                        value={isCurrent ? localWeight : (s.weight?.toString() ?? '')}
                        onChangeText={isCurrent ? setLocalWeight : undefined}
                        onFocus={() => { handleDotPress(i); handleInputFocus('weight'); }}
                        onBlur={handleInputBlur}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        selectTextOnFocus
                        editable={isCurrent && !isCompleted}
                      />
                    </View>
                  )}

                  {/* PR badge */}
                  {isCompleted && s.isPR && (
                    <Text style={{ marginLeft: 4, fontSize: 14 }}>🏆</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Ghost overlay — previous session hint */}
            {ghost && currentSet && !currentSet.isCompleted && (
              <Reanimated.View pointerEvents="none" style={[styles.ghostRow, ghostTextStyle, { marginTop: 4 }]}>
                <Text style={[styles.ghostLabel, { color: colors.textTertiary }]}>Last time</Text>
                <Text style={[styles.ghostNumbers, { color: colors.textTertiary }]}>
                  {isTimeBased
                    ? `${ghost.durationSeconds ? Math.round(ghost.durationSeconds / 60) : '?'} min`
                    : ghost.weight != null && ghost.weight > 0
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
                      Set {s.setNumber}: {isTimeBased
                        ? `${s.durationSeconds ? Math.round(s.durationSeconds / 60) : 0} min`
                        : `${s.weight ?? 0} × ${s.reps ?? 0}`}
                      {s.isPR ? ' 🏆' : ''}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Section (fixed) ────────────────────────────────── */}
      <View style={[styles.bottomSection, { backgroundColor: colors.surface, borderTopColor: colors.borderLight, paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.xs) }]}>
        {/* Contextual input toolbar (hidden for time-based weight input) */}
        {focusedInput && !(isTimeBased && focusedInput === 'weight') && (
          <WorkoutInputToolbar
            inputType={focusedInput}
            currentValue={
              focusedInput === 'weight'
                ? parseFloat(localWeight) || 0
                : parseInt(localReps, 10) || 0
            }
            lastSessionValue={isTimeBased ? undefined : ghost?.weight}
            unitLabel={isTimeBased && focusedInput === 'reps' ? 'min' : unit}
            onSetValue={(val) => {
              if (focusedInput === 'weight') {
                setLocalWeight(val.toString());
                const r = parseInt(localReps, 10);
                if (!isNaN(r) && currentSet) {
                  onLogSet(exercise.id, currentSet.id, val, r);
                }
              } else {
                setLocalReps(val.toString());
                if (!isTimeBased) {
                  const w = parseFloat(localWeight);
                  if (!isNaN(w) && currentSet) {
                    onLogSet(exercise.id, currentSet.id, w, val);
                  }
                }
              }
            }}
            visible
          />
        )}

        {/* Prominent CTA Button */}
        <Reanimated.View style={logBtnAnimStyle}>
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
        </Reanimated.View>


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
    paddingBottom: 120,
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
    paddingHorizontal: 8,
    paddingVertical: 5,
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
  formCheckLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
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
