import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import type { ActiveSet } from '../../types/workout';
import { ExerciseTimer } from './ExerciseTimer';

export interface TimedSetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  defaultDuration: number;
  onLogDuration: (setId: string, durationSeconds: number) => void;
  onComplete: (setId: string) => void;
}

export const TimedSetRow = React.memo(function TimedSetRow({
  set,
  exerciseInstanceId,
  defaultDuration,
  onLogDuration,
  onComplete,
}: TimedSetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const handleTimerComplete = useCallback((actualDuration: number) => {
    onLogDuration(set.id, actualDuration);
    onComplete(set.id);
  }, [set.id, onLogDuration, onComplete]);

  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';

  if (set.isCompleted) {
    return (
      <View
        style={[
          styles.setRow,
          {
            backgroundColor: colors.completedMuted,
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
          <Text style={[typography.label, { color: colors.completed }]}>
            {set.durationSeconds ?? defaultDuration}s ✓
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={colors.completed} />
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
      </View>

      {/* ExerciseTimer replaces the old setInterval-based timer */}
      <ExerciseTimer
        targetDuration={defaultDuration}
        onComplete={handleTimerComplete}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timedSetContainer: {},
  timedSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
