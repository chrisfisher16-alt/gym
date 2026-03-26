import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Linking,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useWorkoutStore } from '../../stores/workout-store';
import { useProfileStore } from '../../stores/profile-store';
import { Badge } from '../ui';
import { getLastPerformance, getSuggestedLoad, getPreviousSetData, type UserBodyMetrics } from '../../lib/suggested-load';
import { ExerciseImage } from './ExerciseImage';
import { ExerciseDetailSheet } from '../ExerciseDetailSheet';
import { ExerciseOptionsSheet } from './ExerciseOptionsSheet';
import { mediumImpact } from '../../lib/haptics';
import { ExerciseImageViewer } from './ExerciseImageViewer';
import { TimedSetRow } from './TimedSetRow';
import { SetRow } from './SetRow';
import { BodyweightSetRow } from './BodyweightSetRow';
import type { ActiveExercise, ExerciseLibraryEntry } from '../../types/workout';

// ── Helpers ──────────────────────────────────────────────────────────

const COLLAPSED_IMAGE_HEIGHT = 60;
const EXPANDED_IMAGE_HEIGHT = 160;
const IMAGE_ANIM_DURATION = 200;

// Module-level map to track per-exercise image expand state for this session
const imageExpandState = new Map<string, boolean>();

/** Format seconds to "M:SS" display (e.g. 90 → "1:30"). */
function formatRestTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Props ────────────────────────────────────────────────────────────

