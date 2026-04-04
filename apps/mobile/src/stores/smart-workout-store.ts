import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Lazy-load NetInfo to prevent startup crashes when the native module isn't linked
let _NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
async function getNetInfo() {
  if (!_NetInfo) {
    const mod = await import('@react-native-community/netinfo');
    _NetInfo = mod.default;
  }
  return _NetInfo;
}
import type {
  SmartWorkout,
  SmartExercise,
  WorkoutMode,
  WorkoutGoal,
  ExerciseHistoryEntry,
  CompletedSession,
  ExerciseLibraryEntry,
} from '../types/workout';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWorkoutStore } from './workout-store';
import { useProfileStore } from './profile-store';
import { useOnboardingStore } from './onboarding-store';
import { calculateMuscleGroupRecovery } from '../lib/recovery';
import { EXERCISE_LIBRARY } from '../lib/exercise-data';
import { generateId } from '../lib/workout-utils';
import type { FitnessGoal, SessionDuration } from '../types/onboarding';

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SMART_WORKOUT: '@formiq/smart_workout',
  GENERATED_AT: '@formiq/smart_workout_generated_at',
  WORKOUT_MODE: '@formiq/workout_mode',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

/** Map onboarding FitnessGoal to edge-function WorkoutGoal */
function mapFitnessGoalToWorkoutGoal(goal: FitnessGoal | null): WorkoutGoal {
  switch (goal) {
    case 'build_muscle':
      return 'hypertrophy';
    case 'get_stronger':
      return 'strength';
    case 'lose_fat':
      return 'weight_loss';
    case 'stay_active':
      return 'general_fitness';
    case 'athletic_performance':
      return 'endurance';
    default:
      return 'general_fitness';
  }
}

/** Parse session duration string to minutes */
function parseDurationMinutes(duration: SessionDuration | null): number {
  switch (duration) {
    case '30_min':
      return 30;
    case '45_min':
      return 45;
    case '60_min':
      return 60;
    case '75_plus_min':
      return 75;
    default:
      return 60;
  }
}

/** Check if a date string is from today */
function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/** Extract per-exercise history from completed sessions (last 30 days) */
function extractExerciseHistory(history: CompletedSession[]): ExerciseHistoryEntry[] {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(
    (s) => new Date(s.completedAt).getTime() > thirtyDaysAgo,
  );

  // Track latest performance + PR per exercise
  const exerciseMap = new Map<
    string,
    {
      lastWeight: number;
      lastReps: number;
      lastDate: string;
      prWeight: number;
      prReps: number;
    }
  >();

  // Process oldest-first so latest data overwrites
  const sorted = [...recentHistory].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );

  for (const session of sorted) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (set.weight == null || set.reps == null) continue;
        const existing = exerciseMap.get(exercise.exerciseId);
        const weight = set.weight;
        const reps = set.reps;

        if (!existing) {
          exerciseMap.set(exercise.exerciseId, {
            lastWeight: weight,
            lastReps: reps,
            lastDate: session.completedAt,
            prWeight: weight,
            prReps: reps,
          });
        } else {
          // Update last performance (since we iterate oldest-first, this keeps latest)
          existing.lastWeight = weight;
          existing.lastReps = reps;
          existing.lastDate = session.completedAt;
          // Update PR (highest weight)
          if (weight > existing.prWeight || (weight === existing.prWeight && reps > existing.prReps)) {
            existing.prWeight = weight;
            existing.prReps = reps;
          }
        }
      }
    }
  }

  return Array.from(exerciseMap.entries()).map(([exerciseId, data]) => ({
    exerciseId,
    lastWeight: data.lastWeight,
    lastReps: data.lastReps,
    lastDate: data.lastDate,
    personalRecord: { weight: data.prWeight, reps: data.prReps },
  }));
}

// ── Compound Exercise Detection ─────────────────────────────────────

const COMPOUND_EXERCISE_KEYWORDS = [
  'squat', 'deadlift', 'bench press', 'overhead press', 'row', 'pull-up',
  'chin-up', 'dip', 'lunge', 'hip thrust', 'clean', 'snatch', 'push-up',
  'press', 'good morning', 'step-up',
];

