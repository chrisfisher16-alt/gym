import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { useActiveWorkout } from '../../../src/hooks/useActiveWorkout';
import { Card, Badge, Button } from '../../../src/components/ui';

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { programs, setActiveProgram, deleteProgram } = useWorkoutPrograms();
  const { startWorkout, isActive } = useActiveWorkout();

  const program = programs.find((p) => p.id === id);

  if (!program) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Program not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleStartDay = (dayIndex: number) => {
    if (isActive) {
      Alert.alert('Workout in Progress', 'Please finish or cancel your current workout first.');
      return;
    }

    const day = program.days[dayIndex];
    startWorkout({
      name: `${program.name} — ${day.name}`,
      programId: program.id,
      dayId: day.id,
      exercises: day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        supersetGroupId: e.supersetGroupId,
      })),
    });
    router.push('/workout/active');
  };

  const handleDelete = () => {
    Alert.alert('Delete Program', `Are you sure you want to delete "${program.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProgram(program.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
          {program.name}
        </Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.metaRow}>
            <Badge label={`${program.daysPerWeek} days/week`} variant="info" />
            <Badge
              label={program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1)}
              variant="default"
            />
            {program.createdBy === 'ai' && <Badge label="AI Generated" variant="pro" />}
          </View>
          {program.description ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {program.description}
            </Text>
          ) : null}
          {!program.isActive && (
            <Button
              title="Set as Active Program"
              variant="secondary"
              size="md"
              onPress={() => setActiveProgram(program.id)}
              style={{ marginTop: spacing.md }}
            />
          )}
        </Card>

        {/* Days */}
        {program.days.map((day, dayIndex) => (
          <Card key={day.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                <Text style={[typography.labelLarge, { color: colors.text }]}>{day.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleStartDay(dayIndex)}
                style={[
                  styles.startButton,
                  { backgroundColor: colors.primary, borderRadius: radius.md },
                ]}
              >
                <Ionicons name="play" size={16} color={colors.textInverse} />
                <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>
                  Start
                </Text>
              </TouchableOpacity>
            </View>

            {day.exercises.map((exercise, exIndex) => (
              <View
                key={exercise.id}
                style={[
                  styles.exerciseRow,
                  {
                    paddingVertical: spacing.sm,
                    borderTopWidth: exIndex === 0 ? 1 : 0,
                    borderBottomWidth: 1,
                    borderColor: colors.borderLight,
                    marginTop: exIndex === 0 ? spacing.md : 0,
                  },
                ]}
              >
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                  {exercise.exerciseName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {exercise.targetSets} × {exercise.targetReps}
                </Text>
              </View>
            ))}
          </Card>
        ))}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
