import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { useProfileStore } from '../../stores/profile-store';
import { ExerciseImage } from './ExerciseImage';
import { SwipeableRow, type SwipeAction } from '../ui/SwipeableRow';
import { getTrackingModeIcon } from '../../lib/tracking-mode-utils';
import type { ActiveExercise, ActiveSet } from '../../types/workout';

// ── Constants ────────────────────────────────────────────────────────

const THUMBNAIL_SIZE = 40;
const DOT_SIZE = 7;
const DOT_GAP = 5;
const GOLD_BORDER_WIDTH = 4;
const COMPLETED_OPACITY = 0.55;
const SET_ROW_HEIGHT = 28;
const EXPANDED_PADDING = 12;

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
};

// ── Props ────────────────────────────────────────────────────────────

export interface CommandCenterCardProps {
  exercise: ActiveExercise;
  exerciseIndex: number;
  isCurrent: boolean;
  isExpanded: boolean;
  onPress: () => void;
  onToggleExpand: () => void;
  onLongPress?: () => void;
  onSetPress?: (setIndex: number) => void;
  onQuickComplete?: () => void;
  onSwapExercise?: () => void;
  onRemoveExercise?: () => void;
  onCreateSuperset?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatSetDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}m`;
}

function formatSetDistance(value: number, distanceUnit?: 'miles' | 'km' | 'meters'): string {
  if (distanceUnit === 'meters') return `${value}m`;
  return `${value} ${distanceUnit === 'km' ? 'km' : 'mi'}`;
}

function buildSetSummary(
  sets: ActiveSet[],
  isBodyweight: boolean,
  unit: string,
  trackingMode?: string,
): string {
  const workingSets = sets.filter((s) => s.setType !== 'warmup');
  const count = workingSets.length;
  if (count === 0) return 'No sets';

  const setLabel = count === 1 ? '1 set' : `${count} sets`;
  const completed = workingSets.filter((s) => s.isCompleted);

  // Duration-based sets
  if (trackingMode === 'duration' || trackingMode === 'duration_distance' || trackingMode === 'duration_level') {
    if (completed.length > 0) {
      const durations = new Set(completed.map((s) => s.durationSeconds));
      if (durations.size === 1 && completed[0].durationSeconds != null) {
        return `${setLabel} · ${formatSetDuration(completed[0].durationSeconds)}`;
      }
    }
    return setLabel;
  }

  // Distance-based sets
  if (trackingMode === 'distance_weight') {
    if (completed.length > 0) {
      const distances = new Set(completed.map((s) => s.distance));
      if (distances.size === 1 && completed[0].distance != null) {
        return `${setLabel} · ${formatSetDistance(completed[0].distance, completed[0].distanceUnit)}`;
      }
    }
    return setLabel;
  }

  // Reps-only sets
  if (trackingMode === 'reps_only') {
    if (completed.length > 0) {
      const avgReps = Math.round(completed.reduce((sum, s) => sum + (s.reps ?? 0), 0) / completed.length);
      return avgReps ? `${setLabel} · ${avgReps} reps` : setLabel;
    }
    return setLabel;
  }

  // Check if all completed sets share the same weight×reps
  if (completed.length > 0 && !isBodyweight) {
    const weights = new Set(completed.map((s) => s.weight));
    const reps = new Set(completed.map((s) => s.reps));
    if (weights.size === 1 && reps.size === 1) {
      const w = completed[0].weight ?? 0;
      const r = completed[0].reps ?? 0;
      return `${setLabel} · ${r}×${w} ${unit}`;
    }
  }

  // Fall back: if bodyweight or mixed, show reps only
  if (isBodyweight) {
    const avgReps = completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.reps ?? 0), 0) / completed.length)
      : null;
    return avgReps ? `${setLabel} · ${avgReps} reps` : setLabel;
  }

  return setLabel;
}

function formatRestTime(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

function formatSetDetail(
  set: ActiveSet,
  index: number,
  isBodyweight: boolean,
  unit: string,
): string {
  const label = `Set ${index + 1}:`;
  if (!set.isCompleted && set.weight === undefined && set.reps === undefined) {
    return `${label} __ × __`;
  }
  if (isBodyweight) {
    const reps = set.reps ?? '__';
    return `${label} ${reps} reps`;
  }
  const w = set.weight ?? '__';
  const r = set.reps ?? '__';
  return `${label} ${w} ${unit} × ${r}`;
}

// ── Component ────────────────────────────────────────────────────────

export const CommandCenterCard = React.memo(function CommandCenterCard({
  exercise,
  exerciseIndex,
  isCurrent,
  isExpanded,
  onPress,
  onToggleExpand,
  onLongPress,
  onSetPress,
  onQuickComplete,
  onSwapExercise,
  onRemoveExercise,
  onCreateSuperset,
}: CommandCenterCardProps) {
  const { colors, spacing, radius, typography, dark } = useTheme();
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';

  const isBodyweight = !!exercise.isBodyweight;
  const trackingMode = exercise.trackingMode
    ?? (exercise.isTimeBased ? 'duration' : exercise.isBodyweight ? 'bodyweight_reps' : 'weight_reps');
  const trackingIcon = getTrackingModeIcon(trackingMode);
  const workingSets = useMemo(
    () => exercise.sets.filter((s) => s.setType !== 'warmup'),
    [exercise.sets],
  );
  const completedCount = useMemo(
    () => workingSets.filter((s) => s.isCompleted).length,
    [workingSets],
  );
  const allCompleted = workingSets.length > 0 && completedCount === workingSets.length;
  const restSeconds = exercise.restSeconds ?? 90;

  const summary = useMemo(
    () => buildSetSummary(exercise.sets, isBodyweight, unit, trackingMode),
    [exercise.sets, isBodyweight, unit, trackingMode],
  );

  // ── Expand/collapse animation ──────────────────────────────────
  const expandedTarget = useDerivedValue(() => (isExpanded ? 1 : 0));
  const expandProgress = useDerivedValue(() =>
    withSpring(expandedTarget.value, SPRING_CONFIG),
  );

  // Compute expanded content height
  const expandedContentHeight =
    workingSets.length * SET_ROW_HEIGHT + EXPANDED_PADDING * 2;

  const animatedExpandStyle = useAnimatedStyle(() => ({
    height: expandProgress.value * expandedContentHeight,
    opacity: expandProgress.value,
    overflow: 'hidden' as const,
  }));

  // ── Chevron rotation ───────────────────────────────────────────
  const chevronRotation = useSharedValue(isExpanded ? 90 : 0);
  useDerivedValue(() => {
    chevronRotation.value = withSpring(isExpanded ? 90 : 0, SPRING_CONFIG);
    return chevronRotation.value;
  });

  const handleSetPress = useCallback(
    (setIndex: number) => {
      onSetPress?.(setIndex);
    },
    [onSetPress],
  );

  // ── Gold accent color ──────────────────────────────────────────
  const goldAccent = dark ? '#CFAE80' : '#B8944F';

  // ── Swipe actions ─────────────────────────────────────────────
  const leftSwipeAction = useMemo<SwipeAction | undefined>(
    () =>
      onCreateSuperset
        ? { label: 'Superset', icon: 'link-outline', color: '#B8944F', onTrigger: onCreateSuperset }
        : undefined,
    [onCreateSuperset],
  );

  const rightSwipeAction = useMemo<SwipeAction | undefined>(
    () =>
      onRemoveExercise
        ? { label: 'Remove', icon: 'trash-outline', color: '#E53E3E', onTrigger: onRemoveExercise }
        : undefined,
    [onRemoveExercise],
  );

  if (exercise.isSkipped) return null;

  return (
    <SwipeableRow
      leftAction={leftSwipeAction}
      rightAction={rightSwipeAction}
      enabled={true}
    >
    <View
      style={[
        styles.cardWrapper,
        {
          marginBottom: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
          opacity: allCompleted ? COMPLETED_OPACITY : 1,
        },
        isCurrent && {
          borderLeftWidth: GOLD_BORDER_WIDTH,
          borderLeftColor: goldAccent,
        },
      ]}
    >
      {/* Main compact row */}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress ?? onToggleExpand}
        style={[
          styles.cardContent,
          { padding: spacing.md },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${exercise.exerciseName}, ${summary}`}
      >
        {/* Left: thumbnail */}
        <ExerciseImage
          exerciseId={exercise.exerciseId}
          variant="thumbnail"
          width={THUMBNAIL_SIZE}
          height={THUMBNAIL_SIZE}
          style={{ borderRadius: radius.md }}
        />

        {/* Center: info */}
        <View style={[styles.centerContent, { marginLeft: spacing.md }]}>
          {/* Exercise name + tracking mode icon + current badge */}
          <View style={styles.nameRow}>
            {trackingMode !== 'weight_reps' && (
              <Ionicons
                name={trackingIcon as any}
                size={14}
                color={colors.textTertiary}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[typography.label, { color: colors.text, flex: 1 }]}
              numberOfLines={1}
            >
              {exercise.exerciseName}
            </Text>
            {isCurrent && (
              <View
                style={[
                  styles.currentPill,
                  { backgroundColor: goldAccent, borderRadius: radius.sm },
                ]}
              >
                <Text style={[styles.currentPillText, { color: dark ? '#0D0D0D' : '#FFFFFF' }]}>
                  CURRENT
                </Text>
              </View>
            )}
          </View>

          {/* Set summary */}
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {summary}
          </Text>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {workingSets.map((set, i) => (
              <View
                key={set.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: set.isPR
                      ? colors.warning
                      : set.isCompleted
                        ? goldAccent
                        : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Rest time */}
          <Text style={[styles.restText, typography.caption, { color: colors.textTertiary }]}>
            Rest: {formatRestTime(restSeconds)}
          </Text>
        </View>

        {/* Right: chevron or checkmark */}
        <View style={styles.rightAction}>
          {allCompleted ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.completed} />
          ) : (
            <Pressable
              onPress={onToggleExpand}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? 'Collapse sets' : 'Expand sets'}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          )}
        </View>
      </Pressable>

      {/* Expanded inline preview */}
      <Animated.View style={animatedExpandStyle}>
        <View style={[styles.expandedContent, { paddingHorizontal: spacing.md }]}>
          {workingSets.map((set, i) => (
            <Pressable
              key={set.id}
              onPress={() => handleSetPress(i)}
              style={[
                styles.setPreviewRow,
                { height: SET_ROW_HEIGHT },
              ]}
              accessibilityRole="button"
              accessibilityLabel={formatSetDetail(set, i, isBodyweight, unit)}
            >
              <Text
                style={[
                  typography.caption,
                  { color: set.isCompleted ? colors.text : colors.textTertiary, flex: 1 },
                ]}
              >
                {formatSetDetail(set, i, isBodyweight, unit)}
              </Text>
              <Text style={{ fontSize: 12 }}>
                {set.isCompleted ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.completed} />
                ) : (
                  <Ionicons name="ellipse-outline" size={14} color={colors.textTertiary} />
                )}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
    </SwipeableRow>
  );
});

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardWrapper: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  restText: {
    marginTop: 3,
  },
  rightAction: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  setPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
