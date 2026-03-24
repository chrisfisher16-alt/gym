import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Badge } from './ui';
import { useWorkoutStore } from '../stores/workout-store';
import { useProfileStore } from '../stores/profile-store';
import { getSuggestedLoad } from '../lib/suggested-load';
import type { ActiveWorkoutSession, ActiveExercise, ActiveSet, MuscleGroup, Equipment } from '../types/workout';
import { Image } from 'expo-image';
import { ExerciseIllustration } from './ExerciseIllustration';
import { ExerciseImageViewer } from './workout/ExerciseImageViewer';
import { getExerciseImages } from '../lib/exercise-image-map';

// Lazy-load native module (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

// ── Props ────────────────────────────────────────────────────────────

export interface FocusedWorkoutViewProps {
  activeSession: ActiveWorkoutSession;
  logSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number, isAutoFilled?: boolean) => void;
  completeSet: (exerciseInstanceId: string, setId: string) => void;
  startRestTimer: (durationSeconds: number) => void;
  setCurrentExerciseIndex: (index: number) => void;
  goToNextExercise: () => void;
  goToPreviousExercise: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Find the first incomplete set for an exercise, or null if all done. */
function findNextIncompleteSet(exercise: ActiveExercise): ActiveSet | null {
  return exercise.sets.find((s) => !s.isCompleted) ?? null;
}

/** Get exercises that share the same supersetGroupId, ordered by their position in the session. */
function getSupersetGroupMembers(
  session: ActiveWorkoutSession,
  groupId: string,
): ActiveExercise[] {
  return session.exercises.filter((e) => e.supersetGroupId === groupId && !e.isSkipped);
}

/** Check whether every exercise in a superset group has had a set completed in the current "round".
 *  A round is complete when each member has an equal number of completed sets (or has completed
 *  one more than the minimum across the group after the latest completion). Simplified: after
 *  cycling through all members once we consider the round done. */
function isSupersetRoundComplete(members: ActiveExercise[]): boolean {
  if (members.length <= 1) return true;
  const completedCounts = members.map((m) => m.sets.filter((s) => s.isCompleted).length);
  const min = Math.min(...completedCounts);
  // Round is complete when all members are above the previous minimum
  return completedCounts.every((c) => c > min) || completedCounts.every((c) => c === completedCounts[0]);
}

// ── Component ────────────────────────────────────────────────────────

