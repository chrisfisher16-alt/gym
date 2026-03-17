import type { SetType } from '@health-coach/shared';

// ── Exercise Library ────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band';

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  category: MuscleGroup;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: Equipment;
  instructions: string[];
  tips?: string[];
  isCustom: boolean;
  isTimeBased?: boolean;
  defaultDurationSeconds?: number;
  defaultSets: number;
  defaultReps: string; // e.g. "8-12"
  defaultRestSeconds: number;
}

// ── Workout Program ─────────────────────────────────────────────────

export interface WorkoutProgramLocal {
  id: string;
  userId: string;
  name: string;
  description: string;
  daysPerWeek: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  days: WorkoutDayLocal[];
  isActive: boolean;
  createdBy: 'user' | 'ai';
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutDayLocal {
  id: string;
  programId: string;
  dayNumber: number;
  name: string;
  focusArea: MuscleGroup;
  exercises: ProgramExercise[];
}

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string; // e.g. "8-12"
  restSeconds: number;
  supersetGroupId?: string;
  order: number;
  notes?: string;
}

// ── Active Workout Session ──────────────────────────────────────────

export interface ActiveWorkoutSession {
  id: string;
  programId?: string;
  dayId?: string;
  name: string;
  startedAt: string;
  exercises: ActiveExercise[];
  restTimerEndAt?: string; // ISO string for when rest timer expires
  restTimerDuration?: number; // seconds
  currentExerciseIndex: number;
  notes: string;
  mood?: number; // 1-5
  defaultRestSeconds?: number;
}

export interface ActiveExercise {
  id: string; // unique instance id
  exerciseId: string;
  exerciseName: string;
  sets: ActiveSet[];
  supersetGroupId?: string;
  isTimeBased?: boolean;
  defaultDurationSeconds?: number;
  isSkipped: boolean;
  order: number;
  notes?: string;
}

export interface ActiveSet {
  id: string;
  setNumber: number;
  setType: SetType;
  weight?: number; // in user's preferred unit (lbs or kg)
  reps?: number;
  durationSeconds?: number; // for time-based exercises
  rpe?: number; // 6-10
  isCompleted: boolean;
  isPR: boolean;
  completedAt?: string;
}

// ── Completed Session ───────────────────────────────────────────────

export interface CompletedSession {
  id: string;
  userId: string;
  programId?: string;
  dayId?: string;
  name: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  exercises: CompletedExercise[];
  totalVolume: number; // weight × reps summed
  totalSets: number;
  prCount: number;
  notes: string;
  mood?: number;
}

export interface CompletedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: CompletedSet[];
}

export interface CompletedSet {
  id: string;
  setNumber: number;
  setType: SetType;
  weight?: number;
  reps?: number;
  durationSeconds?: number; // for time-based exercises
  rpe?: number;
  isPR: boolean;
  completedAt: string;
}

// ── Personal Records ────────────────────────────────────────────────

export interface PersonalRecord {
  exerciseId: string;
  heaviestWeight: { weight: number; reps: number; date: string } | null;
  mostReps: { weight: number; reps: number; date: string } | null;
  highestVolume: { weight: number; reps: number; volume: number; date: string } | null;
}

// ── Superset ────────────────────────────────────────────────────────

export type SupersetLabel = 'Superset' | 'Tri-Set';

export interface SupersetGroup {
  id: string;
  exerciseIds: string[]; // active exercise instance ids (2-3)
  label: SupersetLabel;
}

// ── Suggested Load ──────────────────────────────────────────────────

export interface LoadSuggestion {
  suggestedWeight: number;
  suggestedReps: number;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── Rest Timer ──────────────────────────────────────────────────────

export const REST_TIMER_PRESETS = [60, 90, 120, 180] as const;
export type RestTimerPreset = (typeof REST_TIMER_PRESETS)[number];

// ── Analytics Payloads ──────────────────────────────────────────────

export interface WorkoutCompletedPayload {
  duration: number;
  totalSets: number;
  totalVolume: number;
  prCount: number;
  programId?: string;
}

export interface SetLoggedPayload {
  exerciseId: string;
  weight?: number;
  reps?: number;
  setType: SetType;
  isPR: boolean;
}

// ── Week Volume ─────────────────────────────────────────────────────

export interface DayVolume {
  date: string;
  volume: number;
  sets: number;
}
