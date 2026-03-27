import type { SetType } from '@health-coach/shared';

// ── Tracking Mode & Weight Context ─────────────────────────────────

/** Defines the primary logging pattern for an exercise */
export type TrackingMode =
  | 'weight_reps'         // Standard: weight input + reps input (bench press, squat, curl)
  | 'bodyweight_reps'     // Bodyweight: reps only, optional added weight (pull-up, push-up, dip)
  | 'duration'            // Timed hold: countdown timer (plank, dead hang, wall sit)
  | 'duration_distance'   // Cardio with distance: timer + distance (running, rowing, cycling)
  | 'duration_level'      // Machine cardio: timer + level/intensity (stairmaster, elliptical)
  | 'distance_weight'     // Loaded carry: distance + weight (farmer's walk, sled push)
  | 'reps_only';          // Pure reps, no weight possible (jumping jacks, mountain climbers)

/** Describes how weight is labeled/interpreted for a given exercise */
export type WeightContext =
  | 'barbell'             // Label: "Bar + Plates (kg)"
  | 'dumbbell_single'     // Label: "Weight (kg)" — one dumbbell
  | 'dumbbell_pair'       // Label: "Per Arm (kg)" — pair of dumbbells
  | 'dumbbell_each'       // Label: "Each (kg)" — two dumbbells held (farmer's walk)
  | 'cable_stack'         // Label: "Stack (kg)" — cable machine
  | 'machine_stack'       // Label: "Stack (kg)" — pin-select machine
  | 'machine_plates'      // Label: "Plates (kg)" — plate-loaded machine
  | 'kettlebell'          // Label: "KB (kg)"
  | 'band'                // Label: "Band" — resistance band level
  | 'bodyweight_added'    // Label: "Added (kg)" — bodyweight + extra
  | 'sled'                // Label: "On Sled (kg)"
  | 'vest'                // Label: "Vest (kg)"
  | 'body_only'           // No weight input shown
  | 'custom';             // User-defined label

/** A secondary metric that an exercise can declare (incline, speed, distance, etc.) */
export interface SecondaryMetricDef {
  type: 'incline' | 'speed' | 'distance' | 'level' | 'calories' | 'resistance';
  unit: string;           // '%', 'mph', 'kph', 'miles', 'km', 'meters', 'level', 'kcal'
  label: string;          // Display label
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

/** Suggested defaults for an exercise, keyed to its tracking mode */
export interface ExerciseDefaults {
  sets: number;
  reps?: string;                    // e.g. "8-12" (for rep-based modes)
  durationSeconds?: number;         // e.g. 60 (for duration-based modes)
  distanceValue?: number;           // e.g. 1.0 (for distance-based modes)
  distanceUnit?: 'miles' | 'km' | 'meters';
  restSeconds: number;
  secondaryDefaults?: Record<string, number>; // e.g. { incline: 10, speed: 3.5 }
}

// ── Exercise Library ────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'full_body'
  | 'warmup'
  | 'cooldown';

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

  // NEW: Tracking configuration
  trackingMode?: TrackingMode;              // Replaces isTimeBased + isBodyweight
  weightContext?: WeightContext;            // How weight is labeled for this exercise
  secondaryMetrics?: SecondaryMetricDef[];  // Incline, speed, distance, level, etc.
  defaults?: ExerciseDefaults;              // Expanded suggested defaults

  /** @deprecated Use trackingMode instead */
  isTimeBased?: boolean;
  /** @deprecated Use trackingMode instead */
  isBodyweight?: boolean;
  defaultDurationSeconds?: number;
  defaultSets: number;
  defaultReps: string; // e.g. "8-12"
  defaultRestSeconds: number;
  illustrationUrl?: string; // URL to exercise illustration
  force?: 'push' | 'pull' | 'static';
  mechanic?: 'compound' | 'isolation';
  level?: 'beginner' | 'intermediate' | 'expert';
  videoUrl?: string;
  thumbnailUrl?: string;
  heroImageUrl?: string;
}

// ── Day Types ───────────────────────────────────────────────────────

export type DayType = 'lifting' | 'rest' | 'mobility' | 'cardio' | 'active_recovery';

export interface CardioSuggestion {
  name: string;
  description: string;
  duration: string;
  icon: string; // Ionicons name
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  lifting: 'Lifting',
  rest: 'Rest',
  mobility: 'Stretch / Mobility',
  cardio: 'Cardio',
  active_recovery: 'Active Recovery',
};

export const DAY_TYPE_COLORS: Record<DayType, string> = {
  lifting: '#3B82F6',      // blue
  rest: '#6B7280',         // gray
  mobility: '#8B5CF6',     // purple
  cardio: '#7A9A65',       // green
  active_recovery: '#F59E0B', // amber
};

export const DAY_TYPE_ICONS: Record<DayType, string> = {
  lifting: 'barbell-outline',
  rest: 'bed-outline',
  mobility: 'body-outline',
  cardio: 'heart-outline',
  active_recovery: 'walk-outline',
};

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
  /** True when the user has manually edited this program; prevents seed-data overwrites on init. */
  customized?: boolean;
}

