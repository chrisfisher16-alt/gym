import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WorkoutProgramLocal,
  ActiveWorkoutSession,
  ActiveExercise,
  ActiveSet,
  CompletedSession,
  ExerciseLibraryEntry,
  PersonalRecord,
  SupersetGroup,
} from '../types/workout';
import { EXERCISE_LIBRARY, getSeedPrograms } from '../lib/exercise-data';
import {
  generateId,
  checkForPR,
  updatePersonalRecord,
  activeToCompleted,
} from '../lib/workout-utils';

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  ACTIVE_SESSION: '@workout/active_session',
  HISTORY: '@workout/history',
  PROGRAMS: '@workout/programs',
  EXERCISES: '@workout/exercises',
  PERSONAL_RECORDS: '@workout/personal_records',
  DEFAULT_REST_SECONDS: '@workout/default_rest_seconds',
  PROGRAM_COMPLETIONS: '@workout/program_completions',
} as const;

// ── State ───────────────────────────────────────────────────────────

export interface ProgramProgress {
  totalDays: number;
  completedDays: number;
  completedDayIds: string[];
  percentComplete: number;
}

interface WorkoutState {
  // Data
  programs: WorkoutProgramLocal[];
  activeSession: ActiveWorkoutSession | null;
  history: CompletedSession[];
  exercises: ExerciseLibraryEntry[];
  personalRecords: Record<string, PersonalRecord>;
  defaultRestSeconds: number;
  programCompletions: Record<string, string>; // programId → completionDate
  isInitialized: boolean;

  // Actions - Initialization
  initialize: () => Promise<void>;

  // Actions - Programs
  addProgram: (program: WorkoutProgramLocal) => void;
  updateProgram: (program: WorkoutProgramLocal) => void;
  deleteProgram: (programId: string) => void;
  setActiveProgram: (programId: string) => void;

  // Actions - Workout Session
  startWorkout: (params: {
    name: string;
    programId?: string;
    dayId?: string;
    exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      targetSets: number;
      targetReps: string;
      restSeconds: number;
      supersetGroupId?: string;
    }>;
  }) => void;
  startEmptyWorkout: () => void;

  // Actions - Set Management
  logSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number) => void;
  completeSet: (exerciseInstanceId: string, setId: string) => void;
  updateSetRPE: (exerciseInstanceId: string, setId: string, rpe: number) => void;
  removeSet: (exerciseInstanceId: string, setId: string) => void;
  addSet: (exerciseInstanceId: string, setType?: 'working' | 'warmup' | 'drop' | 'failure') => void;

  // Actions - Exercise Management in Active Session
  addExerciseToSession: (exercise: ExerciseLibraryEntry, targetSets?: number) => void;
  removeExerciseFromSession: (exerciseInstanceId: string) => void;
  skipExercise: (exerciseInstanceId: string) => void;
  reorderExercises: (orderedIds: string[]) => void;
  setCurrentExerciseIndex: (index: number) => void;

  // Actions - Exercise Replacement
  replaceExercise: (exerciseInstanceId: string, newExercise: ExerciseLibraryEntry) => void;

  // Actions - Per-Exercise Rest Time
  updateExerciseRestTime: (exerciseInstanceId: string, seconds: number) => void;

  // Actions - Timed Sets
  logTimedSet: (exerciseInstanceId: string, setId: string, durationSeconds: number) => void;

  // Actions - Superset
  createSuperset: (exerciseInstanceIds: string[]) => void;
  removeSuperset: (exerciseInstanceId: string) => void;
  createSupersetGroup: (exerciseInstanceIds: string[]) => void;
  removeSupersetGroup: (groupId: string) => void;

  // Actions - Rest Timer
  startRestTimer: (durationSeconds: number) => void;
  clearRestTimer: () => void;
  setDefaultRestSeconds: (seconds: number) => void;

  // Actions - Workout Completion
  completeWorkout: () => CompletedSession | null;
  cancelWorkout: () => void;

  // Actions - Session Metadata
  updateSessionNotes: (notes: string) => void;
  updateSessionMood: (mood: number) => void;
  updateSessionName: (name: string) => void;

  // Actions - Program Progress
  getProgramProgress: (programId: string) => ProgramProgress;
  markProgramCompleted: (programId: string) => void;

  // Actions - Custom Exercise
  addCustomExercise: (exercise: ExerciseLibraryEntry) => void;

  // Actions - Persistence
  persistActiveSession: () => Promise<void>;
}

