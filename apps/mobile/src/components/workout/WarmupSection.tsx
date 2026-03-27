import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme';
import { useEntrance } from '../../lib/animations';
import { generateWarmup, type WarmupExercise } from '../../lib/warmup-generator';
import { ExerciseImage } from './ExerciseImage';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ──────────────────────────────────────────────────────────

export interface WarmupSectionProps {
  targetMuscleGroups: string[];
  initialExpanded?: boolean;
  onExerciseComplete?: (exerciseId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  foam_roll: 'Soft Tissue',
  dynamic_stretch: 'Dynamic Stretch',
  static_stretch: 'Static Stretch',
  light_cardio: 'Light Cardio',
  activation: 'Activation',
};

const THUMBNAIL_SIZE = 48;

// ── Helpers ────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`;
}

function exerciseSubtitle(exercise: WarmupExercise): string {
  const label = TYPE_LABELS[exercise.type] ?? exercise.type;

  if (exercise.durationSeconds != null) {
    const dur = formatDuration(exercise.durationSeconds);
    return exercise.sets > 1 ? `${label} · ${exercise.sets}x ${dur}` : `${label} · ${dur}`;
  }

  if (exercise.reps != null) {
    return exercise.sets > 1
      ? `${label} · ${exercise.sets}x${exercise.reps}`
      : `${label} · ${exercise.reps} reps`;
  }

  return label;
}

// ── Exercise Row ───────────────────────────────────────────────────

function WarmupExerciseRow({
  exercise,
  isComplete,
  onToggle,
  index,
}: {
  exercise: WarmupExercise;
  isComplete: boolean;
  onToggle: () => void;
  index: number;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { animatedStyle } = useEntrance(index * 60);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.exerciseRow,
          {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.base,
            borderBottomColor: colors.divider,
            borderBottomWidth: StyleSheet.hairlineWidth,
            opacity: isComplete ? 0.4 : 1,
          },
        ]}
      >
        {/* Thumbnail */}
        <ExerciseImage
          exerciseId={exercise.id}
          variant="thumbnail"
          width={THUMBNAIL_SIZE}
          height={THUMBNAIL_SIZE}
          category="warmup"
        />

        {/* Info */}
        <View style={[styles.exerciseInfo, { marginLeft: spacing.md }]}>
          <Text
            style={[typography.body, { color: colors.text }]}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {exerciseSubtitle(exercise)}
          </Text>
        </View>

        {/* Done checkbox */}
        <View
          style={[
            styles.checkbox,
            {
              width: 28,
              height: 28,
              borderRadius: radius.full,
              borderWidth: isComplete ? 0 : 1.5,
              borderColor: colors.border,
              backgroundColor: isComplete ? colors.completed : 'transparent',
            },
          ]}
        >
          {isComplete && (
            <Ionicons name="checkmark" size={16} color={colors.textInverse} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── WarmupSection ──────────────────────────────────────────────────

export function WarmupSection({
  targetMuscleGroups,
  initialExpanded = false,
  onExerciseComplete,
}: WarmupSectionProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const targetKey = targetMuscleGroups.slice().sort().join(',');
  const plan = useMemo(
    () => generateWarmup(targetMuscleGroups),
    [targetKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  const toggleExercise = useCallback(
    (id: string) => {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          onExerciseComplete?.(id);
        }
        return next;
      });
    },
    [onExerciseComplete],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: spacing.md,
        },
      ]}
    >
      {/* Header */}
      <Pressable
        onPress={toggleExpanded}
        style={[
          styles.header,
          {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.base,
          },
        ]}
      >
        <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>
          Warm-up
        </Text>

        {/* Time badge */}
        <View
          style={[
            styles.timeBadge,
            {
              backgroundColor: colors.primaryMuted,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              marginRight: spacing.sm,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.primary }]}>
            +{plan.totalEstimatedMinutes}m
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {/* Exercise list */}
      {isExpanded && (
        <View>
          {plan.exercises.map((exercise, i) => (
            <WarmupExerciseRow
              key={exercise.id}
              exercise={exercise}
              isComplete={completedIds.has(exercise.id)}
              onToggle={() => toggleExercise(exercise.id)}
              index={i}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  checkbox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
