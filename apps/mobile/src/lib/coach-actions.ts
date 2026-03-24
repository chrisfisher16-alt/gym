// ── Coach Action System ───────────────────────────────────────────────
// Parses [ACTION]...[/ACTION] blocks from AI responses and executes them
// against the appropriate stores (workout, nutrition).

import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useProfileStore } from '../stores/profile-store';
import { useGroceryStore } from '../stores/grocery-store';
import type { ProgramExercise, DayType, MuscleGroup, WorkoutProgramLocal, WorkoutDayLocal } from '../types/workout';
import type { MealType } from '../types/nutrition';

// ── Action Types ─────────────────────────────────────────────────────

export interface SwapExerciseAction {
  type: 'swap_exercise';
  programId: string;
  dayIndex: number;
  exerciseId: string;
  newExerciseId: string;
  newExerciseName?: string;
}

export interface UpdateTargetsAction {
  type: 'update_targets';
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  water_oz?: number;
}

export interface AddExerciseAction {
  type: 'add_exercise';
  programId: string;
  dayIndex: number;
  exercise: {
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps: string;
    restSeconds: number;
  };
}

export interface RemoveExerciseAction {
  type: 'remove_exercise';
  programId: string;
  dayIndex: number;
  exerciseId: string;
}

export interface UpdateRestAction {
  type: 'update_rest';
  programId: string;
  dayIndex: number;
  exerciseId: string;
  restSeconds: number;
}

export interface UpdateProgramAction {
  type: 'update_program';
  programId: string;
  dayIndex: number;
  exerciseId: string;
  targetSets?: number;
  targetReps?: string;
}

export interface LogQuickMealAction {
  type: 'log_quick_meal';
  name: string;
  mealType?: MealType; // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface SetActiveProgramAction {
  type: 'set_active_program';
  programId: string;
}

export interface UpdateProfileAction {
  type: 'update_profile';
  field: string;
  value: string | number | string[];
}

export interface LogWaterAction {
  type: 'log_water';
  amount_oz: number;
}

export interface CreateWeeklyPlanAction {
  type: 'create_weekly_plan';
  name: string;
  description: string;
  daysPerWeek: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  days: Array<{
    dayNumber: number;
    name: string;
    dayType: DayType;
    focusArea: MuscleGroup;
    exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      targetSets: number;
      targetReps: string;
      restSeconds: number;
    }>;
    recoveryNotes?: string;
  }>;
}

export interface GenerateWorkoutAction {
  type: 'generate_workout';
  name: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps: string;
    restSeconds: number;
  }>;
}

export type CoachAction =
  | SwapExerciseAction
  | UpdateTargetsAction
  | AddExerciseAction
  | RemoveExerciseAction
  | UpdateRestAction
  | UpdateProgramAction
  | LogQuickMealAction
  | SetActiveProgramAction
  | UpdateProfileAction
  | LogWaterAction
  | CreateWeeklyPlanAction
  | GenerateWorkoutAction;

// ── Parsing ──────────────────────────────────────────────────────────

const KNOWN_ACTION_TYPES = [
  'create_weekly_plan',
  'generate_workout',
  'set_active_program',
  'swap_exercise',
  'add_exercise',
  'remove_exercise',
  'update_rest',
  'update_program',
  'update_targets',
  'log_quick_meal',
  'update_profile',
  'log_water',
] as const;

/** Extract the first complete JSON object from a string by counting braces */
function extractJsonObject(str: string): string | null {
  if (!str.startsWith('{')) return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return str.substring(0, i + 1);
      }
    }
  }

  return null; // No complete JSON object found
}

/**
 * Parse action blocks from an AI response.
 * Handles three formats:
 *   1. [ACTION]...[/ACTION]  (wrapped with closing tag)
 *   2. [ACTION]{...}         (unwrapped JSON — AI often omits closing tag)
 *   3. Raw JSON with a known action type (no wrapper at all)
 * Returns the cleaned text (with action blocks removed) and parsed actions.
 */
