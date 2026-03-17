import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useExerciseLibrary } from '../../src/hooks/useExerciseLibrary';
import { Button } from '../../src/components/ui';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../../src/lib/exercise-data';
import type { MuscleGroup, Equipment } from '../../src/types/workout';

const CATEGORIES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body'];
const EQUIPMENT_LIST: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band'];

export default function CreateExerciseScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { createCustomExercise } = useExerciseLibrary();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [primaryMuscles, setPrimaryMuscles] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    createCustomExercise({
      name: name.trim(),
      category,
      primaryMuscles: primaryMuscles
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      secondaryMuscles: secondaryMuscles
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      equipment,
      instructions: instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
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
          Create Exercise
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.base }]}>
          Name *
        </Text>
        <TextInput
          style={[
            styles.textInput,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            },
          ]}
          placeholder="Exercise name"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        {/* Category */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Category
        </Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.chip,
                {
                  backgroundColor: category === cat ? colors.primary : colors.surface,
                  borderColor: category === cat ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: category === cat ? colors.textInverse : colors.text },
                ]}
              >
                {MUSCLE_GROUP_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Equipment */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Equipment
        </Text>
        <View style={styles.chipGrid}>
          {EQUIPMENT_LIST.map((eq) => (
            <TouchableOpacity
              key={eq}
              onPress={() => setEquipment(eq)}
              style={[
                styles.chip,
                {
                  backgroundColor: equipment === eq ? colors.primary : colors.surface,
                  borderColor: equipment === eq ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: equipment === eq ? colors.textInverse : colors.text },
                ]}
              >
                {EQUIPMENT_LABELS[eq]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Primary Muscles */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Primary Muscles
        </Text>
        <TextInput
          style={[
            styles.textInput,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            },
          ]}
          placeholder="e.g. Chest, Triceps (comma separated)"
          placeholderTextColor={colors.textTertiary}
          value={primaryMuscles}
          onChangeText={setPrimaryMuscles}
        />

        {/* Secondary Muscles */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Secondary Muscles
        </Text>
        <TextInput
          style={[
            styles.textInput,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            },
          ]}
          placeholder="e.g. Shoulders, Core (comma separated)"
          placeholderTextColor={colors.textTertiary}
          value={secondaryMuscles}
          onChangeText={setSecondaryMuscles}
        />

        {/* Instructions */}
        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
          Instructions
        </Text>
        <TextInput
          style={[
            styles.textArea,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            },
          ]}
          placeholder="One step per line"
          placeholderTextColor={colors.textTertiary}
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <View style={{ marginTop: spacing.xl }}>
          <Button title="Create Exercise" onPress={handleSave} />
        </View>
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
  textArea: {
    borderWidth: 1,
    minHeight: 120,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
