import { useState, useMemo, useCallback } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { ExerciseLibraryEntry, MuscleGroup, Equipment } from '../types/workout';
import { generateId } from '../lib/workout-utils';

export function useExerciseLibrary() {
  const exercises = useWorkoutStore((s) => s.exercises);
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleGroup | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const filteredExercises = useMemo(() => {
    let result = exercises;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.primaryMuscles.some((m) => m.toLowerCase().includes(query)) ||
          e.category.toLowerCase().includes(query),
      );
    }

    if (selectedCategory) {
      result = result.filter((e) => e.category === selectedCategory);
    }

    if (selectedEquipment) {
      result = result.filter((e) => e.equipment === selectedEquipment);
    }

    return result;
  }, [exercises, searchQuery, selectedCategory, selectedEquipment]);

  const getExerciseById = useCallback(
    (id: string): ExerciseLibraryEntry | null => {
      return exercises.find((e) => e.id === id) ?? null;
    },
    [exercises],
  );

  const createCustomExercise = useCallback(
    (data: {
      name: string;
      category: MuscleGroup;
      primaryMuscles: string[];
      secondaryMuscles: string[];
      equipment: Equipment;
      instructions: string[];
    }) => {
      const exercise: ExerciseLibraryEntry = {
        id: generateId('custom'),
        name: data.name,
        category: data.category,
        primaryMuscles: data.primaryMuscles,
        secondaryMuscles: data.secondaryMuscles,
        equipment: data.equipment,
        instructions: data.instructions,
        isCustom: true,
        defaultSets: 3,
        defaultReps: '8-12',
        defaultRestSeconds: 90,
      };
      addCustomExercise(exercise);
      return exercise;
    },
    [addCustomExercise],
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedEquipment(null);
  }, []);

  return {
    exercises: filteredExercises,
    allExercises: exercises,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedEquipment,
    setSelectedEquipment,
    clearFilters,
    getExerciseById,
    createCustomExercise,
  };
}
