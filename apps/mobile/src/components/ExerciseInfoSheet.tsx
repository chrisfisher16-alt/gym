import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { BottomSheet, Badge, Overline } from './ui';
import { ExerciseIllustration } from './ExerciseIllustration';
import { ExerciseImageViewer } from './workout/ExerciseImageViewer';
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '../lib/exercise-data';
import { getLastPerformance } from '../lib/suggested-load';
import { useWorkoutStore } from '../stores/workout-store';
import { useProfileStore } from '../stores/profile-store';
import type { ExerciseLibraryEntry } from '../types/workout';

interface ExerciseInfoSheetProps {
  visible: boolean;
  exercise: ExerciseLibraryEntry | null;
  onClose: () => void;
}

export function ExerciseInfoSheet({ visible, exercise, onClose }: ExerciseInfoSheetProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';

  const lastPerf = useMemo(
    () => (exercise ? getLastPerformance(exercise.id, history, unit) : null),
    [exercise?.id, history, unit],
  );

  // Recent sessions for this exercise (mini history)
  const recentSessions = useMemo(() => {
    if (!exercise) return [];
    return history
      .filter((s) => s.exercises.some((e) => e.exerciseId === exercise.id))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 3)
      .map((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === exercise.id)!;
        const workingSets = ex.sets.filter((set) => set.setType === 'working');
        if (workingSets.length === 0) return null;
        const topSet = workingSets.reduce(
          (best, set) => ((set.weight ?? 0) > (best.weight ?? 0) ? set : best),
          workingSets[0],
        );
        return {
          date: new Date(s.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sets: workingSets.length,
          topWeight: topSet?.weight,
          topReps: topSet?.reps,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
  }, [exercise?.id, history]);

  const handleWatchVideo = () => {
    if (!exercise) return;
    const query = encodeURIComponent(`how to do ${exercise.name} proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  };

  if (!exercise) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <Text style={[typography.h2, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Exercise Image Viewer */}
      <ExerciseImageViewer
        exerciseId={exercise.id}
        size="detail"
        style={{ marginBottom: 16 }}
      />

      {/* Illustration + Quick Info */}
      <View style={[styles.heroRow, { marginBottom: spacing.lg, marginTop: spacing.base }]}>
        <ExerciseIllustration
          exerciseId={exercise.id}
          category={exercise.category}
          equipment={exercise.equipment}
          primaryMuscles={exercise.primaryMuscles}
          size="large"
        />
        <View style={{ flex: 1, marginLeft: spacing.base }}>
          <View style={[styles.infoRow, { marginBottom: spacing.sm }]}>
            <Ionicons name="fitness-outline" size={16} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.xs }]}>
              {EQUIPMENT_LABELS[exercise.equipment]}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginBottom: spacing.sm }]}>
            <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.xs }]}>
              {exercise.defaultSets} sets x {exercise.defaultReps} reps
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="timer-outline" size={16} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.xs }]}>
              {exercise.defaultRestSeconds}s rest
            </Text>
          </View>
        </View>
      </View>

      {/* Target Muscles */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
          Target Muscles
        </Text>
        <View style={[styles.muscleSection, { marginBottom: spacing.xs }]}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary, width: 70 }]}>
            Primary
          </Text>
          <View style={styles.badgeRow}>
            {exercise.primaryMuscles.map((m) => (
              <Badge key={m} label={m} variant="info" />
            ))}
          </View>
        </View>
        {exercise.secondaryMuscles.length > 0 && (
          <View style={styles.muscleSection}>
            <Text style={[typography.labelSmall, { color: colors.textTertiary, width: 70 }]}>
              Secondary
            </Text>
            <View style={styles.badgeRow}>
              {exercise.secondaryMuscles.map((m) => (
                <Badge key={m} label={m} variant="default" />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Form Instructions */}
      {exercise.instructions.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Overline style={{ marginBottom: spacing.sm }}>Instructions</Overline>
          {exercise.instructions.map((step, i) => (
            <View key={`step-${i}`} style={[styles.instructionRow, { marginBottom: spacing.sm }]}>
              <View
                style={[
                  styles.stepNumber,
                  {
                    backgroundColor: colors.primaryMuted,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[typography.labelSmall, { color: colors.primary }]}>
                  {i + 1}
                </Text>
              </View>
              <Text
                style={[
                  typography.body,
                  { color: colors.text, flex: 1, marginLeft: spacing.sm },
                ]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Tips */}
      {exercise.tips && exercise.tips.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Overline style={{ marginBottom: spacing.sm }}>Tips</Overline>
          <View
            style={[
              styles.tipsCard,
              {
                backgroundColor: colors.warningLight,
                borderRadius: radius.lg,
                padding: spacing.base,
              },
            ]}
          >
            <View style={[styles.infoRow, { marginBottom: spacing.sm }]}>
              <Ionicons name="bulb-outline" size={18} color={colors.warning} />
              <Text style={[typography.label, { color: colors.warning, marginLeft: spacing.xs }]}>
                Tips
              </Text>
            </View>
            {exercise.tips.map((tip, i) => (
              <Text
                key={`tip-${i}`}
                style={[
                  typography.body,
                  { color: colors.text, marginBottom: i < exercise.tips!.length - 1 ? spacing.xs : 0 },
                ]}
              >
                {tip}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Watch Form Video */}
      <TouchableOpacity
        onPress={handleWatchVideo}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Watch form video on YouTube"
        style={[
          styles.videoButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
            borderRadius: radius.lg,
            padding: spacing.base,
            marginBottom: spacing.lg,
          },
        ]}
      >
        <Ionicons name="logo-youtube" size={24} color="#FF0000" />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.label, { color: colors.text }]}>Watch Form Video</Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            Opens YouTube
          </Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Your History */}
      {recentSessions.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Overline style={{ marginBottom: spacing.sm }}>History</Overline>
          {recentSessions.map((session, i) => (
            <View
              key={`history-${session.date}`}
              style={[
                styles.historyRow,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.textTertiary, width: 55 }]}>
                {session.date}
              </Text>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                {session.topWeight != null && session.topReps != null
                  ? `${session.topWeight} ${unit} x ${session.topReps}`
                  : session.topReps != null
                    ? `${session.topReps} reps`
                    : `${session.sets} sets`}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {session.sets} sets
              </Text>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muscleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsCard: {},
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