export function parseCoachActions(response: string): {
  text: string;
  actions: CoachAction[];
} {
  const actions: CoachAction[] = [];
  let text = response;

  // ── Pattern 1: [ACTION]...[/ACTION] (wrapped) ──────────────────────
  const wrappedRegex = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g;
  let hasWrapped = false;
  let match: RegExpExecArray | null;

  while ((match = wrappedRegex.exec(response)) !== null) {
    hasWrapped = true;
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object' && parsed.type) {
        actions.push(parsed as CoachAction);
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  if (hasWrapped) {
    text = text
      .replace(wrappedRegex, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { text, actions };
  }

  // ── Pattern 2: [ACTION]{...} (unwrapped — no closing tag) ──────────
  const unwrappedRegex = /\[ACTION\](\{[\s\S]*)/g;
  while ((match = unwrappedRegex.exec(response)) !== null) {
    const jsonStr = match[1].trim();
    const extracted = extractJsonObject(jsonStr);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          actions.push(parsed as CoachAction);
          text = text.replace('[ACTION]' + extracted, '');
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  if (actions.length > 0) {
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return { text, actions };
  }

  // ── Fallback: raw JSON with a known action type (no wrapper) ───────
  const typesPattern = KNOWN_ACTION_TYPES.join('|');
  const rawJsonRegex = new RegExp(
    `(\\{"type"\\s*:\\s*"(?:${typesPattern})")[\\s\\S]*`,
  );
  const rawMatch = rawJsonRegex.exec(response);
  if (rawMatch) {
    // rawMatch starts at the opening brace — rebuild from there
    const startIdx = rawMatch.index;
    const extracted = extractJsonObject(response.substring(startIdx));
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          actions.push(parsed as CoachAction);
          text = text.replace(extracted, '');
        }
      } catch {
        // Invalid JSON
      }
    }
  }

  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return { text, actions };
}

// ── Execution ────────────────────────────────────────────────────────

/**
 * Execute a single coach action against the appropriate store.
 */
export async function executeCoachAction(
  action: CoachAction,
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.type) {
      case 'swap_exercise':
        return executeSwapExercise(action);
      case 'update_targets':
        return executeUpdateTargets(action);
      case 'add_exercise':
        return executeAddExercise(action);
      case 'remove_exercise':
        return executeRemoveExercise(action);
      case 'update_rest':
        return executeUpdateRest(action);
      case 'update_program':
        return executeUpdateProgram(action);
      case 'log_quick_meal':
        return executeLogQuickMeal(action);
      case 'set_active_program':
        return executeSetActiveProgram(action);
      case 'update_profile':
        return executeUpdateProfile(action);
      case 'log_water':
        return executeLogWater(action);
      case 'create_weekly_plan':
        return executeCreateWeeklyPlan(action);
      case 'generate_workout':
        return executeGenerateWorkout(action);
      default:
        return { success: false, message: 'Unknown action type' };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Action failed',
    };
  }
}