function isCompoundExercise(name: string): boolean {
  const lower = name.toLowerCase();
  return COMPOUND_EXERCISE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Goal-Based Defaults ─────────────────────────────────────────────

const GOAL_DEFAULTS: Record<WorkoutGoal, { reps: string; restSeconds: number; sets: number }> = {
  strength: { reps: '3-5', restSeconds: 180, sets: 5 },
  hypertrophy: { reps: '8-12', restSeconds: 90, sets: 4 },
  endurance: { reps: '15-20', restSeconds: 60, sets: 3 },
  general_fitness: { reps: '8-12', restSeconds: 90, sets: 3 },
  weight_loss: { reps: '12-15', restSeconds: 60, sets: 3 },
};

// ── Local Workout Generation ────────────────────────────────────────

function generateLocalSmartWorkout(
  goal: WorkoutGoal,
  equipment: string[],
  availableMinutes: number,
  history: CompletedSession[],
  exerciseHistory: ExerciseHistoryEntry[],
  experienceLevel?: string,
  muscleGroupPreferences?: string[],
): SmartWorkout {
  const recoveryStatus = calculateMuscleGroupRecovery(history);
  const equipmentSet = new Set(equipment.map((e) => e.toLowerCase()));

  // Always include bodyweight
  equipmentSet.add('bodyweight');

  const targetMuscles: string[] = [];

  if (muscleGroupPreferences && muscleGroupPreferences.length > 0) {
    // User explicitly chose muscle groups — respect their selection
    targetMuscles.push(...muscleGroupPreferences);
  } else {
    // Auto-select: find recovered muscle groups (>= 70% recovered), sorted by most recovered
    const recoveredGroups = Object.entries(recoveryStatus)
      .filter(([, pct]) => pct >= 70)
      .sort((a, b) => b[1] - a[1]);

    // Pick 2-3 muscle groups to target
    const targetCount = availableMinutes >= 60 ? 3 : 2;
    targetMuscles.push(...recoveredGroups.slice(0, targetCount).map(([group]) => group));
  }

  // If no groups selected (unlikely), default to a balanced set
  if (targetMuscles.length === 0) {
    targetMuscles.push('chest', 'back');
  }

  // Map muscle group IDs to the categories they can draw from,
  // PLUS the primaryMuscles keywords that an exercise must match.
  // An exercise qualifies if it's in the right category AND at least one
  // of its primaryMuscles matches a keyword for the requested group.
  const muscleFilter: Record<string, { categories: string[]; keywords: string[] }> = {
    chest:      { categories: ['chest'], keywords: ['Pectoralis Major', 'Upper Pectoralis Major', 'Lower Pectoralis Major', 'Pectoralis', 'Chest', 'Upper Chest'] },
    back:       { categories: ['back'], keywords: ['Latissimus Dorsi', 'Lats', 'Rhomboids', 'Trapezius', 'Erector Spinae', 'Back', 'Upper Back', 'Spine'] },
    shoulders:  { categories: ['shoulders'], keywords: ['Anterior Deltoid', 'Medial Deltoid', 'Rear Deltoid', 'Deltoids', 'Deltoid', 'Shoulders', 'Trapezius', 'Rotator Cuff'] },
    quadriceps: { categories: ['legs'], keywords: ['Quadriceps', 'Quad', 'Legs'] },
    hamstrings: { categories: ['legs'], keywords: ['Hamstrings', 'Hamstring', 'Legs'] },
    glutes:     { categories: ['legs'], keywords: ['Glutes', 'Gluteus Medius', 'Gluteus Minimus', 'Abductors', 'Piriformis'] },
    biceps:     { categories: ['arms'], keywords: ['Biceps', 'Biceps (Long Head)', 'Biceps (Short Head)', 'Brachialis', 'Brachioradialis', 'Arms'] },
    triceps:    { categories: ['arms'], keywords: ['Triceps', 'Triceps (Long Head)', 'Triceps (Short Head)', 'Arms'] },
    abs:        { categories: ['core'], keywords: ['Rectus Abdominis', 'Obliques', 'Transverse Abdominis', 'Core', 'Diaphragm'] },
    calves:     { categories: ['legs'], keywords: ['Calves', 'Gastrocnemius', 'Soleus', 'Calf'] },
    forearms:   { categories: ['arms'], keywords: ['Forearms', 'Forearm', 'Brachioradialis', 'Wrist'] },
    lower_back: { categories: ['back', 'core'], keywords: ['Erector Spinae', 'Lower Back', 'Spine', 'Spinal'] },
    hip_flexors:{ categories: ['legs'], keywords: ['Hip Flexors', 'Adductors', 'Abductors', 'Hip', 'Hips'] },
    neck:       { categories: ['shoulders'], keywords: ['Neck', 'Trapezius'] },
  };

  // Check if any of an exercise's primaryMuscles match the target keywords
  function exerciseMatchesMuscle(exercise: ExerciseLibraryEntry, keywords: string[]): boolean {
    return exercise.primaryMuscles.some(pm =>
      keywords.some(kw => pm.toLowerCase().includes(kw.toLowerCase())),
    );
  }

  // Collect candidate exercises that match equipment + target muscles
  const candidates: ExerciseLibraryEntry[] = [];
  for (const muscle of targetMuscles) {
    const filter = muscleFilter[muscle];
    if (!filter) continue;
    for (const exercise of EXERCISE_LIBRARY) {
      if (
        filter.categories.includes(exercise.category) &&
        equipmentSet.has(exercise.equipment) &&
        exerciseMatchesMuscle(exercise, filter.keywords)
      ) {
        candidates.push(exercise);
      }
    }
  }

  // Deduplicate by id
  const uniqueCandidates = Array.from(
    new Map(candidates.map((e) => [e.id, e])).values(),
  );

  // Build exercise history lookup
  const historyMap = new Map(exerciseHistory.map((h) => [h.exerciseId, h]));

  // Select exercises: prefer compound first, then accessories
  const compounds = uniqueCandidates.filter((e) => isCompoundExercise(e.name));
  const accessories = uniqueCandidates.filter((e) => !isCompoundExercise(e.name));

  // Shuffle to add variety
  shuffle(compounds);
  shuffle(accessories);

  const goalDefaults = GOAL_DEFAULTS[goal];

  // Budget: ~3 min per set (including rest). Rough estimate for exercise count.
  const maxSets = Math.floor(availableMinutes / 3);
  const selected: SmartExercise[] = [];
  let totalSets = 0;

  // Add compounds first (2-3)
  for (const ex of compounds) {
    if (totalSets >= maxSets) break;
    const sets = Math.min(goalDefaults.sets, maxSets - totalSets);
    if (sets <= 0) break;

    const hist = historyMap.get(ex.id);
    selected.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      targetSets: sets,
      targetReps: goalDefaults.reps,
      suggestedWeight: hist ? progressiveOverload(hist, goal) : undefined,
      restSeconds: goalDefaults.restSeconds,
      isCompound: true,
    });
    totalSets += sets;
    if (selected.filter((s) => s.isCompound).length >= 3) break;
  }

  // Fill remaining with accessories
  for (const ex of accessories) {
    if (totalSets >= maxSets) break;
    const sets = Math.min(goalDefaults.sets - 1, maxSets - totalSets, 3);
    if (sets <= 0) break;

    const hist = historyMap.get(ex.id);
    selected.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      targetSets: sets,
      targetReps: goalDefaults.reps,
      suggestedWeight: hist ? progressiveOverload(hist, goal) : undefined,
      restSeconds: Math.max(60, goalDefaults.restSeconds - 30),
      isCompound: false,
    });
    totalSets += sets;
    if (selected.length >= 8) break;
  }

  // Build workout name
  const muscleNames = targetMuscles
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1).replace('_', ' '))
    .join(' & ');
  const name = `${muscleNames} Day`;

  return {
    id: generateId('sw'),
    name,
    targetMuscles,
    exercises: selected,
    estimatedDurationMinutes: Math.round(totalSets * 3),
    totalSets,
    aiExplanation: `Today's workout targets ${muscleNames.toLowerCase()}, which are well-recovered and ready to train. ${
      goal === 'strength'
        ? 'Heavy compound lifts with longer rest periods for maximum strength gains.'
        : goal === 'hypertrophy'
          ? 'Moderate weight with higher volume for muscle growth.'
          : 'A balanced session to keep you progressing toward your goals.'
    }`,
    recoveryStatus,
    generatedAt: new Date().toISOString(),
    goal,
  };
}