// ── Store ───────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  programs: [],
  activeSession: null,
  history: [],
  exercises: [],
  personalRecords: {},
  defaultRestSeconds: 90,
  programCompletions: {},
  isInitialized: false,

  // ── Initialize ──────────────────────────────────────────────────

  initialize: async () => {
    try {
      const [
        storedSession,
        storedHistory,
        storedPrograms,
        storedExercises,
        storedRecords,
        storedDefaultRest,
        storedProgramCompletions,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.PROGRAMS),
        AsyncStorage.getItem(STORAGE_KEYS.EXERCISES),
        AsyncStorage.getItem(STORAGE_KEYS.PERSONAL_RECORDS),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_REST_SECONDS),
        AsyncStorage.getItem(STORAGE_KEYS.PROGRAM_COMPLETIONS),
      ]);

      const baseExercises = [...EXERCISE_LIBRARY];
      const customExercises: ExerciseLibraryEntry[] = storedExercises
        ? JSON.parse(storedExercises)
        : [];
      const allExercises = [...baseExercises, ...customExercises];

      const programs: WorkoutProgramLocal[] = storedPrograms
        ? JSON.parse(storedPrograms)
        : getSeedPrograms('local_user');

      const history: CompletedSession[] = storedHistory
        ? JSON.parse(storedHistory)
        : [];

      const personalRecords: Record<string, PersonalRecord> = storedRecords
        ? JSON.parse(storedRecords)
        : {};

      const activeSession: ActiveWorkoutSession | null = storedSession
        ? JSON.parse(storedSession)
        : null;

      const defaultRestSeconds = storedDefaultRest
        ? parseInt(storedDefaultRest, 10)
        : 90;

      const programCompletions: Record<string, string> = storedProgramCompletions
        ? JSON.parse(storedProgramCompletions)
        : {};

      set({
        exercises: allExercises,
        programs,
        history,
        personalRecords,
        activeSession,
        defaultRestSeconds: isNaN(defaultRestSeconds) ? 90 : defaultRestSeconds,
        programCompletions,
        isInitialized: true,
      });

      // Persist seed programs if they weren't stored yet
      if (!storedPrograms) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      }
    } catch (error) {
      // Fallback to defaults
      set({
        exercises: [...EXERCISE_LIBRARY],
        programs: getSeedPrograms('local_user'),
        history: [],
        personalRecords: {},
        programCompletions: {},
        activeSession: null,
        isInitialized: true,
      });
    }
  },

  // ── Programs ────────────────────────────────────────────────────

  addProgram: (program) => {
    set((state) => {
      const programs = [...state.programs, program];
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      return { programs };
    });
  },

  updateProgram: (program) => {
    set((state) => {
      const programs = state.programs.map((p) =>
        p.id === program.id ? program : p,
      );
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      return { programs };
    });
  },

  deleteProgram: (programId) => {
    set((state) => {
      const programs = state.programs.filter((p) => p.id !== programId);
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      return { programs };
    });
  },

  setActiveProgram: (programId) => {
    set((state) => {
      const programs = state.programs.map((p) => ({
        ...p,
        isActive: p.id === programId,
      }));
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      return { programs };
    });
  },

  // ── Workout Session ─────────────────────────────────────────────

  startWorkout: ({ name, programId, dayId, exercises }) => {
    const session: ActiveWorkoutSession = {
      id: generateId('ws'),
      programId,
      dayId,
      name,
      startedAt: new Date().toISOString(),
      exercises: exercises.map((e, index) => {
        const libExercise = get().exercises.find((ex) => ex.id === e.exerciseId);
        return {
          id: generateId('ae'),
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          sets: Array.from({ length: e.targetSets }, (_, i) => ({
            id: generateId('set'),
            setNumber: i + 1,
            setType: 'working' as const,
            isCompleted: false,
            isPR: false,
          })),
          supersetGroupId: e.supersetGroupId,
          isTimeBased: libExercise?.isTimeBased,
          defaultDurationSeconds: libExercise?.defaultDurationSeconds,
          restSeconds: e.restSeconds,
          isSkipped: false,
          order: index,
        };
      }),
      currentExerciseIndex: 0,
      notes: '',
    };

    set({ activeSession: session });
    get().persistActiveSession();
  },

  startEmptyWorkout: () => {
    const session: ActiveWorkoutSession = {
      id: generateId('ws'),
      name: 'Quick Workout',
      startedAt: new Date().toISOString(),
      exercises: [],
      currentExerciseIndex: 0,
      notes: '',
    };

    set({ activeSession: session });
    get().persistActiveSession();
  },

  // ── Set Management ──────────────────────────────────────────────

  logSet: (exerciseInstanceId, setId, weight, reps) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            return { ...s, weight, reps };
          }),
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  completeSet: (exerciseInstanceId, setId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const now = new Date().toISOString();
      let updatedRecords = { ...state.personalRecords };

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            if (s.isCompleted) return s;

            let isPR = false;
            if (s.weight && s.reps && s.setType !== 'warmup') {
              const prResult = checkForPR(
                exercise.exerciseId,
                s.weight,
                s.reps,
                updatedRecords,
              );
              isPR = prResult.isPR;
              if (isPR) {
                updatedRecords[exercise.exerciseId] = updatePersonalRecord(
                  exercise.exerciseId,
                  s.weight,
                  s.reps,
                  now,
                  updatedRecords,
                );
              }
            }

            return { ...s, isCompleted: true, isPR, completedAt: now };
          }),
        };
      });

      AsyncStorage.setItem(
        STORAGE_KEYS.PERSONAL_RECORDS,
        JSON.stringify(updatedRecords),
      );

      return {
        activeSession: { ...state.activeSession, exercises },
        personalRecords: updatedRecords,
      };
    });
    get().persistActiveSession();
  },

  updateSetRPE: (exerciseInstanceId, setId, rpe) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            return { ...s, rpe };
          }),
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
  },

  removeSet: (exerciseInstanceId, setId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        const sets = exercise.sets
          .filter((s) => s.id !== setId)
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...exercise, sets };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  addSet: (exerciseInstanceId, setType = 'working') => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;

        const newSet: ActiveSet = {
          id: generateId('set'),
          setNumber: 0, // will be renumbered below
          setType,
          isCompleted: false,
          isPR: false,
        };

        // Pre-fill with last completed set's weight/reps for convenience
        const lastCompleted = [...exercise.sets]
          .reverse()
          .find((s) => s.isCompleted && s.weight);
        if (lastCompleted && setType === 'working') {
          newSet.weight = lastCompleted.weight;
          newSet.reps = lastCompleted.reps;
        }

        let updatedSets: ActiveSet[];
        if (setType === 'warmup') {
          // Insert warmup sets before working sets (after existing warmups)
          const lastWarmupIndex = exercise.sets.reduce(
            (acc, s, i) => (s.setType === 'warmup' ? i : acc),
            -1,
          );
          const insertIndex = lastWarmupIndex + 1;
          updatedSets = [
            ...exercise.sets.slice(0, insertIndex),
            newSet,
            ...exercise.sets.slice(insertIndex),
          ];
        } else {
          updatedSets = [...exercise.sets, newSet];
        }

        // Renumber all sets sequentially
        updatedSets = updatedSets.map((s, i) => ({ ...s, setNumber: i + 1 }));

        return { ...exercise, sets: updatedSets };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  // ── Exercise Management ─────────────────────────────────────────

  addExerciseToSession: (exercise, targetSets = 3) => {
    set((state) => {
      if (!state.activeSession) return state;

      const newExercise: ActiveExercise = {
        id: generateId('ae'),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: Array.from({ length: targetSets }, (_, i) => ({
          id: generateId('set'),
          setNumber: i + 1,
          setType: 'working' as const,
          isCompleted: false,
          isPR: false,
        })),
        isTimeBased: exercise.isTimeBased,
        defaultDurationSeconds: exercise.defaultDurationSeconds,
        isSkipped: false,
        order: state.activeSession.exercises.length,
      };

      return {
        activeSession: {
          ...state.activeSession,
          exercises: [...state.activeSession.exercises, newExercise],
        },
      };
    });
    get().persistActiveSession();
  },

  removeExerciseFromSession: (exerciseInstanceId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises
        .filter((e) => e.id !== exerciseInstanceId)
        .map((e, i) => ({ ...e, order: i }));

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  skipExercise: (exerciseInstanceId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) =>
        e.id === exerciseInstanceId ? { ...e, isSkipped: true } : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  updateExerciseRestTime: (exerciseInstanceId, seconds) => {
    const clamped = Math.max(5, Math.min(600, seconds));
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) =>
        e.id === exerciseInstanceId ? { ...e, restSeconds: clamped } : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  replaceExercise: (exerciseInstanceId, newExercise) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) => {
        if (e.id !== exerciseInstanceId) return e;
        return {
          ...e,
          exerciseId: newExercise.id,
          exerciseName: newExercise.name,
          isTimeBased: newExercise.isTimeBased,
          defaultDurationSeconds: newExercise.defaultDurationSeconds,
          // Keep existing sets data structure
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  logTimedSet: (exerciseInstanceId, setId, durationSeconds) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            return { ...s, durationSeconds };
          }),
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  reorderExercises: (orderedIds) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exerciseMap = new Map(
        state.activeSession.exercises.map((e) => [e.id, e]),
      );

      const exercises = orderedIds
        .map((id, i) => {
          const e = exerciseMap.get(id);
          return e ? { ...e, order: i } : null;
        })
        .filter(Boolean) as ActiveExercise[];

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  setCurrentExerciseIndex: (index) => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: { ...state.activeSession, currentExerciseIndex: index },
      };
    });
  },

  // ── Superset ────────────────────────────────────────────────────

  createSuperset: (exerciseInstanceIds) => {
    const groupId = generateId('ss');
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) =>
        exerciseInstanceIds.includes(e.id)
          ? { ...e, supersetGroupId: groupId }
          : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  removeSuperset: (exerciseInstanceId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const targetExercise = state.activeSession.exercises.find(
        (e) => e.id === exerciseInstanceId,
      );
      if (!targetExercise?.supersetGroupId) return state;

      const groupId = targetExercise.supersetGroupId;
      const exercises = state.activeSession.exercises.map((e) =>
        e.supersetGroupId === groupId
          ? { ...e, supersetGroupId: undefined }
          : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  createSupersetGroup: (exerciseInstanceIds) => {
    if (exerciseInstanceIds.length < 2 || exerciseInstanceIds.length > 3) return;
    const groupId = generateId('ss');
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) =>
        exerciseInstanceIds.includes(e.id)
          ? { ...e, supersetGroupId: groupId }
          : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  removeSupersetGroup: (groupId) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((e) =>
        e.supersetGroupId === groupId
          ? { ...e, supersetGroupId: undefined }
          : e,
      );

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  // ── Rest Timer ──────────────────────────────────────────────────

  startRestTimer: (durationSeconds) => {
    set((state) => {
      if (!state.activeSession) return state;

      const endAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
      return {
        activeSession: {
          ...state.activeSession,
          restTimerEndAt: endAt,
          restTimerDuration: durationSeconds,
        },
      };
    });
    get().persistActiveSession();
  },

  clearRestTimer: () => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          restTimerEndAt: undefined,
          restTimerDuration: undefined,
        },
      };
    });
  },

  setDefaultRestSeconds: (seconds) => {
    const clamped = Math.max(5, Math.min(600, seconds));
    set({ defaultRestSeconds: clamped });
    AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, clamped.toString());
  },

  // ── Workout Completion ──────────────────────────────────────────

  completeWorkout: () => {
    const state = get();
    if (!state.activeSession) return null;

    const completed = activeToCompleted(
      state.activeSession,
      'local_user',
      state.personalRecords,
    );

    const history = [completed, ...state.history];

    set({ activeSession: null, history });

    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

    return completed;
  },

  cancelWorkout: () => {
    set({ activeSession: null });
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  },

  // ── Session Metadata ────────────────────────────────────────────

  updateSessionNotes: (notes) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, notes } };
    });
  },

  updateSessionMood: (mood) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, mood } };
    });
  },

  updateSessionName: (name) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, name } };
    });
  },

  // ── Program Progress ───────────────────────────────────────────

  getProgramProgress: (programId) => {
    const { programs, history } = get();
    const program = programs.find((p) => p.id === programId);
    if (!program) return { totalDays: 0, completedDays: 0, completedDayIds: [], percentComplete: 0 };

    const totalDays = program.days.length;
    const dayIds = new Set(program.days.map((d) => d.id));

    // Find completed sessions that match this program's days
    const completedDayIds = new Set<string>();
    for (const session of history) {
      if (session.programId === programId && session.dayId && dayIds.has(session.dayId)) {
        completedDayIds.add(session.dayId);
      }
    }

    const completedDays = completedDayIds.size;
    const percentComplete = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    return {
      totalDays,
      completedDays,
      completedDayIds: Array.from(completedDayIds),
      percentComplete,
    };
  },

  markProgramCompleted: (programId) => {
    set((state) => {
      const programCompletions = {
        ...state.programCompletions,
        [programId]: new Date().toISOString(),
      };
      AsyncStorage.setItem(
        STORAGE_KEYS.PROGRAM_COMPLETIONS,
        JSON.stringify(programCompletions),
      );
      return { programCompletions };
    });
  },

  // ── Custom Exercise ─────────────────────────────────────────────

  addCustomExercise: (exercise) => {
    set((state) => {
      const exercises = [...state.exercises, exercise];
      // Store only custom exercises
      const customExercises = exercises.filter((e) => e.isCustom);
      AsyncStorage.setItem(
        STORAGE_KEYS.EXERCISES,
        JSON.stringify(customExercises),
      );
      return { exercises };
    });
  },

  // ── Persistence ─────────────────────────────────────────────────

  persistActiveSession: async () => {
    const { activeSession } = get();
    if (activeSession) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify(activeSession),
      );
    }
  },
}));