export interface ExerciseCardProps {
  exercise: ActiveExercise;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isInSuperset: boolean;
  supersetSize: number;
  supersetLabel: string;
  supersetMemberIndex?: number;
  supersetCompletedRounds?: number;
  supersetTotalRounds?: number;
  onSwapPress: (exercise: ActiveExercise) => void;
  onSupersetPress: (exerciseId: string) => void;
  onRemoveSupersetPress: (groupId: string) => void;
  onDeletePress: (exerciseInstanceId: string) => void;
  onReportIssue?: (context: string) => void;
  isReorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  isCurrent,
  isExpanded,
  onToggleExpand,
  isInSuperset,
  supersetSize,
  supersetLabel,
  supersetMemberIndex,
  supersetCompletedRounds,
  supersetTotalRounds,
  onSwapPress,
  onSupersetPress,
  onRemoveSupersetPress,
  onDeletePress,
  onReportIssue,
  isReorderMode,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ExerciseCardProps) {
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
  const autoRestTimer = useWorkoutStore((s) => s.autoRestTimer);
  const updateExerciseRestTime = useWorkoutStore((s) => s.updateExerciseRestTime);
  const cascadeWeight = useWorkoutStore((s) => s.cascadeWeight);

  // Exercise library entry
  const exerciseLib = useMemo(
    () => allExercises.find((e) => e.id === exercise.exerciseId),
    [allExercises, exercise.exerciseId],
  );

  const weightLabel = exerciseLib?.equipment === 'dumbbell' ? 'Per Arm'
    : exerciseLib?.equipment === 'barbell' ? 'Bar + Plates'
    : null;

  // Exercise image collapse/expand state
  const isImageExpanded = imageExpandState.get(exercise.exerciseId) ?? false;
  const imageHeightAnim = useRef(
    new Animated.Value(isImageExpanded ? EXPANDED_IMAGE_HEIGHT : COLLAPSED_IMAGE_HEIGHT),
  ).current;

  const toggleImageExpand = useCallback(() => {
    const currentlyExpanded = imageExpandState.get(exercise.exerciseId) ?? false;
    const next = !currentlyExpanded;
    imageExpandState.set(exercise.exerciseId, next);
    Animated.timing(imageHeightAnim, {
      toValue: next ? EXPANDED_IMAGE_HEIGHT : COLLAPSED_IMAGE_HEIGHT,
      duration: IMAGE_ANIM_DURATION,
      useNativeDriver: false,
    }).start();
  }, [exercise.exerciseId, imageHeightAnim]);

  // Sheet / panel state
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Reset dismissed state when exercise changes
  useEffect(() => {
    setSuggestionDismissed(false);
  }, [exercise.exerciseId]);

  // Per-exercise rest time state
  const [editingRestTime, setEditingRestTime] = useState(false);
  const [restTimeInput, setRestTimeInput] = useState('');
  const REST_PRESETS = [30, 60, 90, 120, 180];

  const profile = useProfileStore((s) => s.profile);
  const unitPref = profile.unitPreference;
  const isMetric = unitPref === 'metric';
  const unit = isMetric ? 'kg' : 'lbs';
  const lastPerf = getLastPerformance(exercise.exerciseId, history, unit);

  // User metrics for beginner suggestions
  const userMetrics: UserBodyMetrics | undefined = useMemo(() => {
    if (!profile.weightKg) return undefined;
    return {
      weightKg: profile.weightKg,
      gender: profile.gender,
      trainingExperience: profile.trainingExperience,
    };
  }, [profile.weightKg, profile.gender, profile.trainingExperience]);

  const activeSession = useWorkoutStore((s) => s.activeSession);

  // Suggestion engine
  const suggestion = useMemo(
    () => getSuggestedLoad(
      exercise.exerciseId, exercise.targetReps ?? '8-12', exercise.sets.length,
      history, isMetric, userMetrics, exercise.isBodyweight,
      allExercises, activeSession?.exercises
    ),
    [exercise.exerciseId, exercise.targetReps, exercise.sets.length, history, isMetric, userMetrics, exercise.isBodyweight, allExercises, activeSession?.exercises],
  );

  // Pre-fill empty sets with suggestion on mount
  useEffect(() => {
    if (!suggestion) return;
    const isBodyweightEx = !!exercise.isBodyweight;
    for (const set of exercise.sets) {
      if (!set.isCompleted && set.weight === undefined && set.reps === undefined) {
        logSet(exercise.id, set.id, isBodyweightEx ? 0 : suggestion.suggestedWeight, suggestion.suggestedReps, true);
      }
    }
  }, [suggestion?.suggestedWeight, suggestion?.suggestedReps]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    const isBodyweightEx = !!exercise.isBodyweight;
    for (const set of exercise.sets) {
      if (!set.isCompleted) {
        logSet(exercise.id, set.id, isBodyweightEx ? 0 : suggestion.suggestedWeight, suggestion.suggestedReps, true);
      }
    }
  }, [suggestion, exercise.sets, exercise.id, exercise.isBodyweight, logSet]);

  const isTimeBased = !!exercise.isTimeBased;
  const isBodyweight = !!exercise.isBodyweight;
  const defaultDuration = exercise.defaultDurationSeconds ?? 60;

  // Superset bar color: blue for superset, purple for tri-set
  const supersetBarColor = supersetSize >= 3 ? colors.triSet : colors.primary;

  // Current rest time
  const currentRestTime = exercise.restSeconds ?? defaultRestSeconds;

  const handleLogSet = useCallback(
    (setId: string, weight: number, reps: number) => {
      logSet(exercise.id, setId, weight, reps, false);
    },
    [logSet, exercise.id],
  );

  const handleWeightCascade = useCallback(
    (setIndex: number, weight: number, reps: number) => {
      cascadeWeight(exercise.id, setIndex, weight, reps);
    },
    [cascadeWeight, exercise.id],
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
      mediumImpact();

      // Auto-rest timer guard
      if (!autoRestTimer || exercise.restTimerMode === 'off') return;

      const duration = exercise.restTimerMode === 'custom' && exercise.restTimerCustomSeconds
        ? exercise.restTimerCustomSeconds
        : (exercise.restSeconds ?? defaultRestSeconds);

      if (isInSuperset) {
        // Read fresh state from store to avoid stale closures
        const freshSession = useWorkoutStore.getState().activeSession;
        if (!freshSession) return;
        const freshExercise = freshSession.exercises.find((e) => e.id === exercise.id);
        if (!freshExercise) return;

        const members = freshSession.exercises.filter(
          (e) => e.supersetGroupId === freshExercise.supersetGroupId,
        );
        const thisCompleted = freshExercise.sets.filter((s) => s.isCompleted).length;
        const allCaughtUp = members.every((m) => {
          const completed = m.sets.filter((s) => s.isCompleted).length;
          return completed >= thisCompleted;
        });
        if (allCaughtUp) {
          startRestTimer(duration);
        }
      } else {
        // Non-superset: always start rest after every set
        startRestTimer(duration);
      }
    },
    [completeSet, exercise.id, exercise.restSeconds, exercise.restTimerMode, exercise.restTimerCustomSeconds, startRestTimer, isInSuperset, defaultRestSeconds, autoRestTimer],
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

  const handleYouTube = useCallback(() => {
    const query = encodeURIComponent(`how to do ${exercise.exerciseName} proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  }, [exercise.exerciseName]);

  // Callbacks for ExerciseOptionsSheet
  const handleOptionsReplace = useCallback(() => {
    onSwapPress(exercise);
  }, [onSwapPress, exercise]);

  const handleOptionsInfo = useCallback(() => {
    setShowDetailSheet(true);
  }, []);

  if (exercise.isSkipped) return null;

  return (
    <View
      style={[
        styles.exerciseCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          marginBottom: isInSuperset ? spacing.xs : spacing.md,
          borderWidth: isCurrent ? 2 : 1,
          borderColor: isCurrent ? colors.primary : colors.borderLight,
        },
        isInSuperset && {
          borderLeftWidth: 3,
          borderLeftColor: supersetBarColor,
          marginLeft: spacing.sm,
        },
      ]}
    >
      {/* Exercise header row — tappable to expand/collapse */}
      <Pressable onPress={onToggleExpand} style={styles.exerciseHeaderRow}>
        {/* Reorder drag handle */}
        {isReorderMode && (
          <View style={styles.reorderHandle}>
            <Ionicons name="reorder-three" size={22} color={colors.textTertiary} />
          </View>
        )}
        {/* Exercise thumbnail */}
        {exerciseLib && !isReorderMode && (
          <ExerciseImage
            exerciseId={exercise.exerciseId}
            variant="thumbnail"
            imageUrl={exerciseLib.heroImageUrl}
            category={exerciseLib.category}
            width={48}
            height={48}
            style={{ marginRight: spacing.sm, borderRadius: radius.md }}
          />
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.exerciseNameRow}>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setShowDetailSheet(true); }}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              style={{ flex: 1 }}
            >
              <Text style={[typography.labelLarge, { color: colors.primary, flex: 1 }]} numberOfLines={1}>
                {exercise.exerciseName}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {isInSuperset && !isReorderMode && (
              <Badge label={supersetLabel} variant="info" />
            )}
            {isInSuperset && supersetCompletedRounds !== undefined && supersetTotalRounds !== undefined && !isReorderMode && (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Round {supersetCompletedRounds + 1} of {supersetTotalRounds}
              </Text>
            )}
          </View>
        </View>
        {/* How-To quick icon on header */}
        {!isReorderMode && (
          <TouchableOpacity
            onPress={handleYouTube}
            accessibilityRole="button"
            accessibilityLabel="Watch form video"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: spacing.xs, padding: spacing.xs }}
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
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
          /* Expand/collapse chevron */
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
            style={{ marginLeft: 4 }}
          />
        )}
      </Pressable>

      {/* Action pills row — visible when expanded */}
      {isExpanded && !isReorderMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.pillsRow, { gap: spacing.sm, marginTop: spacing.sm }]}
        >
          {/* Rest Timer pill */}
          <TouchableOpacity
            onPress={() => {
              setRestTimeInput(currentRestTime.toString());
              setEditingRestTime(true);
            }}
            activeOpacity={0.7}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                height: 32,
              },
            ]}
          >
            <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              {formatRestTime(currentRestTime)} rest
            </Text>
          </TouchableOpacity>

          {/* History pill */}
          <TouchableOpacity
            onPress={() => setShowDetailSheet(true)}
            activeOpacity={0.7}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                height: 32,
              },
            ]}
          >
            <Ionicons name="stats-chart-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              History
            </Text>
          </TouchableOpacity>

          {/* Replace pill */}
          <TouchableOpacity
            onPress={() => onSwapPress(exercise)}
            activeOpacity={0.7}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                height: 32,
              },
            ]}
          >
            <Ionicons name="swap-horizontal-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              Replace
            </Text>
          </TouchableOpacity>

          {/* More pill */}
          <TouchableOpacity
            onPress={() => setShowOptionsSheet(true)}
            activeOpacity={0.7}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                height: 32,
              },
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={14} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              More
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
                    backgroundColor: currentRestTime === seconds
                      ? colors.primary
                      : colors.surface,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: currentRestTime === seconds
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: currentRestTime === seconds
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

      {/* In reorder mode or collapsed, hide the detailed content */}
      {isReorderMode ? (
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
          {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
        </Text>
      ) : !isExpanded ? (
        <Pressable onPress={onToggleExpand} style={{ marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
              {exercise.sets.filter((s) => s.isCompleted).length} of {exercise.sets.length} sets
              {(() => {
                const lastCompleted = [...exercise.sets].reverse().find((s) => s.isCompleted);
                if (lastCompleted?.weight && lastCompleted?.reps) {
                  return ` — ${lastCompleted.weight} ${unit}${weightLabel ? ` (${weightLabel})` : ''} x ${lastCompleted.reps}`;
                }
                return lastPerf ? ` — Prev: ${lastPerf}` : '';
              })()}
            </Text>
            <Text style={[typography.caption, { color: colors.primary }]}>Expand</Text>
          </View>
          <View onStartShouldSetResponder={() => true}>
          {/* Compact suggestion in collapsed view */}
          {suggestion && !isTimeBased && !suggestionDismissed && exercise.sets.some(s => !s.isCompleted) && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: spacing.xs,
              paddingVertical: 4,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: suggestion.confidence === 'high' ? colors.successLight : colors.primaryMuted,
            }}>
              <Ionicons 
                name="trending-up" 
                size={12} 
                color={suggestion.confidence === 'high' ? colors.success : colors.primary} 
              />
              <Text 
                style={[
                  typography.caption, 
                  { 
                    color: suggestion.confidence === 'high' ? colors.success : colors.primary, 
                    marginLeft: 4, 
                    flex: 1,
                  }
                ]} 
                numberOfLines={1}
              >
                {isBodyweight 
                  ? `Suggested: ${suggestion.suggestedReps} reps` 
                  : `Suggested: ${suggestion.suggestedWeight} ${unit} \u00d7 ${suggestion.suggestedReps}`}
              </Text>
              <TouchableOpacity 
                onPress={() => { 
                  handleApplySuggestion(); 
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
              >
                <Ionicons name="checkmark-circle" size={16} color={suggestion.confidence === 'high' ? colors.success : colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { 
                  setSuggestionDismissed(true); 
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
              >
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
          </View>
        </Pressable>
      ) : (
      <>

      {/* Collapsible exercise image */}
      <Pressable onPress={toggleImageExpand} style={{ marginTop: spacing.sm }}>
        <Animated.View style={{ height: imageHeightAnim, overflow: 'hidden', borderRadius: radius.md }}>
          <ExerciseImageViewer
            exerciseId={exercise.exerciseId}
            size="compact"
            style={{ height: EXPANDED_IMAGE_HEIGHT, borderRadius: radius.md }}
          />
        </Animated.View>
        {/* Chevron toggle hint */}
        <View style={styles.imageChevron}>
          <Ionicons
            name={isImageExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color="rgba(255,255,255,0.85)"
          />
        </View>
      </Pressable>

      {/* Previous performance */}
      {lastPerf && (
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
          Last: {lastPerf}
        </Text>
      )}

      {/* Suggestion banner */}
      {suggestion && !isTimeBased && !suggestionDismissed && exercise.sets.some(s => !s.isCompleted) && (
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
              {isBodyweight ? `Suggested: ${suggestion.suggestedReps} reps` : `Suggested: ${suggestion.suggestedWeight} ${unit} × ${suggestion.suggestedReps} reps`}
            </Text>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setSuggestionDismissed(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 4 }}
            >
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
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
      ) : isBodyweight ? (
        <>
          {/* Bodyweight set header (reps only) */}
          <View style={[styles.setHeader, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 28 }]}>SET</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
              REPS
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 44, textAlign: 'center' }]}>✓</Text>
          </View>
          {exercise.sets.map((set) => (
            <BodyweightSetRow
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
      ) : (
        <>
          {/* Set header (weight/reps) */}
          <View style={[styles.setHeader, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 28 }]}>SET</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 52, textAlign: 'center' }]}>PREV</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
              WEIGHT{weightLabel ? `\n` : ''}{weightLabel ? <Text style={[typography.caption, { color: colors.textTertiary, fontSize: 9 }]}>{weightLabel}</Text> : null}
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 20, textAlign: 'center' }]}>×</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, flex: 1, textAlign: 'center' }]}>
              REPS
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, width: 44, textAlign: 'center' }]}>✓</Text>
          </View>

          {/* Sets */}
          {exercise.sets.map((set, setIdx) => {
            const prev = getPreviousSetData(exercise.exerciseId, set.setNumber, history);
            const prevDisplay = prev ? `${prev.weight}×${prev.reps}` : undefined;
            return (
              <SetRow
                key={set.id}
                set={set}
                setIndex={setIdx}
                exerciseInstanceId={exercise.id}
                previousData={prevDisplay}
                onLog={handleLogSet}
                onComplete={handleCompleteSet}
                onRemove={handleRemoveSet}
                onRPE={handleRPE}
                onWeightCascade={handleWeightCascade}
                equipmentType={exerciseLib?.equipment}
              />
            );
          })}
        </>
      )}

      {/* Add set buttons */}
      {isExpanded && !isReorderMode && (
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
      )}
      </>
      )}

      {/* Exercise Detail Sheet (History) */}
      {exerciseLib && (
        <ExerciseDetailSheet
          visible={showDetailSheet}
          onClose={() => setShowDetailSheet(false)}
          exercise={exerciseLib}
        />
      )}

      {/* Exercise Options Sheet (More menu) */}
      <ExerciseOptionsSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        exercise={exercise}
        onReplacePress={handleOptionsReplace}
        onExerciseInfoPress={handleOptionsInfo}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  exerciseCard: {
    position: 'relative',
    padding: 16,
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
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36, // touch target
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  suggestionBanner: {},
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restTimeEditor: {},
  restPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restCustomInput: {
    borderWidth: 1,
    textAlign: 'center',
    width: 70,
    minHeight: 36,
    paddingHorizontal: 8,
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
  imageChevron: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
});
