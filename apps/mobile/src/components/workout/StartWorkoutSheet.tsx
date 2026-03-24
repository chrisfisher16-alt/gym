import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';
import type { WorkoutDayLocal, WorkoutProgramLocal } from '../../types/workout';

interface StartWorkoutSheetProps {
  visible: boolean;
  onClose: () => void;
  todayWorkout: WorkoutDayLocal | null;
  activeProgram: WorkoutProgramLocal | null;
  onStartProgramWorkout: () => void;
  onStartAIWorkout: () => void;
  onStartEmptyWorkout: () => void;
}

const AI_PURPLE = '#8B5CF6';

export function StartWorkoutSheet({
  visible,
  onClose,
  todayWorkout,
  activeProgram,
  onStartProgramWorkout,
  onStartAIWorkout,
  onStartEmptyWorkout,
}: StartWorkoutSheetProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const handleOption = (handler: () => void) => {
    onClose();
    handler();
  };

  const estimatedMinutes = todayWorkout
    ? Math.round(todayWorkout.exercises.length * 8)
    : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable={false} maxHeight={0.6}>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.lg }]}>
        Start a Workout
      </Text>

      {/* Program Workout Card */}
      {todayWorkout && activeProgram && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleOption(onStartProgramWorkout)}
          style={[
            styles.card,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={{ fontSize: 20 }}>🏋️</Text>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.labelLarge, { color: colors.textInverse }]}>
                {todayWorkout.name}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textInverse, opacity: 0.8, marginTop: 2 },
                ]}
              >
                From: {activeProgram.name}
              </Text>
            </View>
          </View>
          <View style={[styles.cardBottom, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textInverse, opacity: 0.8 }]}>
              {todayWorkout.exercises.length} exercises · ~{estimatedMinutes} min
            </Text>
            <View style={styles.actionRow}>
              <Text style={[typography.label, { color: colors.textInverse }]}>Start</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textInverse} style={{ marginLeft: 4 }} />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* AI Workout Card */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOption(onStartAIWorkout)}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            padding: spacing.md,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <Ionicons name="sparkles" size={20} color={AI_PURPLE} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>AI Workout</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              Describe what you want and iterate
            </Text>
          </View>
        </View>
        <View style={[styles.cardBottom, { marginTop: spacing.sm }]}>
          <View />
          <View style={styles.actionRow}>
            <Text style={[typography.label, { color: AI_PURPLE }]}>Generate</Text>
            <Ionicons name="arrow-forward" size={16} color={AI_PURPLE} style={{ marginLeft: 4 }} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Empty Workout Card */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOption(onStartEmptyWorkout)}
        style={[
          styles.card,
          {
            backgroundColor: 'transparent',
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            borderStyle: 'dashed',
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={{ fontSize: 20 }}>📝</Text>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>Empty Workout</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              Start from scratch, add exercises as you go
            </Text>
          </View>
        </View>
        <View style={[styles.cardBottom, { marginTop: spacing.sm }]}>
          <View />
          <View style={styles.actionRow}>
            <Text style={[typography.label, { color: colors.primary }]}>Start</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
          </View>
        </View>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {},
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
