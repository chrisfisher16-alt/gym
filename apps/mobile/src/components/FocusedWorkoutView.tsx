import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Badge } from './ui';
import type { ActiveWorkoutSession, ActiveExercise, ActiveSet } from '../types/workout';

// Lazy-load native module (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

// ── Props ────────────────────────────────────────────────────────────

export interface FocusedWorkoutViewProps {
  activeSession: ActiveWorkoutSession;
  logSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number) => void;
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

  // ── Current set tracking ───────────────────────────────────────────
  const currentSet = useMemo(() => findNextIncompleteSet(exercise), [exercise]);
  const completedCount = useMemo(() => exercise.sets.filter((s) => s.isCompleted).length, [exercise]);
  const totalSets = exercise.sets.length;

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

  // ── Log Set handler ────────────────────────────────────────────────
  const handleLogSet = useCallback(() => {
    if (!currentSet) return;

    const w = parseFloat(localWeight);
    const r = parseInt(localReps, 10);
    if (isNaN(w) || isNaN(r)) return;

    // 1. Log weight/reps then complete the set
    logSet(exercise.id, currentSet.id, w, r);
    completeSet(exercise.id, currentSet.id);
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 2. Auto-fill: if the next incomplete set has empty weight/reps, pre-populate it
    const nextIncomplete = exercise.sets.find(
      (s) => !s.isCompleted && s.id !== currentSet.id,
    );
    if (nextIncomplete && nextIncomplete.weight === undefined && nextIncomplete.reps === undefined) {
      logSet(exercise.id, nextIncomplete.id, w, r);
    }

    // 3. Superset flow: cycle to next exercise in the group
    if (isInSuperset) {
      const currentMemberIdx = supersetMembers.findIndex((m) => m.id === exercise.id);
      const nextMemberIdx = (currentMemberIdx + 1) % supersetMembers.length;
      const nextMember = supersetMembers[nextMemberIdx];

      // Check if we just completed a full round (cycled back to first member)
      if (nextMemberIdx === 0) {
        // Full round done - start rest timer
        startRestTimer(90);
      }

      // Navigate to the next superset member
      const globalIdx = activeSession.exercises.findIndex((e) => e.id === nextMember.id);
      if (globalIdx !== -1 && globalIdx !== currentIndex) {
        setCurrentExerciseIndex(globalIdx);
      }
    } else {
      // Not in a superset - start rest timer immediately
      startRestTimer(90);
    }
  }, [
    currentSet,
    localWeight,
    localReps,
    exercise,
    logSet,
    completeSet,
    startRestTimer,
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
        <View style={[styles.inputSection, { paddingHorizontal: spacing.xl }]}>
          {/* Weight */}
          <View style={styles.inputBlock}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'center' }]}>
              WEIGHT (lbs)
            </Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={() => incrementWeight(-5)}
                style={[
                  styles.bigIncBtn,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                ]}
              >
                <Text style={[typography.h2, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.bigInput,
                  typography.displayLarge,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
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
                onPress={() => incrementWeight(5)}
                style={[
                  styles.bigIncBtn,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                ]}
              >
                <Text style={[typography.h2, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reps */}
          <View style={[styles.inputBlock, { marginTop: spacing.lg }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'center' }]}>
              REPS
            </Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={() => incrementReps(-1)}
                style={[
                  styles.bigIncBtn,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                ]}
              >
                <Text style={[typography.h2, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.bigInput,
                  typography.displayLarge,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
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
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                ]}
              >
                <Text style={[typography.h2, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Log Set button */}
          <TouchableOpacity
            onPress={handleLogSet}
            style={[
              styles.logSetBtn,
              {
                backgroundColor: colors.success,
                borderRadius: radius.lg,
                marginTop: spacing.xl,
                paddingVertical: spacing.base,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.textInverse} />
            <Text
              style={[
                typography.h2,
                { color: colors.textInverse, marginLeft: spacing.sm },
              ]}
            >
              Log Set
            </Text>
          </TouchableOpacity>

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
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigInput: {
    flex: 1,
    textAlign: 'center',
    borderWidth: 1,
    minHeight: 60,
    marginHorizontal: 12,
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
});