function executeSwapExercise(action: SwapExerciseAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };

  const day = program.days[action.dayIndex];
  if (!day) return { success: false, message: 'Day not found in program' };

  const exerciseIdx = day.exercises.findIndex(
    (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
  );
  if (exerciseIdx === -1) return { success: false, message: 'Exercise not found in day' };

  // Find the new exercise in the library
  const newLibExercise = store.exercises.find((e) => e.id === action.newExerciseId);
  const newName = action.newExerciseName ?? newLibExercise?.name ?? action.newExerciseId;

  const updatedDays = [...program.days];
  const updatedExercises = [...updatedDays[action.dayIndex].exercises];
  updatedExercises[exerciseIdx] = {
    ...updatedExercises[exerciseIdx],
    exerciseId: action.newExerciseId,
    exerciseName: newName,
  };
  updatedDays[action.dayIndex] = { ...updatedDays[action.dayIndex], exercises: updatedExercises };

  store.updateProgram({
    ...program,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, message: `Swapped to ${newName}` };
}

function executeUpdateTargets(action: UpdateTargetsAction): { success: boolean; message: string } {
  const store = useNutritionStore.getState();
  const current = store.targets;

  store.setDailyTargets({
    calories: action.calories ?? current.calories,
    protein_g: action.protein ?? current.protein_g,
    carbs_g: action.carbs ?? current.carbs_g,
    fat_g: action.fat ?? current.fat_g,
    fiber_g: action.fiber ?? current.fiber_g,
    water_oz: action.water_oz ?? current.water_oz,
  });

  const changes: string[] = [];
  if (action.calories != null) changes.push(`${action.calories} cal`);
  if (action.protein != null) changes.push(`${action.protein}g protein`);
  if (action.carbs != null) changes.push(`${action.carbs}g carbs`);
  if (action.fat != null) changes.push(`${action.fat}g fat`);

  return { success: true, message: `Updated targets: ${changes.join(', ')}` };
}

function executeAddExercise(action: AddExerciseAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };

  const day = program.days[action.dayIndex];
  if (!day) return { success: false, message: 'Day not found in program' };

  const newExercise: ProgramExercise = {
    id: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    exerciseId: action.exercise.exerciseId,
    exerciseName: action.exercise.exerciseName,
    targetSets: action.exercise.targetSets,
    targetReps: action.exercise.targetReps,
    restSeconds: action.exercise.restSeconds,
    order: day.exercises.length,
  };

  const updatedDays = [...program.days];
  updatedDays[action.dayIndex] = {
    ...updatedDays[action.dayIndex],
    exercises: [...updatedDays[action.dayIndex].exercises, newExercise],
  };

  store.updateProgram({
    ...program,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, message: `Added ${action.exercise.exerciseName}` };
}

function executeRemoveExercise(action: RemoveExerciseAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };

  const day = program.days[action.dayIndex];
  if (!day) return { success: false, message: 'Day not found in program' };

  const exerciseToRemove = day.exercises.find(
    (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
  );
  if (!exerciseToRemove) return { success: false, message: 'Exercise not found in day' };

  const updatedDays = [...program.days];
  updatedDays[action.dayIndex] = {
    ...updatedDays[action.dayIndex],
    exercises: updatedDays[action.dayIndex].exercises.filter(
      (e) => e.exerciseId !== action.exerciseId && e.id !== action.exerciseId,
    ),
  };

  store.updateProgram({
    ...program,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, message: `Removed ${exerciseToRemove.exerciseName}` };
}

function executeUpdateRest(action: UpdateRestAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };

  const day = program.days[action.dayIndex];
  if (!day) return { success: false, message: 'Day not found in program' };

  const exerciseIdx = day.exercises.findIndex(
    (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
  );
  if (exerciseIdx === -1) return { success: false, message: 'Exercise not found in day' };

  const updatedDays = [...program.days];
  const updatedExercises = [...updatedDays[action.dayIndex].exercises];
  updatedExercises[exerciseIdx] = {
    ...updatedExercises[exerciseIdx],
    restSeconds: action.restSeconds,
  };
  updatedDays[action.dayIndex] = { ...updatedDays[action.dayIndex], exercises: updatedExercises };

  store.updateProgram({
    ...program,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, message: `Updated rest time to ${action.restSeconds}s` };
}

function executeUpdateProgram(action: UpdateProgramAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };

  const day = program.days[action.dayIndex];
  if (!day) return { success: false, message: 'Day not found in program' };

  const exerciseIdx = day.exercises.findIndex(
    (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
  );
  if (exerciseIdx === -1) return { success: false, message: 'Exercise not found in day' };

  const updatedDays = [...program.days];
  const updatedExercises = [...updatedDays[action.dayIndex].exercises];
  updatedExercises[exerciseIdx] = {
    ...updatedExercises[exerciseIdx],
    ...(action.targetSets != null ? { targetSets: action.targetSets } : {}),
    ...(action.targetReps != null ? { targetReps: action.targetReps } : {}),
  };
  updatedDays[action.dayIndex] = { ...updatedDays[action.dayIndex], exercises: updatedExercises };

  store.updateProgram({
    ...program,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  });

  const changes: string[] = [];
  if (action.targetSets != null) changes.push(`${action.targetSets} sets`);
  if (action.targetReps != null) changes.push(`${action.targetReps} reps`);
  return { success: true, message: `Updated to ${changes.join(', ')}` };
}

function executeLogQuickMeal(action: LogQuickMealAction): { success: boolean; message: string } {
  const store = useNutritionStore.getState();
  const mealType = action.mealType ?? 'snack';
  store.logMeal({
    mealType,
    name: action.name,
    items: [{
      id: `item_${Date.now()}`,
      name: action.name,
      calories: action.calories,
      protein_g: action.protein_g ?? 0,
      carbs_g: action.carbs_g ?? 0,
      fat_g: action.fat_g ?? 0,
      fiber_g: 0,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
    }],
    source: 'manual',
    timestamp: new Date().toISOString(),
  });
  return { success: true, message: `Logged ${action.name} (~${action.calories} cal)` };
}

function executeSetActiveProgram(action: SetActiveProgramAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const program = store.programs.find((p) => p.id === action.programId);
  if (!program) return { success: false, message: 'Program not found' };
  store.setActiveProgram(action.programId);
  return { success: true, message: `Switched to ${program.name}` };
}

function executeUpdateProfile(action: UpdateProfileAction): { success: boolean; message: string } {
  const store = useProfileStore.getState();
  const allowedFields = [
    'targetWeightKg', 'activityLevel', 'trainingDaysPerWeek',
    'primaryGoal', 'trainingExperience', 'preferredTrainingTime',
    'injuriesOrLimitations', 'cookingSkillLevel',
  ];
  const allowedArrayFields = [
    'healthGoals', 'allergies', 'dietaryPreferences',
    'cookingEquipment', 'fitnessEquipment', 'preferredWorkoutDays',
  ];

  if (allowedFields.includes(action.field)) {
    store.updateProfile({ [action.field]: action.value });
    return { success: true, message: `Updated ${action.field} to ${action.value}` };
  }
  if (allowedArrayFields.includes(action.field)) {
    const val = Array.isArray(action.value) ? action.value : [action.value];
    store.updateProfile({ [action.field]: val });
    return { success: true, message: `Updated ${action.field}` };
  }
  return { success: false, message: `Cannot update field: ${action.field}` };
}

function executeLogWater(action: LogWaterAction): { success: boolean; message: string } {
  const store = useNutritionStore.getState();
  store.logWater(action.amount_oz);
  return { success: true, message: `Logged ${action.amount_oz}oz water` };
}

function executeCreateWeeklyPlan(action: CreateWeeklyPlanAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();
  const userId = store.programs[0]?.userId ?? 'local_user';
  const now = new Date().toISOString();
  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const days: WorkoutDayLocal[] = action.days.map((d) => ({
    id: `day_${planId}_${d.dayNumber}`,
    programId: planId,
    dayNumber: d.dayNumber,
    name: d.name,
    dayType: d.dayType,
    focusArea: d.focusArea,
    recoveryNotes: d.recoveryNotes,
    exercises: d.exercises.map((e, idx) => ({
      id: `pe_${planId}_${d.dayNumber}_${idx}`,
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      restSeconds: e.restSeconds,
      order: idx,
    })),
  }));

  const program: WorkoutProgramLocal = {
    id: planId,
    userId,
    name: action.name,
    description: action.description,
    daysPerWeek: action.daysPerWeek,
    difficulty: action.difficulty,
    days,
    isActive: true,
    createdBy: 'ai',
    createdAt: now,
    updatedAt: now,
  };

  // Deactivate other programs and add the new one as active
  for (const p of store.programs) {
    if (p.isActive) {
      store.updateProgram({ ...p, isActive: false });
    }
  }
  store.addProgram(program);

  const liftDays = days.filter((d) => d.dayType === 'lifting').length;
  return { success: true, message: `Created "${action.name}" — ${liftDays} lifting days, set as active program` };
}

function executeGenerateWorkout(action: GenerateWorkoutAction): { success: boolean; message: string } {
  const store = useWorkoutStore.getState();

  if (store.activeSession) {
    return { success: false, message: 'A workout is already in progress. Finish or discard it first.' };
  }

  if (!action.exercises || action.exercises.length === 0) {
    return { success: false, message: 'No exercises in the workout' };
  }

  store.startWorkout({
    name: action.name,
    exercises: action.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      restSeconds: e.restSeconds,
    })),
  });

  return { success: true, message: `Started "${action.name}" with ${action.exercises.length} exercises` };
}

