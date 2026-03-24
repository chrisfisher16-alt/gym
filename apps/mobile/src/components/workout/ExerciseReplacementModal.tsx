import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useWorkoutStore } from '../../stores/workout-store';
import { Badge } from '../ui';
import { getSuggestedReplacements } from '../../lib/exercise-replacement';
import { EQUIPMENT_LABELS } from '../../lib/exercise-data';
import { ExerciseIllustration } from '../ExerciseIllustration';
import type { ActiveExercise, ExerciseLibraryEntry } from '../../types/workout';
import { crossPlatformAlert } from '../../lib/cross-platform-alert';

export interface ExerciseReplacementModalProps {
  visible: boolean;
  exercise: ActiveExercise | null;
  onClose: () => void;
  onSelect: (newExercise: ExerciseLibraryEntry) => void;
}

export function ExerciseReplacementModal({
  visible,
  exercise,
  onClose,
  onSelect,
}: ExerciseReplacementModalProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const allExercises = useWorkoutStore((s) => s.exercises);

  const handleSelect = (ex: ExerciseLibraryEntry) => {
    crossPlatformAlert(
      'Replace Exercise',
      `Replace ${exercise?.exerciseName} with ${ex.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          onPress: () => {
            onSelect(ex);
            onClose();
          },
        },
      ],
    );
  };

  if (!exercise) return null;

  const currentLib = allExercises.find((e) => e.id === exercise.exerciseId);
  if (!currentLib) return null;

  const groups = getSuggestedReplacements(currentLib, allExercises);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.modalHeader, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            Replace {exercise.exerciseName}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.label} style={{ marginTop: spacing.base }}>
              <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
                {group.label}
              </Text>
              {group.exercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleSelect(ex)}
                  style={[
                    styles.replacementItem,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.xs,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <ExerciseIllustration
                    exerciseId={ex.id}
                    category={ex.category}
                    equipment={ex.equipment}
                    primaryMuscles={ex.primaryMuscles}
                    size="small"
                    style={{ marginRight: spacing.sm }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>{ex.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Badge label={EQUIPMENT_LABELS[ex.equipment]} variant="default" />
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {ex.primaryMuscles.join(', ')}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {groups.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No replacement exercises found</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  replacementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
