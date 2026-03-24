import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { crossPlatformAlert } from '../../../src/lib/cross-platform-alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { useExerciseLibrary } from '../../../src/hooks/useExerciseLibrary';
import { Button, Card } from '../../../src/components/ui';
import { MUSCLE_GROUP_LABELS } from '../../../src/lib/exercise-data';
import { generateId } from '../../../src/lib/workout-utils';
import type { MuscleGroup, WorkoutDayLocal, ProgramExercise, WorkoutProgramLocal } from '../../../src/types/workout';

const FOCUS_AREAS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'full_body'];
const DIFFICULTIES: WorkoutProgramLocal['difficulty'][] = ['beginner', 'intermediate', 'advanced'];

interface DayDraft {
  name: string;
  focusArea: MuscleGroup;
  exercises: ProgramExercise[];
}

export default function CreateProgramScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { createProgram } = useWorkoutPrograms();
  const { allExercises } = useExerciseLibrary();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [difficulty, setDifficulty] = useState<WorkoutProgramLocal['difficulty']>('intermediate');
  const [days, setDays] = useState<DayDraft[]>([
    { name: 'Day 1', focusArea: 'chest', exercises: [] },
  ]);
  const [showExercisePicker, setShowExercisePicker] = useState<number | null>(null);

  const addDay = () => {
    setDays([...days, { name: `Day ${days.length + 1}`, focusArea: 'back', exercises: [] }]);
  };

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index));
  };

  const updateDay = (index: number, updates: Partial<DayDraft>) => {
    setDays(days.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };

  const addExerciseToDay = (dayIndex: number, exerciseId: string) => {
    const exercise = allExercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    const day = days[dayIndex];
    const pe: ProgramExercise = {
      id: generateId('pe'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetSets: exercise.defaultSets,
      targetReps: exercise.defaultReps,
      restSeconds: exercise.defaultRestSeconds,
      order: day.exercises.length,
    };

    updateDay(dayIndex, { exercises: [...day.exercises, pe] });
    setShowExercisePicker(null);
  };

  const removeExerciseFromDay = (dayIndex: number, exerciseIndex: number) => {
    const day = days[dayIndex];
    updateDay(dayIndex, {
      exercises: day.exercises.filter((_, i) => i !== exerciseIndex),
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      crossPlatformAlert('Error', 'Please enter a program name');
      return;
    }
    if (days.length === 0) {
      crossPlatformAlert('Error', 'Please add at least one day');
      return;
    }

    createProgram({
      name: name.trim(),
      description: description.trim(),
      daysPerWeek,
      difficulty,
      days: days.map((d, i) => ({
        dayNumber: i + 1,
        name: d.name,
        dayType: 'lifting' as const,
        focusArea: d.focusArea,
        exercises: d.exercises,
      })),
    });

    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Create Program
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Program Name */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.base }]}>
          Program Name *
        </Text>
        <TextInput
          style={[
            styles.textInput,
            typography.body,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
          ]}
          placeholder="e.g. My Training Plan"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        {/* Description */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Description
        </Text>
        <TextInput
          style={[
            styles.textInput,
            typography.body,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
          ]}
          placeholder="Optional description"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
        />

        {/* Days Per Week */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Days Per Week
        </Text>
        <View style={styles.numberRow}>
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setDaysPerWeek(n)}
              style={[
                styles.numberChip,
                {
                  backgroundColor: daysPerWeek === n ? colors.primary : colors.surface,
                  borderColor: daysPerWeek === n ? colors.primary : colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  { color: daysPerWeek === n ? colors.textInverse : colors.text },
                ]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Difficulty */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Difficulty
        </Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDifficulty(d)}
              style={[
                styles.chip,
                {
                  backgroundColor: difficulty === d ? colors.primary : colors.surface,
                  borderColor: difficulty === d ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: difficulty === d ? colors.textInverse : colors.text, textTransform: 'capitalize' },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Days */}
        <Text style={[typography.labelLarge, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
          Workout Days
        </Text>

        {days.map((day, dayIndex) => (
          <Card key={dayIndex} style={{ marginBottom: spacing.md }}>
            <View style={styles.dayHeaderRow}>
              <TextInput
                style={[typography.labelLarge, { color: colors.text, flex: 1 }]}
                value={day.name}
                onChangeText={(text: string) => updateDay(dayIndex, { name: text })}
                placeholder="Day name"
                placeholderTextColor={colors.textTertiary}
              />
              {days.length > 1 && (
                <TouchableOpacity onPress={() => removeDay(dayIndex)}>
                  <Ionicons name="close-circle" size={22} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>

            {/* Focus Area */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
            >
              {FOCUS_AREAS.map((fa) => (
                <TouchableOpacity
                  key={fa}
                  onPress={() => updateDay(dayIndex, { focusArea: fa })}
                  style={[
                    styles.miniChip,
                    {
                      backgroundColor: day.focusArea === fa ? colors.primaryMuted : colors.surfaceSecondary,
                      borderRadius: radius.sm,
                      marginRight: spacing.xs,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: day.focusArea === fa ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {MUSCLE_GROUP_LABELS[fa]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Exercises in day */}
            {day.exercises.map((ex, exIndex) => (
              <View
                key={ex.id}
                style={[styles.exerciseInDay, { borderBottomColor: colors.borderLight }]}
              >
                <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {ex.exerciseName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginRight: spacing.sm }]}>
                  {ex.targetSets}×{ex.targetReps}
                </Text>
                <TouchableOpacity onPress={() => removeExerciseFromDay(dayIndex, exIndex)}>
                  <Ionicons name="remove-circle-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Exercise picker inline */}
            {showExercisePicker === dayIndex ? (
              <View style={{ marginTop: spacing.sm }}>
                <ScrollView style={{ maxHeight: 200 }}>
                  {allExercises
                    .filter((e) => e.category === day.focusArea || day.focusArea === 'full_body')
                    .slice(0, 20)
                    .map((ex) => (
                      <TouchableOpacity
                        key={ex.id}
                        onPress={() => addExerciseToDay(dayIndex, ex.id)}
                        style={[styles.pickerItem, { borderBottomColor: colors.borderLight }]}
                      >
                        <Text style={[typography.body, { color: colors.primary }]}>{ex.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setShowExercisePicker(null)}>
                  <Text style={[typography.labelSmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowExercisePicker(dayIndex)}
                style={[styles.addExerciseBtn, { marginTop: spacing.sm }]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.xs }]}>
                  Add Exercise
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        ))}

        <TouchableOpacity
          onPress={addDay}
          style={[
            styles.addDayBtn,
            { borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.xl },
          ]}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Add Day</Text>
        </TouchableOpacity>

        <Button title="Save Program" onPress={handleSave} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  textInput: {
    borderWidth: 1,
    minHeight: 48,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numberChip: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pickerItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
