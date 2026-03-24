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
import { preloadExerciseImages } from '../lib/exercise-image-preloader';

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  ACTIVE_SESSION: '@workout/active_session',
  HISTORY: '@workout/history',
  PROGRAMS: '@workout/programs',
  EXERCISES: '@workout/exercises',
  PERSONAL_RECORDS: '@workout/personal_records',
  DEFAULT_REST_SECONDS: '@workout/default_rest_seconds',
  PROGRAM_COMPLETIONS: '@workout/program_completions',
  AUTO_REST_TIMER: '@workout/auto_rest_timer',
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
  logSet: (exerciseInstanceId: string, setId: string, weight: number, reps: number, isAutoFilled?: boolean) => void;
  cascadeWeight: (exerciseInstanceId: string, fromSetIndex: number, weight: number, reps: number) => void;
  completeSet: (exerciseInstanceId: string, setId: string) => void;
  uncompleteSet: (exerciseInstanceId: string, setId: string, previousValues?: { weight?: number; reps?: number }) => void;
  updateSetRPE: (exerciseInstanceId: string, setId: string, rpe: number) => void;
  removeSet: (exerciseInstanceId: string, setId: string) => void;
  addSet: (exerciseInstanceId: string, setType?: 'working' | 'warmup' | 'drop' | 'failure') => void;

  // Actions - Exercise Management in Active Session
  addExerciseToSession: (exercise: ExerciseLibraryEntry, targetSets?: number, setType?: import('@health-coach/shared').SetType) => void;
  prependExercisesToSession: (exercises: ExerciseLibraryEntry[]) => void;
  removeExerciseFromSession: (exerciseInstanceId: string) => void;
  skipExercise: (exerciseInstanceId: string) => void;
  reorderExercises: (orderedIds: string[]) => void;
  setCurrentExerciseIndex: (index: number) => void;

  // Actions - Exercise Replacement
  replaceExercise: (exerciseInstanceId: string, newExercise: ExerciseLibraryEntry) => void;

  // Actions - Per-Exercise Rest Time
  getExerciseRestTime: (exerciseId: string) => number;
  updateExerciseRestTime: (exerciseInstanceId: string, seconds: number) => void;
  updateExerciseNotes: (exerciseInstanceId: string, notes: string) => void;
  updateExerciseRestTimerMode: (exerciseInstanceId: string, mode: 'auto' | 'manual' | 'disabled' | 'off' | 'custom', customSeconds?: number) => void;

  // Actions - Timed Sets
  logTimedSet: (exerciseInstanceId: string, setId: string, durationSeconds: number) => void;

  // Actions - Superset
  createSuperset: (exerciseInstanceIds: string[]) => void;
  removeSuperset: (exerciseInstanceId: string) => void;
  createSupersetGroup: (exerciseInstanceIds: string[]) => void;
  removeSupersetGroup: (groupId: string) => void;

  // Actions - Rest Timer
  autoRestTimer: boolean;
  setAutoRestTimer: (enabled: boolean) => void;
  restTimerDuration: number;
  startRestTimer: (durationSeconds: number) => void;
  clearRestTimer: () => void;
  extendRestTimer: (additionalSeconds: number) => void;
  setDefaultRestSeconds: (seconds: number) => void;

  // Computed
  todayWorkoutStatus: () => 'pending' | 'active' | 'completed';

  // Actions - Workout Completion
  completeWorkout: () => Promise<CompletedSession | null>;
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

  // Actions - History
  deleteSession: (sessionId: string) => void;

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
  autoRestTimer: true,
  restTimerDuration: 0,

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

      const seedPrograms = getSeedPrograms('local_user');
      let programs: WorkoutProgramLocal[] = storedPrograms
        ? JSON.parse(storedPrograms)
        : seedPrograms;

      // Merge in any new seed programs that don't exist in stored data,
      // and backfill dayType on stored programs that predate the field.
      let programsChanged = false;
      if (storedPrograms) {
        const storedIds = new Set(programs.map((p) => p.id));
        const missingSeedPrograms = seedPrograms.filter((sp) => !storedIds.has(sp.id));
        if (missingSeedPrograms.length > 0) {
          programs = [...programs, ...missingSeedPrograms];
          programsChanged = true;
        }
        // Backfill dayType on any stored days that lack it
        for (const prog of programs) {
          for (const day of prog.days) {
            if (!day.dayType) {
              (day as any).dayType = 'lifting';
              programsChanged = true;
            }
          }
          // Replace stored seed programs with latest seed data, but only if the
          // user has not manually edited the program (customized flag prevents overwrite).
          const seedMatch = seedPrograms.find((sp) => sp.id === prog.id);
          if (seedMatch && !prog.customized) {
            const idx = programs.indexOf(prog);
            // Preserve isActive from stored version
            programs[idx] = { ...seedMatch, isActive: prog.isActive };
            programsChanged = true;
          }
        }
      }

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

      // Persist programs if they were newly seeded or migrated
      if (!storedPrograms || programsChanged) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
      }
    } catch (error) {
      // Fallback to defaults — preserve any previously-loaded rest time
      const currentRest = get().defaultRestSeconds;
      set({
        exercises: [...EXERCISE_LIBRARY],
        programs: getSeedPrograms('local_user'),
        history: [],
        personalRecords: {},
        programCompletions: {},
        activeSession: null,
        defaultRestSeconds: currentRest,
        isInitialized: true,
      });
    }
  },

  // ── Programs ────────────────────────────────────────────────────

  addProgram: (program) => {
    set((state) => {
      const programs = [...state.programs, program];
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs)).catch(console.warn);
      return { programs };
    });
  },

  updateProgram: (program) => {
    set((state) => {
      const updated = { ...program, customized: true };
      const programs = state.programs.map((p) =>
        p.id === updated.id ? updated : p,
      );
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs)).catch(console.warn);
      return { programs };
    });
  },

  deleteProgram: (programId) => {
    const program = get().programs.find((p) => p.id === programId);
    if (program && !program.customized) return; // Don't delete seed programs
    set((state) => {
      const programs = state.programs.filter((p) => p.id !== programId);
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs)).catch(console.warn);
      return { programs };
    });
  },

  setActiveProgram: (programId) => {
    set((state) => {
      const programs = state.programs.map((p) => ({
        ...p,
        isActive: p.id === programId,
      }));
      AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs)).catch(console.warn);
      return { programs };
    });
    // Re-sync workout reminder days to match the new active program.
    // Lazy require avoids circular dependency (notification-store → workout-reminder-days → workout-store).
    setTimeout(() => {
      try {
        const { useNotificationStore } = require('./notification-store');
        useNotificationStore.getState().syncWorkoutDaysFromProgram();
      } catch {}
    }, 200);
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
          isBodyweight: libExercise?.isBodyweight,
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

    // Preload exercise images for the session (fire and forget)
    const exerciseIds = exercises.map(e => e.exerciseId);
    preloadExerciseImages(exerciseIds).catch(() => {});
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

  logSet: (exerciseInstanceId, setId, weight, reps, isAutoFilled) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            return { ...s, weight, reps, ...(isAutoFilled !== undefined ? { isAutoFilled } : {}) };
          }),
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
      };
    });
    get().persistActiveSession();
  },

  cascadeWeight: (exerciseInstanceId, fromSetIndex, weight, reps) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s, idx) => {
            // Only cascade forward from the edited set
            if (idx <= fromSetIndex) return s;
            // Skip completed sets
            if (s.isCompleted) return s;
            // Skip sets that were manually edited (isAutoFilled explicitly false)
            if (s.isAutoFilled === false) return s;
            // Apply cascade to empty or previously auto-filled sets
            if (s.weight === undefined || s.isAutoFilled === true || s.isAutoFilled === undefined) {
              return { ...s, weight, reps, isAutoFilled: true };
            }
            return s;
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

  uncompleteSet: (exerciseInstanceId, setId, previousValues) => {
    set((state) => {
      if (!state.activeSession) return state;

      const exercises = state.activeSession.exercises.map((exercise) => {
        if (exercise.id !== exerciseInstanceId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((s) => {
            if (s.id !== setId) return s;
            return {
              ...s,
              isCompleted: false,
              isPR: false,
              completedAt: undefined,
              ...(previousValues?.weight !== undefined ? { weight: previousValues.weight } : {}),
              ...(previousValues?.reps !== undefined ? { reps: previousValues.reps } : {}),
            };
          }),
        };
      });

      return {
        activeSession: { ...state.activeSession, exercises },
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
    get().persistActiveSession();
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
          newSet.isAutoFilled = true;
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

  addExerciseToSession: (exercise, targetSets = 3, setType = 'working') => {
    set((state) => {
      if (!state.activeSession) return state;

      const newExercise: ActiveExercise = {
        id: generateId('ae'),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: Array.from({ length: targetSets }, (_, i) => ({
          id: generateId('set'),
          setNumber: i + 1,
          setType: setType as import('@health-coach/shared').SetType,
          isCompleted: false,
          isPR: false,
        })),
        restSeconds: exercise.defaultRestSeconds,
        isTimeBased: exercise.isTimeBased,
        isBodyweight: exercise.isBodyweight,
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

  prependExercisesToSession: (exercises) => {
    set((state) => {
      if (!state.activeSession) return state;

      const newExercises: ActiveExercise[] = exercises.map((exercise, idx) => ({
        id: generateId('ae'),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: Array.from({ length: exercise.defaultSets || 1 }, (_, i) => ({
          id: generateId('set'),
          setNumber: i + 1,
          setType: 'warmup' as const,
          isCompleted: false,
          isPR: false,
        })),
        restSeconds: exercise.defaultRestSeconds,
        isTimeBased: exercise.isTimeBased,
        isBodyweight: exercise.isBodyweight,
        defaultDurationSeconds: exercise.defaultDurationSeconds,
        isSkipped: false,
        order: idx,
      }));

      // Reorder existing exercises to come after the new ones
      const reordered = state.activeSession.exercises.map((e, i) => ({
        ...e,
        order: newExercises.length + i,
      }));

      return {
        activeSession: {
          ...state.activeSession,
          exercises: [...newExercises, ...reordered],
          currentExerciseIndex: 0,
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

      const currentIdx = state.activeSession.currentExerciseIndex ?? 0;
      const clampedIdx = Math.min(currentIdx, Math.max(0, exercises.length - 1));
      return {
        activeSession: { ...state.activeSession, exercises, currentExerciseIndex: clampedIdx },
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

  getExerciseRestTime: (exerciseId) => {
    const state = get();
    if (state.activeSession) {
      // 1. Check exercise-level override
      const exercise = state.activeSession.exercises.find(
        (e) => e.exerciseId === exerciseId,
      );
      if (exercise?.restSeconds != null && exercise.restSeconds > 0) {
        return exercise.restSeconds;
      }
      // 2. Check session default
      if (state.activeSession.defaultRestSeconds != null && state.activeSession.defaultRestSeconds > 0) {
        return state.activeSession.defaultRestSeconds;
      }
    }
    // 3. Global default
    return state.defaultRestSeconds || 90;
  },

  updateExerciseRestTime: (exerciseInstanceId, seconds) => {
    const clamped = Math.max(5, Math.min(600, seconds));
    set((state) => {
      if (!state.activeSession) return state;

      // Find the exerciseId for the target instance so we can propagate
      const target = state.activeSession.exercises.find(
        (e) => e.id === exerciseInstanceId,
      );
      if (!target) return state;

      // Update ALL instances of the same exercise in this workout
      const exercises = state.activeSession.exercises.map((e) =>
        e.exerciseId === target.exerciseId ? { ...e, restSeconds: clamped } : e,
      );

      // Live-update running timer if it belongs to this exercise
      const isTimerForThisExercise =
        state.activeSession.restTimerEndAt &&
        state.activeSession.restTimerExerciseId === target.exerciseId;

      const timerUpdate = isTimerForThisExercise
        ? {
            restTimerDuration: clamped,
            activeSession: {
              ...state.activeSession,
              exercises,
              restTimerDuration: clamped,
              restTimerEndAt: new Date(Date.now() + clamped * 1000).toISOString(),
            },
          }
        : {
            activeSession: { ...state.activeSession, exercises },
          };

      return timerUpdate;
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
          isBodyweight: newExercise.isBodyweight,
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
            return { ...s, durationSeconds, isCompleted: true, completedAt: new Date().toISOString() };
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

  setAutoRestTimer: (enabled) => {
    set({ autoRestTimer: enabled });
    AsyncStorage.setItem(STORAGE_KEYS.AUTO_REST_TIMER, JSON.stringify(enabled)).catch(console.warn);
  },

  startRestTimer: (durationSeconds) => {
    set((state) => {
      if (!state.activeSession) return state;

      const endAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
      return {
        restTimerDuration: durationSeconds,
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
        restTimerDuration: 0,
        activeSession: {
          ...state.activeSession,
          restTimerEndAt: undefined,
          restTimerDuration: undefined,
        },
      };
    });
  },

  extendRestTimer: (additionalSeconds) => {
    set((state) => {
      if (!state.activeSession?.restTimerEndAt) return state;
      const currentEnd = new Date(state.activeSession.restTimerEndAt).getTime();
      const newEnd = new Date(currentEnd + additionalSeconds * 1000).toISOString();
      const newDuration = (state.activeSession.restTimerDuration ?? 0) + additionalSeconds;
      return {
        restTimerDuration: newDuration,
        activeSession: {
          ...state.activeSession,
          restTimerEndAt: newEnd,
          restTimerDuration: newDuration,
        },
      };
    });
    get().persistActiveSession();
  },

  setDefaultRestSeconds: (seconds) => {
    const clamped = Math.max(5, Math.min(600, seconds));
    set({ defaultRestSeconds: clamped });
    AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_REST_SECONDS, clamped.toString());
  },

  // ── Today Workout Status ──────────────────────────────────────

  todayWorkoutStatus: () => {
    const { activeSession, history } = get();
    if (activeSession) return 'active';
    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = history.some(
      (s) => new Date(s.completedAt).toISOString().split('T')[0] === todayStr,
    );
    return completedToday ? 'completed' : 'pending';
  },

  // ── Workout Completion ──────────────────────────────────────────

  completeWorkout: async () => {
    const state = get();
    if (!state.activeSession) return null;

    const completed = activeToCompleted(
      state.activeSession,
      'local_user',
      state.personalRecords,
    );

    const history = [completed, ...state.history];

    set({ activeSession: null, history });

    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

    return completed;
  },

  cancelWorkout: () => {
    set({ activeSession: null });
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  },

  // ── Delete Session from History ────────────────────────────────

  deleteSession: (sessionId) => {
    const history = get().history.filter((s) => s.id !== sessionId);
    set({ history });
    AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history)).catch(console.warn);
  },

  // ── Session Metadata ────────────────────────────────────────────

  updateSessionNotes: (notes) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, notes } };
    });
    get().persistActiveSession();
  },

  updateSessionMood: (mood) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, mood } };
    });
    get().persistActiveSession();
  },

  updateSessionName: (name) => {
    set((state) => {
      if (!state.activeSession) return state;
      return { activeSession: { ...state.activeSession, name } };
    });
    get().persistActiveSession();
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
      ).catch(console.warn);
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
      ).catch(console.warn);
      return { exercises };
    });
  },

  // ── Exercise Notes & Rest Timer Mode ──────────────────────────

  updateExerciseNotes: (exerciseInstanceId, notes) => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          exercises: state.activeSession.exercises.map((e) =>
            e.id === exerciseInstanceId ? { ...e, notes } : e,
          ),
        },
      };
    });
    get().persistActiveSession();
  },

  updateExerciseRestTimerMode: (exerciseInstanceId, mode, customSeconds) => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          exercises: state.activeSession.exercises.map((e) =>
            e.id === exerciseInstanceId
              ? { ...e, restTimerMode: mode, ...(customSeconds != null ? { restTimerCustomSeconds: customSeconds } : {}) }
              : e,
          ),
        },
      };
    });
    get().persistActiveSession();
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