export function FocusedWorkoutView({
  activeSession,
  logSet,
  completeSet,
  startRestTimer,
  setCurrentExerciseIndex,
  goToNextExercise,
  goToPreviousExercise,
}: FocusedWorkoutViewProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const currentIndex = activeSession.currentExerciseIndex;
  const exercise = activeSession.exercises[currentIndex];

  // ── Form Check mode ────────────────────────────────────────────────
  const [formCheckMode, setFormCheckMode] = useState(false);
  const exerciseImages = useMemo(() => getExerciseImages(exercise.exerciseId), [exercise.exerciseId]);
  const hasImages = !!exerciseImages;

  // ── Exercise library entry for illustration ───────────────────────
  const allExercises = useWorkoutStore((s) => s.exercises);
  const storeDefaultRestSeconds = useWorkoutStore((s) => s.defaultRestSeconds);
  const exerciseLib = useMemo(
    () => allExercises.find((e) => e.id === exercise.exerciseId),
    [allExercises, exercise.exerciseId],
  );

  // ── Suggestion engine ───────────────────────────────────────────────
  const history = useWorkoutStore((s) => s.history);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const isMetric = unitPref === 'metric';
  const unit = isMetric ? 'kg' : 'lbs';

  const suggestion = useMemo(
    () => getSuggestedLoad(exercise.exerciseId, exercise.targetReps ?? '8-12', exercise.sets.length, history, isMetric),
    [exercise.exerciseId, exercise.sets.length, history, isMetric],
  );

  // ── Current set tracking ───────────────────────────────────────────
  const currentSet = useMemo(() => findNextIncompleteSet(exercise), [exercise]);
  const completedCount = useMemo(() => exercise.sets.filter((s) => s.isCompleted).length, [exercise]);
  const totalSets = exercise.sets.length;

  const handleUseSuggestion = useCallback(() => {
    if (!suggestion || !currentSet) return;
    const w = suggestion.suggestedWeight;
    const r = suggestion.suggestedReps;
    setLocalWeight(w.toString());
    setLocalReps(r.toString());
    logSet(exercise.id, currentSet.id, w, r);
  }, [suggestion, currentSet, exercise.id, logSet]);

  // ── Local weight / reps state (mirrors current set) ────────────────
  const [localWeight, setLocalWeight] = useState('');
  const [localReps, setLocalReps] = useState('');

  // Sync local inputs when the current set changes (e.g. after auto-advance)
  useEffect(() => {
    if (currentSet) {
      setLocalWeight(currentSet.weight !== undefined ? currentSet.weight.toString() : '');
      setLocalReps(currentSet.reps !== undefined ? currentSet.reps.toString() : '');
    }
  }, [currentSet?.id, currentSet?.weight, currentSet?.reps]);

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

  // ── Input handlers ─────────────────────────────────────────────────

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

  // ── Animations ────────────────────────────────────────────────────
  const logBtnScale = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const isLoggingRef = useRef(false);

  // ── Log Set handler ────────────────────────────────────────────────
  const handleLogSet = useCallback(() => {
    if (isLoggingRef.current) return;
    isLoggingRef.current = true;
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
    logSet(exercise.id, currentSet.id, w, r);
    completeSet(exercise.id, currentSet.id);
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // 2. Auto-fill: if the next incomplete set has empty weight/reps, pre-populate it
    const nextIncomplete = exercise.sets.find(
      (s) => !s.isCompleted && s.id !== currentSet.id,
    );
    if (nextIncomplete && nextIncomplete.weight === undefined && nextIncomplete.reps === undefined) {
      logSet(exercise.id, nextIncomplete.id, w, r, true);
    }

    // 3. Superset flow: cycle to next exercise in the group
    if (isInSuperset) {
      const currentMemberIdx = supersetMembers.findIndex((m) => m.id === exercise.id);
      const nextMemberIdx = (currentMemberIdx + 1) % supersetMembers.length;
      const nextMember = supersetMembers[nextMemberIdx];

      // Check if we just completed a full round (cycled back to first member)
      if (nextMemberIdx === 0) {
        // Full round done - start rest timer: exercise-specific → store default → 90s
        const restTime = exercise.restSeconds ?? storeDefaultRestSeconds ?? 90;
        startRestTimer(restTime);
      }

      // Navigate to the next superset member
      const globalIdx = activeSession.exercises.findIndex((e) => e.id === nextMember.id);
      if (globalIdx !== -1 && globalIdx !== currentIndex) {
        setCurrentExerciseIndex(globalIdx);
      }
    } else {
      // Not in a superset - start rest timer: exercise-specific → store default → 90s
      const restTime = exercise.restSeconds ?? storeDefaultRestSeconds ?? 90;
      startRestTimer(restTime);
    }
    setTimeout(() => { isLoggingRef.current = false; }, 300);
  }, [
    currentSet,
    localWeight,
    localReps,
    exercise,
    logSet,
    completeSet,
    startRestTimer,
    storeDefaultRestSeconds,
    isInSuperset,
    supersetMembers,
    activeSession.exercises,
    currentIndex,
    setCurrentExerciseIndex,
  ]);

  // ── All sets complete for this exercise? ───────────────────────────
  const allComplete = !currentSet;

  // ── Set type label ─────────────────────────────────────────────────
  const setTypeLabel = currentSet
    ? currentSet.setType === 'warmup'
      ? 'Warm-up'
      : currentSet.setType === 'drop'
        ? 'Drop Set'
        : currentSet.setType === 'failure'
          ? 'Failure'
          : 'Working'
    : '';

  return (
    <View style={styles.container}>
      {/* ── Exercise Image Viewer ──────────────────────────────────── */}
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

      {/* ── Form Check toggle ──────────────────────────────────────── */}
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

      {/* ── Exercise Header ─────────────────────────────────────────── */}
      <View style={[styles.headerSection, { paddingHorizontal: spacing.base }]}>
        {/* Superset badge */}
        {isInSuperset && (
          <View style={[styles.supersetRow, { marginBottom: spacing.sm }]}>
            <Badge label={supersetLabel} variant="info" />
            <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>
              Exercise {supersetPosition} of {supersetMembers.length}
            </Text>
          </View>
        )}

        {/* Exercise illustration */}
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

        {/* Set progress */}
        <View style={[styles.progressRow, { marginTop: spacing.md }]}>
          {exercise.sets.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.progressDot,
                {
                  backgroundColor: s.isCompleted
                    ? colors.success
                    : s.id === currentSet?.id
                      ? colors.primary
                      : colors.surfaceSecondary,
                  borderColor: s.id === currentSet?.id ? colors.primary : 'transparent',
                  borderWidth: s.id === currentSet?.id ? 2 : 0,
                  width: 28,
                  height: 28,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  {
                    color: s.isCompleted
                      ? colors.textInverse
                      : s.id === currentSet?.id
                        ? colors.primary
                        : colors.textTertiary,
                  },
                ]}
              >
                {s.isCompleted ? '✓' : s.setNumber}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[typography.label, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {allComplete
            ? 'All sets complete!'
            : `Set ${completedCount + 1} of ${totalSets} · ${setTypeLabel}`}
        </Text>
      </View>

      {/* ── Input Section (only if there's an incomplete set) ──────── */}
      {currentSet ? (
        <View style={[styles.inputSection, { paddingHorizontal: spacing.base }]}>
          {/* Green flash overlay for the entire section */}
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

          {/* Suggestion banner */}
          {suggestion && (
            <View style={[styles.suggestionCard, { backgroundColor: suggestion.confidence === 'high' ? colors.successLight : colors.primaryMuted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }]}>
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
            </View>
          )}

          {/* Weight - Scoreboard style */}
          <View style={styles.inputBlock}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center', letterSpacing: 2 }]}>
              WEIGHT ({unit})
            </Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={() => incrementWeight(-weightStep)}
                style={[
                  styles.bigIncBtn,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
                ]}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.bigInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    fontSize: 48,
                    fontWeight: '700',
                    letterSpacing: -1,
                  },
                ]}
                value={localWeight}
                onChangeText={setLocalWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                selectTextOnFocus
              />
              <TouchableOpacity
                onPress={() => incrementWeight(weightStep)}
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
              <TextInput
                style={[
                  styles.bigInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    fontSize: 48,
                    fontWeight: '700',
                    letterSpacing: -1,
                  },
                ]}
                value={localReps}
                onChangeText={setLocalReps}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                selectTextOnFocus
              />
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

          {/* Log Set button - MASSIVE */}
          <Animated.View style={{ transform: [{ scale: logBtnScale }], marginTop: spacing['2xl'] }}>
            <TouchableOpacity
              onPress={handleLogSet}
              style={[
                styles.logSetBtn,
                {
                  backgroundColor: colors.success,
                  borderRadius: radius.xl,
                  paddingVertical: 22,
                  shadowColor: colors.success,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={32} color={colors.textInverse} />
              <Text
                style={[
                  typography.h1,
                  { color: colors.textInverse, marginLeft: spacing.md, fontSize: 22 },
                ]}
              >
                LOG SET
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Completed sets summary */}
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
            Move to the next exercise or go back to review.
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
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  supersetRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flex: 1,
    justifyContent: 'center',
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
  logSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
