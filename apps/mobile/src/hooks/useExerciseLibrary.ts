import { useState, useMemo, useCallback } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { ExerciseLibraryEntry, MuscleGroup, Equipment } from '../types/workout';
import { generateId } from '../lib/workout-utils';

export type ForceFilter = 'push' | 'pull' | 'static';
export type MechanicFilter = 'compound' | 'isolation';
export type LevelFilter = 'beginner' | 'intermediate' | 'expert';

export function useExerciseLibrary() {
  const exercises = useWorkoutStore((s) => s.exercises);
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleGroup | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedForce, setSelectedForce] = useState<ForceFilter | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<MechanicFilter | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter | null>(null);

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

    if (selectedForce) {
      result = result.filter((e) => !e.force || e.force === selectedForce);
    }

    if (selectedMechanic) {
      result = result.filter((e) => !e.mechanic || e.mechanic === selectedMechanic);
    }

    if (selectedLevel) {
      result = result.filter((e) => !e.level || e.level === selectedLevel);
    }

    return result;
  }, [exercises, searchQuery, selectedCategory, selectedEquipment, selectedForce, selectedMechanic, selectedLevel]);

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
    setSelectedForce(null);
    setSelectedMechanic(null);
    setSelectedLevel(null);
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
    selectedForce,
    setSelectedForce,
    selectedMechanic,
    setSelectedMechanic,
    selectedLevel,
    setSelectedLevel,
    clearFilters,
    getExerciseById,
    createCustomExercise,
  };
}
