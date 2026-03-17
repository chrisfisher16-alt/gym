import { useCallback, useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { WorkoutProgramLocal, WorkoutDayLocal } from '../types/workout';
import { generateId } from '../lib/workout-utils';

export function useWorkoutPrograms() {
  const programs = useWorkoutStore((s) => s.programs);
  const addProgram = useWorkoutStore((s) => s.addProgram);
  const updateProgram = useWorkoutStore((s) => s.updateProgram);
  const deleteProgram = useWorkoutStore((s) => s.deleteProgram);
  const setActiveProgram = useWorkoutStore((s) => s.setActiveProgram);

  const activeProgram = useMemo(
    () => programs.find((p) => p.isActive) ?? null,
    [programs],
  );

  const inactivePrograms = useMemo(
    () => programs.filter((p) => !p.isActive),
    [programs],
  );

  const getTodayWorkout = useCallback((): WorkoutDayLocal | null => {
    if (!activeProgram) return null;
    const dayOfWeek = new Date().getDay(); // 0-6
    // Map to 1-based day number, wrapping around program length
    const dayNumber = ((dayOfWeek === 0 ? 7 : dayOfWeek) % activeProgram.days.length) + 1;
    return activeProgram.days.find((d) => d.dayNumber === dayNumber) ?? activeProgram.days[0] ?? null;
  }, [activeProgram]);

  const createProgram = useCallback(
    (data: {
      name: string;
      description: string;
      daysPerWeek: number;
      difficulty: WorkoutProgramLocal['difficulty'];
      days: Omit<WorkoutDayLocal, 'id' | 'programId'>[];
    }) => {
      const programId = generateId('prog');
      const program: WorkoutProgramLocal = {
        id: programId,
        userId: 'local_user',
        name: data.name,
        description: data.description,
        daysPerWeek: data.daysPerWeek,
        difficulty: data.difficulty,
        days: data.days.map((d, i) => ({
          ...d,
          id: generateId('day'),
          programId,
        })),
        isActive: false,
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addProgram(program);
      return program;
    },
    [addProgram],
  );

  return {
    programs,
    activeProgram,
    inactivePrograms,
    getTodayWorkout,
    createProgram,
    updateProgram,
    deleteProgram,
    setActiveProgram,
  };
}
