// ── AI Workout Generator ────────────────────────────────────────────
// Calls the `ai-workout-generate` Supabase Edge Function so the AI key
// stays server-side. Profile + exercise library context is passed in
// the request body; exercise-ID matching happens client-side after the
// model returns names. Falls back to a demo workout when unauthenticated.

import { supabase, isSupabaseConfigured } from './supabase';
import { useProfileStore } from '../stores/profile-store';
import { useWorkoutStore } from '../stores/workout-store';
import type { ExerciseLibraryEntry } from '../types/workout';

// ── Types ───────────────────────────────────────────────────────────

export interface GenerateWorkoutOptions {
  /** Free-form user prompt, e.g. "chest and triceps hypertrophy" */
  prompt: string;
}

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes?: string;
}

export interface GenerateWorkoutResult {
  name: string;
  exercises: GeneratedExercise[];
  model: string;
}

interface EdgeWorkoutResponse {
  name: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
  }>;
  model: string;
}

// ── Context gathering ───────────────────────────────────────────────

function gatherRequestContext(): {
  exerciseNames: string[];
  library: ExerciseLibraryEntry[];
  context: Record<string, unknown>;
} {
  const profile = useProfileStore.getState().profile;
  const { history, programs, exercises } = useWorkoutStore.getState();

  const library = exercises.filter((e) => e.category !== 'warmup' && e.category !== 'cooldown');
  const exerciseNames = library.map((e) => e.name);

  const recent = history.slice(-5).map((s) => ({
    name: s.name,
    date: s.startedAt ? new Date(s.startedAt).toISOString().slice(0, 10) : undefined,
    exercises: s.exercises.map((e) => e.exerciseName),
  }));

  const activeProgram = programs.find((p) => p.isActive);
  const equipment = profile.fitnessEquipment ?? profile.availableEquipment ?? [];

  const context: Record<string, unknown> = {
    goals: profile.healthGoals,
    primary_goal: profile.primaryGoal,
    training_experience: profile.trainingExperience,
    training_days_per_week: profile.trainingDaysPerWeek,
    injuries: profile.injuriesOrLimitations,
    equipment,
    recent_workouts: recent,
  };

  if (activeProgram) {
    context.active_program = {
      name: activeProgram.name,
      difficulty: activeProgram.difficulty,
      days_per_week: activeProgram.daysPerWeek,
    };
  }

  return { exerciseNames, library, context };
}

// ── Exercise matching ───────────────────────────────────────────────

function findExerciseMatch(
  aiName: string,
  library: ExerciseLibraryEntry[],
): ExerciseLibraryEntry | undefined {
  const lower = aiName.toLowerCase().trim();
  const exact = library.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;
  return library.find(
    (e) => lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower),
  );
}

// ── Generator ───────────────────────────────────────────────────────

export async function generateWorkout(
  options: GenerateWorkoutOptions,
): Promise<GenerateWorkoutResult> {
  if (!isSupabaseConfigured) {
    return getDemoWorkout();
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return getDemoWorkout();
  }

  const { exerciseNames, library, context } = gatherRequestContext();

  const { data, error } = await supabase.functions.invoke<EdgeWorkoutResponse>(
    'ai-workout-generate',
    {
      body: {
        prompt: options.prompt,
        exercise_names: exerciseNames,
        context,
      },
    },
  );

  if (error) throw error;
  if (!data || !Array.isArray(data.exercises) || data.exercises.length === 0) {
    throw new Error('Workout generator returned no exercises');
  }

  const exercises: GeneratedExercise[] = data.exercises.map((aiEx) => {
    const match = findExerciseMatch(aiEx.name, library);
    return {
      exerciseId: match?.id ?? `custom_${aiEx.name.toLowerCase().replace(/\s+/g, '_')}`,
      exerciseName: match?.name ?? aiEx.name,
      targetSets: aiEx.sets ?? 3,
      targetReps: aiEx.reps ?? '8-12',
      restSeconds: aiEx.rest_seconds ?? 90,
      notes: aiEx.notes,
    };
  });

  return { name: data.name, exercises, model: data.model };
}

// ── Demo fallback ───────────────────────────────────────────────────

function getDemoWorkout(): GenerateWorkoutResult {
  return {
    name: 'Full Body Strength',
    exercises: [
      { exerciseId: 'ex_bench_press', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: '6-10', restSeconds: 120 },
      { exerciseId: 'ex_barbell_row', exerciseName: 'Barbell Row', targetSets: 4, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex_barbell_squat', exerciseName: 'Barbell Back Squat', targetSets: 4, targetReps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex_overhead_press', exerciseName: 'Overhead Press', targetSets: 3, targetReps: '8-12', restSeconds: 90 },
      { exerciseId: 'ex_db_lunges', exerciseName: 'Dumbbell Lunges', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
      { exerciseId: 'ex_plank', exerciseName: 'Plank', targetSets: 3, targetReps: '30-45s', restSeconds: 60 },
    ],
    model: 'Demo Mode',
  };
}
