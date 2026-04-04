import { useCallback, useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { WorkoutProgramLocal, WorkoutDayLocal } from '../types/workout';
import { generateId } from '../lib/workout-utils';

function getStartOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

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

    const history = useWorkoutStore.getState().history;
    const startOfWeek = getStartOfWeek();

    // Find which program dayIds have been completed this week
    const completedDayIds = new Set<string>();
    for (const session of history) {
      if (session.programId !== activeProgram.id) continue;
      if (!session.dayId) continue;
      if (new Date(session.completedAt) < startOfWeek) break; // history is sorted newest-first
      completedDayIds.add(session.dayId);
    }

    // Only consider lifting days (skip rest, mobility, cardio, active_recovery)
    const liftingDays = activeProgram.days.filter((d) => d.dayType === 'lifting');

    // Find the first uncompleted lifting day
    const nextDay = liftingDays.find((d) => !completedDayIds.has(d.id));

    // If all lifting days done this week, return null
    if (!nextDay) return null;

    return nextDay;
  }, [activeProgram]);

  const weeklyProgress = useMemo(() => {
    if (!activeProgram) return null;

    const history = useWorkoutStore.getState().history;
    const startOfWeek = getStartOfWeek();

    const liftingDays = activeProgram.days.filter((d) => d.dayType === 'lifting');
    const completedDayIds = new Set<string>();

    for (const session of history) {
      if (session.programId !== activeProgram.id || !session.dayId) continue;
      if (new Date(session.completedAt) < startOfWeek) break;
      completedDayIds.add(session.dayId);
    }

    const completedThisWeek = liftingDays.filter((d) => completedDayIds.has(d.id)).length;
    const totalLiftingDays = liftingDays.length;
    const allComplete = completedThisWeek >= totalLiftingDays;

    return { completedThisWeek, totalLiftingDays, allComplete };
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
    weeklyProgress,
    createProgram,
    updateProgram,
    deleteProgram,
    setActiveProgram,
  };
}