// ── Display Helpers ──────────────────────────────────────────────────

/**
 * Get a human-readable description of a coach action for display as a button label.
 */
export function getActionDescription(action: CoachAction): string {
  switch (action.type) {
    case 'swap_exercise': {
      const store = useWorkoutStore.getState();
      const program = store.programs.find((p) => p.id === action.programId);
      const day = program?.days[action.dayIndex];
      const oldExercise = day?.exercises.find(
        (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
      );
      const newLib = store.exercises.find((e) => e.id === action.newExerciseId);
      const oldName = oldExercise?.exerciseName ?? action.exerciseId;
      const newName = action.newExerciseName ?? newLib?.name ?? action.newExerciseId;
      return `Swap ${oldName} → ${newName}`;
    }
    case 'update_targets': {
      const parts: string[] = [];
      if (action.calories != null) parts.push(`${action.calories} cal`);
      if (action.protein != null) parts.push(`${action.protein}g protein`);
      if (action.carbs != null) parts.push(`${action.carbs}g carbs`);
      if (action.fat != null) parts.push(`${action.fat}g fat`);
      return `Update nutrition targets: ${parts.join(', ')}`;
    }
    case 'add_exercise':
      return `Add ${action.exercise.exerciseName} (${action.exercise.targetSets}×${action.exercise.targetReps})`;
    case 'remove_exercise': {
      const store = useWorkoutStore.getState();
      const program = store.programs.find((p) => p.id === action.programId);
      const day = program?.days[action.dayIndex];
      const exercise = day?.exercises.find(
        (e) => e.exerciseId === action.exerciseId || e.id === action.exerciseId,
      );
      return `Remove ${exercise?.exerciseName ?? action.exerciseId}`;
    }
    case 'update_rest':
      return `Update rest time to ${action.restSeconds}s`;
    case 'update_program': {
      const parts: string[] = [];
      if (action.targetSets != null) parts.push(`${action.targetSets} sets`);
      if (action.targetReps != null) parts.push(`${action.targetReps} reps`);
      return `Update exercise: ${parts.join(', ')}`;
    }
    case 'log_quick_meal':
      return `Log meal: ${action.name} (~${action.calories} cal)`;
    case 'set_active_program': {
      const store = useWorkoutStore.getState();
      const prog = store.programs.find((p) => p.id === action.programId);
      return `Switch to program: ${prog?.name ?? action.programId}`;
    }
    case 'update_profile':
      return `Update ${action.field}: ${Array.isArray(action.value) ? action.value.join(', ') : action.value}`;
    case 'log_water':
      return `Log ${action.amount_oz}oz water`;
    case 'create_weekly_plan': {
      const liftDays = action.days.filter((d) => d.dayType === 'lifting').length;
      return `Create plan: ${action.name} (${liftDays} lifting days)`;
    }
    case 'generate_workout': {
      const exerciseCount = action.exercises?.length ?? 0;
      return `Start workout: ${action.name} (${exerciseCount} exercises)`;
    }
    default:
      return 'Apply change';
  }
}