export interface WorkoutDayLocal {
  id: string;
  programId: string;
  dayNumber: number;
  name: string;
  dayType: DayType;
  focusArea: MuscleGroup;
  exercises: ProgramExercise[];
  recoveryNotes?: string;
  cardioSuggestions?: CardioSuggestion[];
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
  restTimerExerciseId?: string;
}

export interface ActiveExercise {
  id: string; // unique instance id
  exerciseId: string;
  exerciseName: string;
  sets: ActiveSet[];
  supersetGroupId?: string;

  // NEW: Tracking metadata (carried from ExerciseLibraryEntry)
  trackingMode?: TrackingMode;
  weightContext?: WeightContext;
  secondaryMetrics?: SecondaryMetricDef[];

  /** @deprecated Use trackingMode instead */
  isTimeBased?: boolean;
  /** @deprecated Use trackingMode instead */
  isBodyweight?: boolean;
  defaultDurationSeconds?: number;
  restSeconds?: number; // per-exercise rest time override
  isSkipped: boolean;
  order: number;
  notes?: string;
  targetReps?: string;
  restTimerMode?: 'auto' | 'manual' | 'disabled' | 'off' | 'custom';
  restTimerCustomSeconds?: number;
}

export interface ActiveSet {
  id: string;
  setNumber: number;
  setType: SetType;
  weight?: number;            // in user's preferred unit (lbs or kg)
  reps?: number;
  durationSeconds?: number;   // for time-based / duration exercises
  rpe?: number;               // 6-10
  isCompleted: boolean;
  isPR: boolean;
  completedAt?: string;
  isAutoFilled?: boolean;

  // NEW: Secondary metrics (populated based on trackingMode)
  distance?: number;          // miles, km, or meters
  distanceUnit?: 'miles' | 'km' | 'meters';
  incline?: number;           // percentage (0-40)
  speed?: number;             // mph or kph
  speedUnit?: 'mph' | 'kph';
  level?: number;             // machine level/intensity (1-25)
  calories?: number;          // estimated or machine-reported
  resistance?: number;        // band/machine resistance level
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
  restSeconds?: number;
}

export interface CompletedSet {
  id: string;
  setNumber: number;
  setType: SetType;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  rpe?: number;
  isPR: boolean;
  completedAt: string;

  // Secondary metrics
  distance?: number;
  distanceUnit?: 'miles' | 'km' | 'meters';
  incline?: number;
  speed?: number;
  speedUnit?: 'mph' | 'kph';
  level?: number;
  calories?: number;
  resistance?: number;
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

// ── Muscle Anatomy ──────────────────────────────────────────────────

export type MuscleId =
  | 'pectoralis_major'
  | 'pectoralis_minor'
  | 'deltoid_anterior'
  | 'deltoid_lateral'
  | 'deltoid_posterior'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'brachialis'
  | 'brachioradialis'
  | 'rectus_abdominis'
  | 'obliques'
  | 'transverse_abdominis'
  | 'trapezius'
  | 'rhomboids'
  | 'latissimus_dorsi'
  | 'erector_spinae'
  | 'lower_back'
  | 'upper_back'
  | 'rotator_cuff'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'gluteus_medius'
  | 'gluteus_minimus'
  | 'hip_flexors'
  | 'adductors'
  | 'piriformis'
  | 'calves'
  | 'gastrocnemius'
  | 'soleus'
  | 'abductors'
  | 'tibialis_anterior';

export interface MuscleDiagramEntry {
  muscle: MuscleId;
  opacity: number;
}

export interface MuscleDiagramData {
  primaryMuscles: MuscleDiagramEntry[];
  secondaryMuscles: MuscleDiagramEntry[];
}

// ── Smart Workout ───────────────────────────────────────────────────

export type WorkoutGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness' | 'weight_loss';

export type WorkoutMode = 'ai_suggested' | 'custom' | 'program';

export interface SmartExercise {
  exerciseId: string;
  exerciseName: string;
  category: MuscleGroup;
  equipment: Equipment;
  targetSets: number;
  targetReps: string;
  suggestedWeight?: number;
  restSeconds: number;
  isCompound: boolean;
  supersetGroupId?: string;
}

export interface SmartWorkout {
  id: string;
  name: string;
  targetMuscles: string[];
  exercises: SmartExercise[];
  estimatedDurationMinutes: number;
  totalSets: number;
  aiExplanation: string;
  recoveryStatus: Record<string, number>;
  generatedAt: string;
  goal: WorkoutGoal;
  isRestDay?: boolean;
  warmupExerciseIds?: string[];
}

// ── Exercise History ────────────────────────────────────────────────

export interface ExerciseHistoryEntry {
  exerciseId: string;
  lastWeight: number;
  lastReps: number;
  lastDate: string;
  personalRecord: {
    weight: number;
    reps: number;
  };
}