/** Simple progressive overload: if all reps completed, add 5 lbs (2.5 kg) */
function progressiveOverload(hist: ExerciseHistoryEntry, goal: WorkoutGoal): number {
  const { lastWeight } = hist;
  if (!lastWeight) return 0;

  // Parse target reps for the goal to see if they hit the top of the range
  const maxReps = parseInt(GOAL_DEFAULTS[goal].reps.split('-')[1] ?? '12', 10);
  if (hist.lastReps >= maxReps) {
    return lastWeight + 5; // Progress
  }
  return lastWeight; // Repeat same weight
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Store Interface ─────────────────────────────────────────────────

interface GenerateOptions {
  muscleGroupPreferences?: string[];
  availableMinutes?: number;
  goal?: WorkoutGoal;
  forceRefresh?: boolean;
  excludeExerciseIds?: string[];
}

interface SmartWorkoutState {
  // State
  cachedWorkout: SmartWorkout | null;
  isGenerating: boolean;
  lastGeneratedAt: string | null;
  workoutMode: WorkoutMode;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  generateSmartWorkout: (options?: GenerateOptions) => Promise<SmartWorkout | null>;
  swapSmartWorkout: () => Promise<SmartWorkout | null>;
  customizeSmartWorkout: (muscleGroups: string[]) => Promise<SmartWorkout | null>;
  startSmartWorkout: () => void;
  setWorkoutMode: (mode: WorkoutMode) => void;
  clearCache: () => void;
}

// ── Store ───────────────────────────────────────────────────────────

export const useSmartWorkoutStore = create<SmartWorkoutState>((set, get) => ({
  cachedWorkout: null,
  isGenerating: false,
  lastGeneratedAt: null,
  workoutMode: 'ai_suggested',
  error: null,

  // ── Initialize ──────────────────────────────────────────────────

  initialize: async () => {
    try {
      const [storedWorkout, storedGeneratedAt, storedMode] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SMART_WORKOUT),
        AsyncStorage.getItem(STORAGE_KEYS.GENERATED_AT),
        AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_MODE),
      ]);

      let cachedWorkout: SmartWorkout | null = storedWorkout
        ? JSON.parse(storedWorkout)
        : null;
      const lastGeneratedAt = storedGeneratedAt ?? null;
      const workoutMode = (storedMode as WorkoutMode) ?? 'ai_suggested';

      // Clear stale cache (not from today)
      if (cachedWorkout && !isToday(cachedWorkout.generatedAt)) {
        cachedWorkout = null;
        await AsyncStorage.removeItem(STORAGE_KEYS.SMART_WORKOUT);
      }

      set({ cachedWorkout, lastGeneratedAt, workoutMode });
    } catch (error) {
      console.error('Smart workout store initialization failed:', error);
    }
  },

  // ── Generate ────────────────────────────────────────────────────

  generateSmartWorkout: async (options) => {
    const state = get();

    // Return cached if valid and no force refresh
    if (
      state.cachedWorkout &&
      isToday(state.cachedWorkout.generatedAt) &&
      !options?.forceRefresh
    ) {
      return state.cachedWorkout;
    }

    set({ isGenerating: true, error: null });

    try {
      // Gather context from other stores
      const profileState = useProfileStore.getState();
      const onboardingState = useOnboardingStore.getState();
      const workoutState = useWorkoutStore.getState();

      const goal: WorkoutGoal =
        options?.goal ??
        mapFitnessGoalToWorkoutGoal(
          (profileState.profile.fitnessGoal as any) ?? onboardingState.fitnessGoal
        );

      const equipment: string[] =
        profileState.profile.fitnessEquipment.length > 0
          ? profileState.profile.fitnessEquipment
          : onboardingState.selectedEquipment.length > 0
            ? onboardingState.selectedEquipment
            : ['bodyweight'];

      const availableMinutes: number =
        options?.availableMinutes ??
        parseDurationMinutes(
          (profileState.profile.sessionDuration as any) ?? onboardingState.sessionDuration
        );

      const experienceLevel =
        profileState.profile.trainingExperience ??
        onboardingState.experienceLevel ??
        undefined;

      // Recent workouts (last 7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentWorkouts = workoutState.history
        .filter((s) => new Date(s.completedAt).getTime() > sevenDaysAgo)
        .map((s) => ({
          date: s.completedAt,
          exercises: s.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.length,
            category: '',
          })),
          durationMinutes: Math.round(s.durationSeconds / 60),
        }));

      const exerciseHistory = extractExerciseHistory(workoutState.history);

      let workout: SmartWorkout | null = null;

      // Try Edge Function if online + configured
      let isOnline = true; // Assume online if NetInfo unavailable
      try {
        const NetInfo = await getNetInfo();
        const netInfo = await NetInfo.fetch();
        isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
      } catch {
        // Assume online if NetInfo unavailable
      }

      if (isOnline && isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.functions.invoke(
            'generate-smart-workout',
            {
              body: {
                goal,
                equipment,
                availableMinutes,
                muscleGroupPreferences: options?.muscleGroupPreferences,
                recentWorkouts,
                exerciseHistory,
                experienceLevel,
                excludeExerciseIds: options?.excludeExerciseIds,
              },
            },
          );

          if (error) throw error;

          if (data?.workout) {
            const w = data.workout;
            workout = {
              id: generateId('sw'),
              name: w.name,
              targetMuscles: w.targetMuscles ?? [],
              exercises: w.exercises ?? [],
              warmupExerciseIds: w.warmupExercises,
              estimatedDurationMinutes: w.estimatedDurationMinutes ?? availableMinutes,
              totalSets: w.totalSets ?? 0,
              aiExplanation: w.aiExplanation ?? '',
              recoveryStatus: w.recoveryStatus ?? {},
              generatedAt: new Date().toISOString(),
              goal,
            };
          }
        } catch (error) {
          console.error('AI workout generation failed, falling back to local:', error);
        }
      }

      // Local fallback
      if (!workout) {
        workout = generateLocalSmartWorkout(
          goal,
          equipment,
          availableMinutes,
          workoutState.history,
          exerciseHistory,
          experienceLevel ?? undefined,
          options?.muscleGroupPreferences,
        );
      }

      // Persist
      const now = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.SMART_WORKOUT, JSON.stringify(workout)),
        AsyncStorage.setItem(STORAGE_KEYS.GENERATED_AT, now),
      ]);

      set({
        cachedWorkout: workout,
        lastGeneratedAt: now,
        isGenerating: false,
      });

      return workout;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate workout';
      set({ isGenerating: false, error: message });
      return null;
    }
  },

  // ── Swap ────────────────────────────────────────────────────────

  swapSmartWorkout: async () => {
    const { cachedWorkout } = get();
    return get().generateSmartWorkout({
      forceRefresh: true,
      muscleGroupPreferences: cachedWorkout?.targetMuscles,
      excludeExerciseIds: cachedWorkout?.exercises.map((e) => e.exerciseId),
    });
  },

  // ── Customize ───────────────────────────────────────────────────

  customizeSmartWorkout: async (muscleGroups) => {
    return get().generateSmartWorkout({
      forceRefresh: true,
      muscleGroupPreferences: muscleGroups,
    });
  },

  // ── Start Workout ───────────────────────────────────────────────

  startSmartWorkout: () => {
    const { cachedWorkout } = get();
    if (!cachedWorkout) return;

    const workoutStore = useWorkoutStore.getState();
    workoutStore.startWorkout({
      name: cachedWorkout.name,
      exercises: cachedWorkout.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        supersetGroupId: e.supersetGroupId,
      })),
    });
  },

  // ── Set Mode ────────────────────────────────────────────────────

  setWorkoutMode: (mode) => {
    set({ workoutMode: mode });
    AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_MODE, mode);
  },

  // ── Clear Cache ─────────────────────────────────────────────────

  clearCache: () => {
    set({ cachedWorkout: null, lastGeneratedAt: null, error: null });
    AsyncStorage.removeItem(STORAGE_KEYS.SMART_WORKOUT);
    AsyncStorage.removeItem(STORAGE_KEYS.GENERATED_AT);
  },

  reset: async () => {
    set({
      cachedWorkout: null,
      isGenerating: false,
      lastGeneratedAt: null,
      workoutMode: 'ai_suggested',
      error: null,
    });
    await Promise.all(
      Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)),
    ).catch((e) => console.warn('[SmartWorkoutStore] reset storage failed:', e));
  },
}));
