import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { crossPlatformAlert } from '../../lib/cross-platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, typography } from '../../theme';
import { useWorkoutStore } from '../../stores/workout-store';
import { useProfileStore } from '../../stores/profile-store';
import { BottomSheet } from '../ui/BottomSheet';
import type { ActiveExercise } from '../../types/workout';

export interface ExerciseOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  exercise: ActiveExercise;
  onReplacePress?: () => void;
  onExerciseInfoPress?: () => void;
}

const ROW_HEIGHT = 56;
const ICON_SIZE = 24;

export function ExerciseOptionsSheet({
  visible,
  onClose,
  exercise,
  onReplacePress,
  onExerciseInfoPress,
}: ExerciseOptionsSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const addSet = useWorkoutStore((s) => s.addSet);
  const skipExercise = useWorkoutStore((s) => s.skipExercise);
  const removeExerciseFromSession = useWorkoutStore((s) => s.removeExerciseFromSession);
  const updateExerciseNotes = useWorkoutStore((s) => s.updateExerciseNotes);
  const updateExerciseRestTimerMode = useWorkoutStore((s) => s.updateExerciseRestTimerMode);
  const autoRestTimer = useWorkoutStore((s) => s.autoRestTimer);
  const unitPreference = useProfileStore((s) => s.profile.unitPreference);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [restExpanded, setRestExpanded] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes ?? '');
  const notesInputRef = useRef<TextInput>(null);

  // Sync notes text when exercise changes or sheet opens
  useEffect(() => {
    if (visible) {
      setNotesText(exercise.notes ?? '');
      setNotesExpanded(false);
    }
  }, [visible, exercise.id]);

  const saveNotes = () => {
    updateExerciseNotes(exercise.id, notesText.trim());
    setNotesExpanded(false);
  };

  const handleAddWarmupSet = () => {
    addSet(exercise.id, 'warmup');
    onClose();
  };

  const handleReplace = () => {
    onClose();
    // Small delay so sheet closes before modal opens
    setTimeout(() => onReplacePress?.(), 150);
  };

  const handleSkip = () => {
    crossPlatformAlert(
      'Skip Exercise',
      `Skip ${exercise.exerciseName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            skipExercise(exercise.id);
            onClose();
          },
        },
      ],
    );
  };

  const handleRemove = () => {
    crossPlatformAlert(
      'Remove Exercise',
      `Remove ${exercise.exerciseName} from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeExerciseFromSession(exercise.id);
            onClose();
          },
        },
      ],
    );
  };

  const handleExerciseInfo = () => {
    onClose();
    setTimeout(() => onExerciseInfoPress?.(), 150);
  };

  const separator = (
    <View style={[styles.separator, { backgroundColor: colors.border }]} />
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable={false} maxHeight={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text
          style={[styles.headerTitle, typography.h3, { color: colors.text }]}
          numberOfLines={1}
        >
          {exercise.exerciseName}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {separator}

      {/* Notes */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => {
          setNotesExpanded(true);
          setTimeout(() => notesInputRef.current?.focus(), 100);
        }}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="create-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Notes</Text>
        {!notesExpanded && exercise.notes ? (
          <Text style={[styles.rowHint, { color: colors.textTertiary }]} numberOfLines={1}>
            {exercise.notes}
          </Text>
        ) : null}
      </TouchableOpacity>

      {notesExpanded && (
        <View style={[styles.notesContainer, { paddingHorizontal: spacing.md }]}>
          <TextInput
            ref={notesInputRef}
            value={notesText}
            onChangeText={setNotesText}
            placeholder="Add notes for this exercise..."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[
              styles.notesInput,
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                borderColor: colors.border,
              },
            ]}
            onBlur={saveNotes}
          />
          <TouchableOpacity
            onPress={saveNotes}
            style={[styles.notesDoneButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.notesDoneText, { color: colors.textInverse }]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {separator}

      {/* Add Warm-up Set */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={handleAddWarmupSet}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="barbell-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Add Warm-up Set</Text>
      </TouchableOpacity>

      {separator}

      {/* Rest Timer */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => setRestExpanded(!restExpanded)}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="timer-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text, flex: 1 }]}>Rest Timer</Text>
        <Text style={[styles.rowHint, { color: colors.textTertiary, flex: 0 }]}>
          {exercise.restTimerMode === 'off' ? 'Off' : exercise.restTimerMode === 'custom' ? `${exercise.restTimerCustomSeconds}s` : 'Auto'}
        </Text>
        <Ionicons name={restExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textTertiary} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {restExpanded && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
          {(['auto', 'off', 'custom'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => {
                if (mode === 'custom') {
                  updateExerciseRestTimerMode(exercise.id, 'custom', exercise.restTimerCustomSeconds ?? exercise.restSeconds ?? 90);
                } else {
                  updateExerciseRestTimerMode(exercise.id, mode);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: (exercise.restTimerMode ?? 'auto') === mode ? colors.primaryMuted : 'transparent',
              }}
            >
              <Ionicons
                name={(exercise.restTimerMode ?? 'auto') === mode ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={(exercise.restTimerMode ?? 'auto') === mode ? colors.primary : colors.textTertiary}
              />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                {mode === 'auto' ? `Auto${autoRestTimer ? '' : ' (globally off)'}` : mode === 'off' ? 'Off for this exercise' : 'Custom duration'}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Custom duration presets - only show when custom is selected */}
          {(exercise.restTimerMode ?? 'auto') === 'custom' && (
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, paddingLeft: 28 }}>
              {[30, 60, 90, 120, 180].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  onPress={() => updateExerciseRestTimerMode(exercise.id, 'custom', sec)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: exercise.restTimerCustomSeconds === sec ? colors.primary : colors.surfaceSecondary,
                  }}
                >
                  <Text style={[typography.labelSmall, {
                    color: exercise.restTimerCustomSeconds === sec ? colors.textInverse : colors.text
                  }]}>
                    {sec >= 120 ? `${sec / 60}m` : `${sec}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {separator}

      {/* Units */}
      <View style={[styles.row, { paddingHorizontal: spacing.md }]}>
        <Ionicons name="swap-horizontal-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text, flex: 1 }]}>Units</Text>
        <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}>
          <TouchableOpacity
            onPress={() => updateProfile({ unitPreference: 'metric' })}
            style={[
              styles.segment,
              {
                borderRadius: radius.sm - 1,
                backgroundColor: unitPreference === 'metric' ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: unitPreference === 'metric' ? colors.textInverse : colors.textSecondary,
                  fontWeight: unitPreference === 'metric' ? '600' : '400',
                },
              ]}
            >
              kg
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => updateProfile({ unitPreference: 'imperial' })}
            style={[
              styles.segment,
              {
                borderRadius: radius.sm - 1,
                backgroundColor: unitPreference === 'imperial' ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: unitPreference === 'imperial' ? colors.textInverse : colors.textSecondary,
                  fontWeight: unitPreference === 'imperial' ? '600' : '400',
                },
              ]}
            >
              lb
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {separator}

      {/* Replace Exercise */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={handleReplace}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="repeat-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Replace Exercise</Text>
      </TouchableOpacity>

      {separator}

      {/* Skip Exercise */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={handleSkip}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="play-skip-forward-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Skip Exercise</Text>
      </TouchableOpacity>

      {separator}

      {/* Remove from Workout */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={handleRemove}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="trash-outline" size={ICON_SIZE} color={colors.error} />
        <Text style={[styles.rowText, { color: colors.error }]}>Remove from Workout</Text>
      </TouchableOpacity>

      {separator}

      {/* Exercise Info */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={handleExerciseInfo}
        style={[styles.row, { paddingHorizontal: spacing.md }]}
      >
        <Ionicons name="information-circle-outline" size={ICON_SIZE} color={colors.textSecondary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Exercise Info</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerSpacer: {
    width: 34,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 34,
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    gap: 12,
  },
  rowText: {
    ...typography.bodyLarge,
  },
  rowHint: {
    flex: 1,
    ...typography.bodySmall,
    textAlign: 'right',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  notesContainer: {
    paddingBottom: 8,
    gap: 8,
  },
  notesInput: {
    minHeight: 72,
    padding: 12,
    ...typography.body,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  notesDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  notesDoneText: {
    ...typography.label,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 2,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  segmentText: {
    ...typography.label,
  },
});
