// ── Coach System Prompt Builder ──────────────────────────────────────
// Builds a comprehensive system prompt with user context for the AI coach.
//
// Architecture: the prompt is assembled from composable "sections" so that
// individual pieces (identity, guardrails, goal coaching, actions, etc.)
// can be maintained independently.  Each section is a pure function that
// receives the gathered UserContext and returns a string (or empty string
// to opt-out).

import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useAuthStore } from '../stores/auth-store';
import { useProfileStore } from '../stores/profile-store';
import { useGroceryStore } from '../stores/grocery-store';
import type { CompletedSession, CompletedSet, PersonalRecord } from '../types/workout';
import type { DailyNutritionLog, NutritionTargets } from '../types/nutrition';
import { getDateString } from '../lib/nutrition-utils';
import { type UserIntent, type ContextRequirements, INTENT_CONTEXT_MAP } from './intent-detector';

// ── Types ───────────────────────────────────────────────────────────

export type CoachTone = 'direct' | 'balanced' | 'encouraging';

export interface UserContext {
  displayName?: string;
  goals?: string;
  coachTone: CoachTone;
  unitPreference: 'imperial' | 'metric';
  recentWorkouts: WorkoutSummary[];
  recentNutrition: NutritionSummary[];
  nutritionTargets: NutritionTargets;
  // Profile / questionnaire
  primaryGoal?: string;
  trainingExperience?: string;
  trainingDaysPerWeek?: number;
  availableEquipment?: string[];
  injuriesOrLimitations?: string;
  preferredTrainingTime?: string;
  activityLevel?: number;
  dietaryRestrictions?: string;
  allergies?: string[];
  // Cooking & dietary
  dietaryPreferences?: string[];
  cookingSkillLevel?: string;
  cookingEquipment?: string[];
  // Workout scheduling
  preferredWorkoutDays?: string[];
  fitnessEquipment?: string[];
  // Health goals
  healthGoals?: string[];
  healthGoalDescription?: string;
  // Body stats
  heightCm?: number;
  weightKg?: number;
  gender?: string;
  // Active program
  activeProgramSummary?: string;
  // Water intake
  todayWaterOz?: number;
  // Recent meal details
  recentMealDetails?: string;
  // Extended context
  targetWeightKg?: number;
  age?: number;
  personalRecordsSummary?: string;
  programProgressSummary?: string;
  savedMealsSummary?: string;
  recipesSummary?: string;
  groceryListSummary?: string;
  supplementsSummary?: string;
  activeSessionSummary?: string;
  allProgramsSummary?: string;
  conversationSummaries?: string[];
}

interface WorkoutSummary {
  name: string;
  date: string;
  exercises: Array<{
    name: string;
    sets: number;
    bestSet: string;
  }>;
  durationMinutes: number;
}

interface NutritionSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXT GATHERING — pulls live data from stores
// ═══════════════════════════════════════════════════════════════════════

function getActiveProgramSummary(): string {
  const store = useWorkoutStore.getState();
  const activeProgram = store.programs.find((p) => p.isActive);
  if (!activeProgram) return '';

  const daysSummary = activeProgram.days.map((day) => {
    const exercises = day.exercises
      .map((e) => `    • ${e.exerciseName}: ${e.targetSets}×${e.targetReps} (rest: ${e.restSeconds}s)`)
      .join('\n');
    return `  Day ${day.dayNumber} — ${day.name} (${day.focusArea}):\n${exercises}`;
  }).join('\n');

  return `Program: ${activeProgram.name} (${activeProgram.difficulty}, ${activeProgram.daysPerWeek} days/week)\n${daysSummary}`;
}

function getRecentMealDetails(days = 3): string {
  const store = useNutritionStore.getState();
  const logsRecord = (store.dailyLogs ?? {}) as Record<string, DailyNutritionLog>;
  const today = new Date();
  const details: string[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getDateString(d);
    const log = logsRecord[dateStr];

    if (log && log.meals.length > 0) {
      const mealLines = log.meals.map((meal) => {
        const itemNames = meal.items.map((item) => item.name).join(', ');
        const totalCals = meal.items.reduce((sum, item) => sum + item.calories, 0);
        return `    ${meal.mealType}: ${meal.name ?? itemNames} (~${Math.round(totalCals)} cal)`;
      }).join('\n');
      details.push(`  ${dateStr}:\n${mealLines}`);
    }
  }

  return details.length > 0 ? details.join('\n') : '';
}

function getRecentWorkouts(limit = 5): WorkoutSummary[] {
  const history = useWorkoutStore.getState().history;
  return history.slice(0, limit).map((session: CompletedSession) => ({
    name: session.name,
    date: new Date(session.completedAt).toLocaleDateString(),
    exercises: session.exercises.map((ex) => {
      const bestSet = ex.sets.reduce(
        (best: { vol: number; str: string }, s: CompletedSet) => {
          const vol = (s.weight ?? 0) * (s.reps ?? 0);
          return vol > best.vol ? { vol, str: `${s.weight ?? 0}×${s.reps ?? 0}` } : best;
        },
        { vol: 0, str: 'N/A' },
      );
      return {
        name: ex.exerciseName,
        sets: ex.sets.length,
        bestSet: bestSet.str,
      };
    }),
    durationMinutes: Math.round(session.durationSeconds / 60),
  }));
}

function getRecentNutrition(days = 3): NutritionSummary[] {
  const store = useNutritionStore.getState();
  const logsRecord = (store.dailyLogs ?? {}) as Record<string, DailyNutritionLog>;
  const today = new Date();
  const summaries: NutritionSummary[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getDateString(d);
    const log = logsRecord[dateStr];

    if (log) {
      let cals = 0, protein = 0, carbs = 0, fat = 0, mealCount = 0;
      for (const meal of log.meals) {
        mealCount++;
        for (const item of meal.items) {
          cals += item.calories;
          protein += item.protein_g;
          carbs += item.carbs_g;
          fat += item.fat_g;
        }
      }
      summaries.push({
        date: dateStr,
        calories: Math.round(cals),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        mealCount,
      });
    }
  }

  return summaries;
}

function getPersonalRecordsSummary(): string {
  const { personalRecords, exercises } = useWorkoutStore.getState();
  const entries = Object.values(personalRecords) as PersonalRecord[];
  if (entries.length === 0) return '';

  const sorted = entries
    .filter((pr) => pr.highestVolume)
    .sort((a, b) => (b.highestVolume?.volume ?? 0) - (a.highestVolume?.volume ?? 0))
    .slice(0, 10);

  if (sorted.length === 0) return '';

  return sorted.map((pr) => {
    const exName = exercises.find((e) => e.id === pr.exerciseId)?.name ?? pr.exerciseId;
    const hw = pr.heaviestWeight;
    return `  ${exName}: best ${hw?.weight ?? '?'}×${hw?.reps ?? '?'} (${hw?.date ? new Date(hw.date).toLocaleDateString() : 'N/A'})`;
  }).join('\n');
}

function getProgramProgressSummary(): string {
  const store = useWorkoutStore.getState();
  const activeProgram = store.programs.find((p) => p.isActive);
  if (!activeProgram) return '';

  const progress = store.getProgramProgress(activeProgram.id);
  return `${activeProgram.name}: ${progress.completedDays}/${progress.totalDays} sessions (${progress.percentComplete}% complete)`;
}

function getSavedMealsSummary(): string {
  const { savedMeals } = useNutritionStore.getState();
  if (!savedMeals || savedMeals.length === 0) return '';
  return savedMeals.slice(0, 10).map((m) => {
    const totalCal = m.items.reduce((s, i) => s + i.calories, 0);
    return `  ${m.name} (~${Math.round(totalCal)} cal)`;
  }).join('\n');
}

function getRecipesSummary(): string {
  const { recipes } = useNutritionStore.getState();
  if (!recipes || recipes.length === 0) return '';
  return recipes.slice(0, 10).map((r) => {
    const totalCal = r.items.reduce((s, i) => s + i.calories, 0);
    return `  ${r.name} (${r.servings} servings, ~${Math.round(totalCal)} cal total)`;
  }).join('\n');
}

function getGroceryListSummary(): string {
  const { currentList } = useGroceryStore.getState();
  if (!currentList) return '';
  const totalItems = currentList.categories.reduce((s, c) => s + c.items.length, 0);
  const checkedItems = currentList.categories.reduce(
    (s, c) => s + c.items.filter((i) => i.checked).length, 0,
  );
  const categories = currentList.categories.map((c) => `  ${c.name}: ${c.items.length} items`).join('\n');
  return `${totalItems} items (${checkedItems} checked), ${currentList.daysPlanned} days planned\n${categories}`;
}

function getSupplementsSummary(): string {
  const store = useNutritionStore.getState();
  const { userSupplements } = store;
  if (!userSupplements || userSupplements.length === 0) return '';

  const todayLog = store.dailyLogs?.[getDateString(new Date())] as DailyNutritionLog | undefined;
  const takenToday = new Set(todayLog?.supplementsTaken ?? []);

  return userSupplements.map((s) => {
    const taken = takenToday.has(s.id) ? '✓' : '○';
    return `  ${taken} ${s.supplementName} (${s.dose} ${s.unit}, ${s.frequency}, ${s.timeOfDay})`;
  }).join('\n');
}

function getActiveSessionSummary(): string {
  const { activeSession } = useWorkoutStore.getState();
  if (!activeSession) return '';

  const elapsed = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000 / 60);
  const completedSets = activeSession.exercises.reduce(
    (s, e) => s + e.sets.filter((set) => set.isCompleted).length, 0,
  );
  const totalSets = activeSession.exercises.reduce((s, e) => s + e.sets.length, 0);
  const exercises = activeSession.exercises
    .map((e) => {
      const done = e.sets.filter((s) => s.isCompleted).length;
      return `  ${e.exerciseName}: ${done}/${e.sets.length} sets${e.isSkipped ? ' (skipped)' : ''}`;
    })
    .join('\n');

  return `Workout: ${activeSession.name} (${elapsed} min elapsed, ${completedSets}/${totalSets} sets done)\n${exercises}`;
}

function getAllProgramsSummary(): string {
  const { programs } = useWorkoutStore.getState();
  if (programs.length === 0) return '';
  return programs.map((p) => {
    const liftDays = p.days.filter((d) => d.dayType === 'lifting').length;
    return `  ${p.isActive ? '→ ' : '  '}${p.name} (ID: ${p.id}) — ${p.daysPerWeek} days/week, ${liftDays} lifting, ${p.difficulty}`;
  }).join('\n');
}

function getExerciseLibrarySummary(): string {
  const { exercises } = useWorkoutStore.getState();
  if (exercises.length === 0) return '';

  const byCategory: Record<string, string[]> = {};
  for (const ex of exercises) {
    const cat = ex.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(`${ex.name} (${ex.equipment})`);
  }

  return Object.entries(byCategory)
    .map(([cat, names]) => `  ${cat}: ${names.join(', ')}`)
    .join('\n');
}

/**
 * Filtered + compressed exercise library summary.
 * Filters exercises to only those matching user's available equipment
 * (always includes bodyweight). Uses compact `id:Name` format.
 */
function getFilteredExerciseLibrarySummary(ctx: UserContext): string {
  const { exercises } = useWorkoutStore.getState();
  if (exercises.length === 0) return '';

  const totalCount = exercises.length;

  // Merge equipment sources, always include bodyweight
  const userEquipment = new Set<string>(['bodyweight']);
  if (ctx.availableEquipment && ctx.availableEquipment.length > 0) {
    for (const e of ctx.availableEquipment) userEquipment.add(e.toLowerCase());
  }
  if (ctx.fitnessEquipment && ctx.fitnessEquipment.length > 0) {
    for (const e of ctx.fitnessEquipment) userEquipment.add(e.toLowerCase());
  }

  // If no equipment info available (only bodyweight from default), use full list
  const hasEquipmentInfo = userEquipment.size > 1;
  const filtered = hasEquipmentInfo
    ? exercises.filter((ex) => userEquipment.has(ex.equipment))
    : exercises;

  const byCategory: Record<string, string[]> = {};
  for (const ex of filtered) {
    const cat = ex.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(`${ex.id}:${ex.name}`);
  }

  const lines = Object.entries(byCategory)
    .map(([cat, entries]) => `  ${cat}: ${entries.join(', ')}`)
    .join('\n');

  const filteredCount = filtered.length;
  const countNote = hasEquipmentInfo
    ? `\n(${filteredCount} exercises shown matching your equipment. ${totalCount} total in library.)`
    : `\n(${totalCount} exercises in library.)`;

  // Truncate to prevent token overflow on small models
  const MAX_CHARS = 3000;
  if (lines.length > MAX_CHARS) {
    const truncated = lines.substring(0, MAX_CHARS);
    const lastNewline = truncated.lastIndexOf('\n');
    const lineCount = truncated.substring(0, lastNewline).split('\n').length;
    return truncated.substring(0, lastNewline) + `\n  ... (${filteredCount - lineCount} more exercises)` + countNote;
  }

  return lines + countNote;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════

export function gatherUserContext(intent?: UserIntent): UserContext {
  const requirements: ContextRequirements | undefined = intent
    ? INTENT_CONTEXT_MAP[intent]
    : undefined;

  const authState = useAuthStore.getState();
  const nutritionState = useNutritionStore.getState();
  const profileStore = useProfileStore.getState();
  const profile = authState.profile;
  const coachPrefs = authState.coachPreferences;
  const userProfile = profileStore.profile;

  const todayLog = nutritionState.dailyLogs?.[getDateString(new Date())] as DailyNutritionLog | undefined;

  // When intent is provided, skip expensive data gathering for sections
  // that won't be included in the dynamic layer.
  const needWorkouts = !requirements || requirements.recentWorkouts;
  const needNutrition = !requirements || requirements.recentNutrition;
  const needPRs = !requirements || requirements.personalRecords;
  const needProgram = !requirements || requirements.activeProgram;
  const needAllPrograms = !requirements || requirements.allPrograms;
  const needSavedMeals = !requirements || requirements.savedMeals;
  const needGrocery = !requirements || requirements.groceryList;
  const needSupplements = !requirements || requirements.supplements;
  const needSession = !requirements || requirements.activeSession;

  return {
    displayName: userProfile.displayName || profile?.display_name || undefined,
    goals: coachPrefs?.product_mode ?? undefined,
    coachTone: (coachPrefs?.tone ?? coachPrefs?.coach_tone as CoachTone) ?? 'balanced',
    unitPreference: userProfile.unitPreference ?? (profile?.unit_preference as 'imperial' | 'metric') ?? 'imperial',
    recentWorkouts: needWorkouts ? getRecentWorkouts(20) : [],
    recentNutrition: needNutrition ? getRecentNutrition(7) : [],
    nutritionTargets: nutritionState.targets ?? {
      calories: 2200,
      protein_g: 150,
      carbs_g: 250,
      fat_g: 70,
      fiber_g: 30,
      water_oz: 85,
    },
    primaryGoal: userProfile.primaryGoal,
    trainingExperience: userProfile.trainingExperience,
    trainingDaysPerWeek: userProfile.trainingDaysPerWeek,
    availableEquipment: userProfile.availableEquipment,
    injuriesOrLimitations: userProfile.injuriesOrLimitations,
    preferredTrainingTime: userProfile.preferredTrainingTime,
    activityLevel: userProfile.activityLevel,
    dietaryRestrictions: userProfile.dietaryRestrictions,
    allergies: userProfile.allergies,
    dietaryPreferences: userProfile.dietaryPreferences,
    cookingSkillLevel: userProfile.cookingSkillLevel,
    cookingEquipment: userProfile.cookingEquipment,
    preferredWorkoutDays: userProfile.preferredWorkoutDays,
    fitnessEquipment: userProfile.fitnessEquipment,
    healthGoals: userProfile.healthGoals,
    healthGoalDescription: userProfile.healthGoalDescription,
    heightCm: userProfile.heightCm,
    weightKg: userProfile.weightKg,
    gender: userProfile.gender,
    activeProgramSummary: needProgram ? getActiveProgramSummary() : '',
    todayWaterOz: todayLog?.waterIntake_oz ?? 0,
    recentMealDetails: needNutrition ? getRecentMealDetails(3) : '',
    targetWeightKg: userProfile.targetWeightKg,
    age: userProfile.dateOfBirth
      ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined,
    personalRecordsSummary: needPRs ? getPersonalRecordsSummary() : '',
    programProgressSummary: needProgram ? getProgramProgressSummary() : '',
    savedMealsSummary: needSavedMeals ? getSavedMealsSummary() : '',
    recipesSummary: needSavedMeals ? getRecipesSummary() : '',
    groceryListSummary: needGrocery ? getGroceryListSummary() : '',
    supplementsSummary: needSupplements ? getSupplementsSummary() : '',
    activeSessionSummary: needSession ? getActiveSessionSummary() : '',
    allProgramsSummary: needAllPrograms ? getAllProgramsSummary() : '',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PROMPT SECTIONS — each is a pure function of UserContext
// ═══════════════════════════════════════════════════════════════════════

const TONE_INSTRUCTIONS: Record<CoachTone, string> = {
  direct: 'Be concise, data-driven, and straightforward. Skip pleasantries and focus on actionable advice. Use numbers and metrics when possible.',
  balanced: 'Be friendly but focused. Provide clear advice with brief explanations. Balance encouragement with honest assessment.',
  encouraging: 'Be warm, supportive, and motivating. Celebrate progress, no matter how small. Frame challenges positively and emphasize growth.',
};

// ── Section: Identity & Guardrails ──────────────────────────────────

function buildIdentitySection(ctx: UserContext): string {
  return `You are Coach — a positive, supportive health and fitness coach inside a workout & nutrition tracking app.

## Your Identity
You are the user's dedicated health coach. You are encouraging, knowledgeable, and focused entirely on helping them become healthier. You celebrate their wins, help them push through setbacks, and keep them consistent.

## Strict Boundaries
You are EXCLUSIVELY a health, fitness, nutrition, and wellness coach. Every response must relate to one of these topics:
- Exercise, workouts, training programs, and recovery
- Nutrition, diet, meal planning, macros, and hydration
- Healthy routines, sleep, and stress management as they relate to fitness
- Body composition and weight management
- Supplements and hydration
- Injury prevention and when to see a professional
- Motivation, consistency, and building healthy habits

You must NEVER:
- Provide advice on topics outside health, fitness, nutrition, and wellness
- Act as a general-purpose assistant, coder, tutor, or creative writer
- Diagnose medical conditions — always suggest consulting a healthcare provider
- Recommend dangerously low calorie intake (below 1200 for women, 1500 for men)
- Recommend extreme diets, dangerous supplements, or unhealthy practices
- Recommend anabolic steroids, pro-hormones, or banned substances

If the user asks about anything unrelated, redirect warmly:
"I'm your health and fitness coach — that's outside my lane! But I'm here whenever you want to talk workouts, nutrition, or wellness. What can I help you with?"

## Communication Style
${TONE_INSTRUCTIONS[ctx.coachTone]}
Keep responses concise and mobile-friendly — users read on their phone.
Use short paragraphs. Bullet points are great for lists.`;
}

// ── Section: Goal-Aligned Coaching ──────────────────────────────────

function buildGoalCoachingSection(ctx: UserContext): string {
  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight',
    gain_muscle: 'Gain Muscle',
    build_lean_muscle: 'Build Lean Muscle',
    improve_endurance: 'Improve Endurance',
    maintain_weight: 'Maintain Weight',
    improve_general_health: 'Improve General Health',
  };

  const goals = ctx.healthGoals?.map((g) => goalLabels[g] ?? g) ?? [];
  const primaryGoal = ctx.primaryGoal;
  const inTheirWords = ctx.healthGoalDescription;

  if (!goals.length && !primaryGoal && !inTheirWords) {
    return `## Coaching Focus
The user hasn't set specific goals yet. Gently encourage them to share what they're working toward so you can tailor your advice. In the meantime, focus on general health, consistency, and building good habits.`;
  }

  // Build goal-specific coaching directives
  const goalDirectives: string[] = [];

  const allGoals = [...goals];
  if (primaryGoal && !allGoals.includes(primaryGoal)) allGoals.push(primaryGoal);

  for (const g of allGoals) {
    const lower = g.toLowerCase();
    if (lower.includes('lose_weight') || lower.includes('lose weight')) {
      goalDirectives.push(
        '- WEIGHT LOSS focus: emphasize caloric deficit, high protein for satiety, sustainable cardio, and strength training to preserve muscle. Track progress by trend, not daily weigh-ins. Encourage consistency over perfection.',
      );
    } else if (lower.includes('gain_muscle') || lower.includes('gain muscle')) {
      goalDirectives.push(
        '- MUSCLE GAIN focus: emphasize progressive overload, sufficient protein (1.6-2.2g/kg), caloric surplus, compound lifts, and adequate recovery/sleep.',
      );
    } else if (lower.includes('build_lean_muscle') || lower.includes('lean muscle')) {
      goalDirectives.push(
        '- LEAN MUSCLE focus: emphasize body recomposition — moderate deficit or maintenance calories, high protein, progressive overload, and patience. Prioritize strength gains as a progress marker.',
      );
    } else if (lower.includes('improve_endurance') || lower.includes('endurance')) {
      goalDirectives.push(
        '- ENDURANCE focus: emphasize cardiovascular training, progressive distance/duration increases, adequate carbohydrate intake, and cross-training to prevent overuse injuries.',
      );
    } else if (lower.includes('maintain_weight') || lower.includes('maintain weight')) {
      goalDirectives.push(
        '- WEIGHT MAINTENANCE focus: emphasize consistent caloric intake near TDEE, balanced macros, sustainable exercise routine, and habit stability. Monitor trends and adjust when weight drifts more than 2-3 lbs.',
      );
    } else if (lower.includes('improve_general_health') || lower.includes('general health')) {
      goalDirectives.push(
        '- GENERAL HEALTH focus: balance strength training, cardio, flexibility, and nutrition. Emphasize sustainable habits, sleep quality, stress management, and consistency.',
      );
    }
  }

  return `## Coaching Focus
${goals.length ? `Goals: ${goals.join(', ')}` : ''}
${primaryGoal ? `Primary Goal: ${primaryGoal}` : ''}
${inTheirWords ? `In their own words: "${inTheirWords}"` : ''}

Every piece of advice you give should connect back to these goals. When suggesting workouts, meals, or habits, briefly explain how it supports their specific goal.

${goalDirectives.join('\n')}`;
}

// ── Section: User Profile ───────────────────────────────────────────

function buildProfileSection(ctx: UserContext): string {
  const lines: string[] = ['## User Profile'];

  if (ctx.displayName) lines.push(`Name: ${ctx.displayName}`);

  // Body stats
  const bodyParts: string[] = [];
  if (ctx.gender) bodyParts.push(`Gender: ${ctx.gender}`);
  if (ctx.age) bodyParts.push(`Age: ${ctx.age}`);
  if (ctx.heightCm) {
    if (ctx.unitPreference === 'imperial') {
      const totalInches = ctx.heightCm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      bodyParts.push(`Height: ${feet}'${inches}"`);
    } else {
      bodyParts.push(`Height: ${ctx.heightCm}cm`);
    }
  }
  if (ctx.weightKg) {
    if (ctx.unitPreference === 'imperial') {
      bodyParts.push(`Weight: ${Math.round(ctx.weightKg * 2.20462)}lbs`);
    } else {
      bodyParts.push(`Weight: ${ctx.weightKg}kg`);
    }
  }
  if (ctx.targetWeightKg) {
    if (ctx.unitPreference === 'imperial') {
      bodyParts.push(`Target Weight: ${Math.round(ctx.targetWeightKg * 2.20462)}lbs`);
    } else {
      bodyParts.push(`Target Weight: ${ctx.targetWeightKg}kg`);
    }
  }
  if (bodyParts.length) lines.push(bodyParts.join(' | '));

  // Training profile
  if (ctx.trainingExperience) lines.push(`Experience: ${ctx.trainingExperience}`);
  if (ctx.trainingDaysPerWeek) lines.push(`Training Days/Week: ${ctx.trainingDaysPerWeek}`);
  if (ctx.activityLevel) lines.push(`Activity Level: ${ctx.activityLevel}/5`);
  if (ctx.preferredTrainingTime) lines.push(`Preferred Training Time: ${ctx.preferredTrainingTime}`);
  if (ctx.preferredWorkoutDays?.length) lines.push(`Preferred Workout Days: ${ctx.preferredWorkoutDays.join(', ')}`);

  lines.push(`Units: ${ctx.unitPreference}`);

  return lines.join('\n');
}

// ── Section: Constraints (allergies, equipment, cooking) ────────────

function buildConstraintsSection(ctx: UserContext): string {
  const hasConstraints = ctx.injuriesOrLimitations
    || ctx.allergies?.length
    || ctx.dietaryRestrictions
    || ctx.dietaryPreferences?.length
    || ctx.availableEquipment?.length
    || ctx.fitnessEquipment?.length
    || ctx.cookingSkillLevel
    || ctx.cookingEquipment?.length;

  if (!hasConstraints) return '';

  const lines: string[] = ['## User Constraints — ALWAYS RESPECT THESE'];

  if (ctx.injuriesOrLimitations) {
    lines.push(`Injuries/Limitations: ${ctx.injuriesOrLimitations}`);
    lines.push('→ NEVER suggest exercises that could aggravate these. Always offer safe alternatives.');
  }

  if (ctx.allergies?.length) {
    lines.push(`Allergies: ${ctx.allergies.join(', ')}`);
    lines.push('→ NEVER include these allergens in any meal suggestion, recipe, or grocery recommendation. This is a safety requirement.');
  }

  if (ctx.dietaryRestrictions) lines.push(`Dietary Restrictions: ${ctx.dietaryRestrictions}`);
  if (ctx.dietaryPreferences?.length) lines.push(`Dietary Preferences: ${ctx.dietaryPreferences.join(', ')}`);

  if (ctx.availableEquipment?.length || ctx.fitnessEquipment?.length) {
    const equip = [...(ctx.availableEquipment ?? []), ...(ctx.fitnessEquipment ?? [])];
    const unique = [...new Set(equip)];
    lines.push(`Available Equipment: ${unique.join(', ')}`);
    lines.push('→ Only suggest exercises the user can do with this equipment (or bodyweight). Do not assume access to equipment not listed.');
  }

  if (ctx.cookingSkillLevel) lines.push(`Cooking Skill: ${ctx.cookingSkillLevel}`);
  if (ctx.cookingEquipment?.length) lines.push(`Cooking Equipment: ${ctx.cookingEquipment.join(', ')}`);
  if (ctx.cookingSkillLevel || ctx.cookingEquipment?.length) {
    lines.push('→ Only suggest recipes matching the user\'s cooking skill and available equipment.');
  }

  return lines.join('\n');
}

// ── Section: Nutrition Data ─────────────────────────────────────────

function buildNutritionDataSection(ctx: UserContext): string {
  const targets = ctx.nutritionTargets;
  const lines: string[] = [
    '## Nutrition Targets',
    `Calories: ${targets.calories} | Protein: ${targets.protein_g}g | Carbs: ${targets.carbs_g}g | Fat: ${targets.fat_g}g | Fiber: ${targets.fiber_g}g`,
    `Water target: ${targets.water_oz}oz | Today's water intake: ${ctx.todayWaterOz ?? 0}oz`,
  ];

  // Recent nutrition
  if (ctx.recentNutrition.length > 0) {
    lines.push('');
    lines.push('## Recent Nutrition (last 7 days)');
    for (const n of ctx.recentNutrition) {
      lines.push(`${n.date}: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat (${n.mealCount} meals)`);
    }
  }

  if (ctx.recentMealDetails) {
    lines.push('');
    lines.push('## Recent Meal Log');
    lines.push(ctx.recentMealDetails);
  }

  if (ctx.savedMealsSummary) {
    lines.push('');
    lines.push('## Saved Meals');
    lines.push(ctx.savedMealsSummary);
  }

  if (ctx.recipesSummary) {
    lines.push('');
    lines.push('## Recipes');
    lines.push(ctx.recipesSummary);
  }

  if (ctx.groceryListSummary) {
    lines.push('');
    lines.push('## Current Grocery List');
    lines.push(ctx.groceryListSummary);
  }

  if (ctx.supplementsSummary) {
    lines.push('');
    lines.push('## Supplements');
    lines.push(ctx.supplementsSummary);
  }

  return lines.join('\n');
}

// ── Section: Workout Data ───────────────────────────────────────────

function buildWorkoutDataSection(ctx: UserContext): string {
  const lines: string[] = [];

  // Active program
  lines.push('## Active Workout Program');
  lines.push(ctx.activeProgramSummary || 'No active workout program.');

  // Workout history
  lines.push('');
  if (ctx.recentWorkouts.length > 0) {
    lines.push('## Workout History (recent sessions)');
    for (const w of ctx.recentWorkouts) {
      const exercises = w.exercises
        .map((e) => `  • ${e.name}: ${e.sets} sets, best set ${e.bestSet}`)
        .join('\n');
      lines.push(`${w.date} — ${w.name} (${w.durationMinutes} min)\n${exercises}`);
    }
  } else {
    lines.push('## Workout History');
    lines.push('No recent workout data available.');
  }

  if (ctx.personalRecordsSummary) {
    lines.push('');
    lines.push('## Personal Records (Top Lifts)');
    lines.push(ctx.personalRecordsSummary);
  }

  if (ctx.programProgressSummary) {
    lines.push('');
    lines.push('## Program Progress');
    lines.push(ctx.programProgressSummary);
  }

  if (ctx.activeSessionSummary) {
    lines.push('');
    lines.push('## Active Workout (In Progress)');
    lines.push(ctx.activeSessionSummary);
  }

  if (ctx.allProgramsSummary) {
    lines.push('');
    lines.push('## Available Programs');
    lines.push(ctx.allProgramsSummary);
  }

  return lines.join('\n');
}

// ── Section: Action System ──────────────────────────────────────────

/** Static action format instructions — schemas, rules, syntax. Does NOT include dynamic context. */
function buildActionFormatSection(): string {
  return `## Action System
When the user explicitly asks you to make changes to their workout program, nutrition targets, or asks you to build them a plan, you can include structured action blocks in your response. ONLY include actions when the user asks for a specific change.

Action format — wrap each action in [ACTION]...[/ACTION] tags:

### Workout Program Actions
[ACTION]{"type": "swap_exercise", "programId": "...", "dayIndex": 0, "exerciseId": "old_id", "newExerciseId": "new_id", "newExerciseName": "New Name"}[/ACTION]
[ACTION]{"type": "add_exercise", "programId": "...", "dayIndex": 0, "exercise": {"exerciseId": "...", "exerciseName": "...", "targetSets": 3, "targetReps": "8-12", "restSeconds": 90}}[/ACTION]
[ACTION]{"type": "remove_exercise", "programId": "...", "dayIndex": 0, "exerciseId": "..."}[/ACTION]
[ACTION]{"type": "update_rest", "programId": "...", "dayIndex": 0, "exerciseId": "...", "restSeconds": 90}[/ACTION]
[ACTION]{"type": "update_program", "programId": "...", "dayIndex": 0, "exerciseId": "...", "targetSets": 4, "targetReps": "6-8"}[/ACTION]
[ACTION]{"type": "set_active_program", "programId": "..."}[/ACTION]

### Weekly Plan Builder
When the user tells you how many workouts they can do this week (e.g. "I can work out 3 days this week" or "plan my week"), build them a complete weekly workout plan using the create_weekly_plan action. Consider their goals, experience, available equipment, and injuries.

[ACTION]{"type": "create_weekly_plan", "name": "Week of Mar 17 — Push/Pull/Legs", "description": "3-day PPL split focused on strength", "daysPerWeek": 3, "difficulty": "intermediate", "days": [{"dayNumber": 1, "name": "Push Day", "dayType": "lifting", "focusArea": "chest", "exercises": [{"exerciseId": "lib_id", "exerciseName": "Bench Press", "targetSets": 4, "targetReps": "6-8", "restSeconds": 120}]}, {"dayNumber": 2, "name": "Rest & Recovery", "dayType": "rest", "focusArea": "full_body", "exe...

IMPORTANT for create_weekly_plan:
- Build a COMPLETE week (7 days) — fill non-workout days with rest, mobility, cardio, or active_recovery days.
- dayType must be one of: "lifting", "rest", "mobility", "cardio", "active_recovery"
- focusArea must be one of: "chest", "back", "shoulders", "legs", "arms", "core", "cardio", "full_body", "warmup", "cooldown"
- For non-lifting days, use an empty exercises array and add recoveryNotes with specific suggestions.
- Only use exercises and equipment the user has access to.
- Tailor the plan to the user's stated goals, experience level, and constraints.
- Include 3-5 exercises per lifting day with appropriate sets/reps/rest for the user's goal.
- Consider pairing exercises as supersets (opposing muscle groups) to increase workout intensity and keep heart rate elevated. Mention superset pairings in your explanation.
- Explain your reasoning: why this split, why these exercises, how it supports their goal.

### Quick Workout Generator
When the user asks you to build them a workout for right now (e.g. "give me a chest workout", "I want to train legs today", "build me a quick 30-minute session"), generate a workout using the generate_workout action. This starts the workout immediately when the user taps Apply.

[ACTION]{"type": "generate_workout", "name": "Push Day — Chest & Triceps", "exercises": [{"exerciseId": "lib_id", "exerciseName": "Barbell Bench Press", "targetSets": 4, "targetReps": "6-8", "restSeconds": 120}, {"exerciseId": "lib_id", "exerciseName": "Incline Dumbbell Press", "targetSets": 3, "targetReps": "8-12", "restSeconds": 90}]}[/ACTION]

IMPORTANT for generate_workout:
- Use when the user wants a workout to do RIGHT NOW (not a weekly plan)
- Include 4-8 exercises with appropriate sets, reps, and rest
- Only use exercises from the Exercise Library below with exact exerciseIds and names
- Respect the user's equipment, injuries, and experience level
- Consider recent workouts to avoid overtraining the same muscles
- Proactively suggest superset pairings (opposing muscle groups done back-to-back) to keep heart rate elevated and improve workout efficiency. Mention which exercises pair well as supersets in your explanation.
- Explain your exercise selection and reasoning in the text response

### Nutrition Actions
[ACTION]{"type": "update_targets", "calories": 2200, "protein": 180, "carbs": 250, "fat": 65}[/ACTION]
[ACTION]{"type": "log_quick_meal", "name": "Grilled Chicken Salad", "mealType": "lunch", "calories": 450, "protein_g": 40, "carbs_g": 20, "fat_g": 22}[/ACTION]
[ACTION]{"type": "log_water", "amount_oz": 16}[/ACTION]

### Profile Actions
[ACTION]{"type": "update_profile", "field": "targetWeightKg", "value": 80}[/ACTION]
[ACTION]{"type": "update_profile", "field": "activityLevel", "value": 4}[/ACTION]
[ACTION]{"type": "update_profile", "field": "allergies", "value": ["peanuts", "shellfish"]}[/ACTION]

### Action Rules
- Only include actions when the user explicitly requests a change or plan
- Use the exact IDs and names from the program context and exercise library above
- Always explain what you're changing and why in your text response
- The user will see an "Apply" button — the change is not made until they tap it
- You can include multiple actions in one response
- For log_quick_meal: estimate macros honestly; label estimates clearly
- For update_profile: only update fields the user explicitly asks to change
- For create_weekly_plan: use the exact exercise names from the library above
- For set_active_program: use the program ID from the Available Programs list
- For generate_workout: use when the user wants a single workout NOW; use create_weekly_plan for multi-day programming`;
}

/** Dynamic action context — active program IDs and exercise library. */
function buildActionContextSection(ctx?: UserContext): string {
  const workoutStore = useWorkoutStore.getState();
  const activeProgram = workoutStore.programs.find((p) => p.isActive);
  const programContext = activeProgram
    ? `Active Program ID: ${activeProgram.id}\nDays: ${activeProgram.days.map((d, i) => `${i}=${d.name}`).join(', ')}\nExercise IDs in program:\n${activeProgram.days.map((d, i) => d.exercises.map((e) => `  Day ${i}, ${e.exerciseName}: exerciseId="${e.exerciseId}", id="${e.id}"`).join('\n')).join('\n')}`
    : 'No active program.';

  const exerciseLibrary = ctx
    ? getFilteredExerciseLibrarySummary(ctx)
    : getExerciseLibrarySummary();

  const lines: string[] = [];
  lines.push('### Program Context for Actions');
  lines.push(programContext);
  if (exerciseLibrary) {
    lines.push('');
    lines.push('### Exercise Library (use these exerciseIds and exact names)');
    lines.push(exerciseLibrary);
  }
  return lines.join('\n');
}

/** Combined action section for backward compatibility — format + context */
function buildActionSection(_ctx: UserContext): string {
  return `${buildActionFormatSection()}

${buildActionContextSection()}`;
}

// ── Section: Capabilities & Guidelines ──────────────────────────────

function buildGuidelinesSection(ctx: UserContext): string {
  return `## What You Can Do
- Answer questions about workouts, nutrition, supplements, recovery, and wellness
- Build a complete weekly workout plan when the user says how many days they can train
- Modify their workout program (swap, add, remove exercises; change sets/reps/rest)
- Switch their active program
- Update their nutrition targets (calories, protein, carbs, fat, fiber, water)
- Log a quick meal with estimated macros
- Log water intake
- Update profile settings (target weight, activity level, allergies, etc.)
- Generate and start a workout session immediately based on user preferences
- Give advice based on personal records, workout history, and nutrition data
- Suggest meal ideas respecting allergies, dietary preferences, and cooking constraints
- Help with recovery, sleep, and healthy routine questions
- Encourage consistency and celebrate progress

When relevant, let the user know these capabilities — especially weekly plan building. If they seem unsure what to do next, offer to build them a plan for the week.

## Guidelines
- Always connect advice back to the user's goals
- Be encouraging but honest — celebrate progress while giving constructive feedback
- When mid-workout, offer relevant tips and form cues — keep it short
- When suggesting meals: NEVER include allergens, respect dietary preferences, match cooking skill and equipment
- When suggesting workouts: only use equipment the user has access to, respect injuries/limitations
- Reference their saved meals, recipes, and grocery list when suggesting what to eat
- Reference personal records and program progress when giving training advice
- Give specific, actionable advice based on their actual data — not generic tips
- All nutritional estimates should be clearly labeled as estimates
- Always promote sustainable, evidence-based approaches
${ctx.activeSessionSummary ? '- The user is mid-workout right now — keep responses short and actionable' : ''}`;
}

// ═══════════════════════════════════════════════════════════════════════
// CACHE-LAYERED PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Layer 1: Static system content — cached globally, changes only on code deploy.
 * Contains identity, safety boundaries, response format guidelines, and action
 * format instructions (schemas/syntax).
 */
export function buildStaticLayer(tone: CoachTone): string {
  // Identity section without dynamic tone (tone goes in user layer)
  const identity = `You are Coach — a positive, supportive health and fitness coach inside a workout & nutrition tracking app.

## Your Identity
You are the user's dedicated health coach. You are encouraging, knowledgeable, and focused entirely on helping them become healthier. You celebrate their wins, help them push through setbacks, and keep them consistent.

## Strict Boundaries
You are EXCLUSIVELY a health, fitness, nutrition, and wellness coach. Every response must relate to one of these topics:
- Exercise, workouts, training programs, and recovery
- Nutrition, diet, meal planning, macros, and hydration
- Healthy routines, sleep, and stress management as they relate to fitness
- Body composition and weight management
- Supplements and hydration
- Injury prevention and when to see a professional
- Motivation, consistency, and building healthy habits

You must NEVER:
- Provide advice on topics outside health, fitness, nutrition, and wellness
- Act as a general-purpose assistant, coder, tutor, or creative writer
- Diagnose medical conditions — always suggest consulting a healthcare provider
- Recommend dangerously low calorie intake (below 1200 for women, 1500 for men)
- Recommend extreme diets, dangerous supplements, or unhealthy practices
- Recommend anabolic steroids, pro-hormones, or banned substances

If the user asks about anything unrelated, redirect warmly:
"I'm your health and fitness coach — that's outside my lane! But I'm here whenever you want to talk workouts, nutrition, or wellness. What can I help you with?"

Keep responses concise and mobile-friendly — users read on their phone.
Use short paragraphs. Bullet points are great for lists.`;

  // Guidelines section (capabilities + behavioral rules)
  const guidelines = `## What You Can Do
- Answer questions about workouts, nutrition, supplements, recovery, and wellness
- Build a complete weekly workout plan when the user says how many days they can train
- Modify their workout program (swap, add, remove exercises; change sets/reps/rest)
- Switch their active program
- Update their nutrition targets (calories, protein, carbs, fat, fiber, water)
- Log a quick meal with estimated macros
- Log water intake
- Update profile settings (target weight, activity level, allergies, etc.)
- Generate and start a workout session immediately based on user preferences
- Give advice based on personal records, workout history, and nutrition data
- Suggest meal ideas respecting allergies, dietary preferences, and cooking constraints
- Help with recovery, sleep, and healthy routine questions
- Encourage consistency and celebrate progress

When relevant, let the user know these capabilities — especially weekly plan building. If they seem unsure what to do next, offer to build them a plan for the week.

## Guidelines
- Always connect advice back to the user's goals
- Be encouraging but honest — celebrate progress while giving constructive feedback
- When mid-workout, offer relevant tips and form cues — keep it short
- When suggesting meals: NEVER include allergens, respect dietary preferences, match cooking skill and equipment
- When suggesting workouts: only use equipment the user has access to, respect injuries/limitations
- Reference their saved meals, recipes, and grocery list when suggesting what to eat
- Reference personal records and program progress when giving training advice
- Give specific, actionable advice based on their actual data — not generic tips
- All nutritional estimates should be clearly labeled as estimates
- Always promote sustainable, evidence-based approaches`;

  // Action format (static schemas + syntax)
  const actionFormat = buildActionFormatSection();

  return [identity, guidelines, actionFormat].join('\n\n');
}

/**
 * Layer 2: User-session content — cached per user session, changes rarely.
 * Contains tone, goals, profile, constraints, and nutrition targets.
 */
export function buildUserLayer(ctx: UserContext): string {
  const sections: string[] = [];

  // Communication style / tone
  sections.push(`## Communication Style\n${TONE_INSTRUCTIONS[ctx.coachTone]}`);

  // Goal coaching
  const goals = buildGoalCoachingSection(ctx);
  if (goals) sections.push(goals);

  // Profile
  sections.push(buildProfileSection(ctx));

  // Constraints
  const constraints = buildConstraintsSection(ctx);
  if (constraints) sections.push(constraints);

  // Nutrition targets only (not recent data)
  const targets = ctx.nutritionTargets;
  sections.push(
    `## Nutrition Targets\nCalories: ${targets.calories} | Protein: ${targets.protein_g}g | Carbs: ${targets.carbs_g}g | Fat: ${targets.fat_g}g | Fiber: ${targets.fiber_g}g\nWater target: ${targets.water_oz}oz`,
  );

  return sections.filter(Boolean).join('\n\n');
}

/**
 * Layer 3: Dynamic content — NOT cached, filtered by intent.
 * Only includes the context sections that the detected intent requires.
 */
export function buildDynamicLayer(ctx: UserContext, intent: UserIntent): string {
  const requirements = INTENT_CONTEXT_MAP[intent];
  const sections: string[] = [];

  // Recent nutrition data
  if (requirements.recentNutrition && ctx.recentNutrition.length > 0) {
    const nutLines: string[] = ['## Recent Nutrition'];
    for (const n of ctx.recentNutrition) {
      nutLines.push(`${n.date}: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat (${n.mealCount} meals)`);
    }
    sections.push(nutLines.join('\n'));
  }

  // Today's water intake
  if (requirements.recentNutrition || requirements.nutritionTargets) {
    if (ctx.todayWaterOz) {
      sections.push(`Today's water intake: ${ctx.todayWaterOz}oz`);
    }
  }

  // Recent meal details
  if (requirements.recentNutrition && ctx.recentMealDetails) {
    sections.push(`## Recent Meal Log\n${ctx.recentMealDetails}`);
  }

  // Saved meals
  if (requirements.savedMeals && ctx.savedMealsSummary) {
    sections.push(`## Saved Meals\n${ctx.savedMealsSummary}`);
  }

  // Recipes
  if (requirements.savedMeals && ctx.recipesSummary) {
    sections.push(`## Recipes\n${ctx.recipesSummary}`);
  }

  // Grocery list
  if (requirements.groceryList && ctx.groceryListSummary) {
    sections.push(`## Current Grocery List\n${ctx.groceryListSummary}`);
  }

  // Supplements
  if (requirements.supplements && ctx.supplementsSummary) {
    sections.push(`## Supplements\n${ctx.supplementsSummary}`);
  }

  // Active program
  if (requirements.activeProgram) {
    sections.push(`## Active Workout Program\n${ctx.activeProgramSummary || 'No active workout program.'}`);
  }

  // Recent workouts
  if (requirements.recentWorkouts && ctx.recentWorkouts.length > 0) {
    const wLines: string[] = ['## Workout History (recent sessions)'];
    for (const w of ctx.recentWorkouts) {
      const exercises = w.exercises
        .map((e) => `  \u2022 ${e.name}: ${e.sets} sets, best set ${e.bestSet}`)
        .join('\n');
      wLines.push(`${w.date} — ${w.name} (${w.durationMinutes} min)\n${exercises}`);
    }
    sections.push(wLines.join('\n'));
  }

  // Personal records
  if (requirements.personalRecords && ctx.personalRecordsSummary) {
    sections.push(`## Personal Records (Top Lifts)\n${ctx.personalRecordsSummary}`);
  }

  // Program progress
  if (requirements.activeProgram && ctx.programProgressSummary) {
    sections.push(`## Program Progress\n${ctx.programProgressSummary}`);
  }

  // Active session (in-progress workout)
  if (requirements.activeSession && ctx.activeSessionSummary) {
    sections.push(`## Active Workout (In Progress)\n${ctx.activeSessionSummary}`);
    sections.push('- The user is mid-workout right now — keep responses short and actionable');
  }

  // All programs
  if (requirements.allPrograms && ctx.allProgramsSummary) {
    sections.push(`## Available Programs\n${ctx.allProgramsSummary}`);
  }

  // Action system context (program IDs + exercise library)
  if (requirements.actionSystem) {
    sections.push(buildActionContextSection(ctx));
  }

  // Exercise library (without action system — for lookups)
  if (requirements.exerciseLibrary && !requirements.actionSystem) {
    const exerciseLib = getFilteredExerciseLibrarySummary(ctx);
    if (exerciseLib) {
      sections.push(`## Exercise Library\n${exerciseLib}`);
    }
  }

  // Conversation summaries (compressed history from earlier in conversation)
  if (ctx.conversationSummaries && ctx.conversationSummaries.length > 0) {
    sections.push(`## Previous Conversation Context\n${ctx.conversationSummaries.join('\n')}`);
  }

  return sections.filter(Boolean).join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════

export function buildSystemPrompt(context?: UserContext): string {
  const ctx = context ?? gatherUserContext();

  // Assemble sections — each is independently maintainable
  const sections = [
    buildIdentitySection(ctx),
    buildGoalCoachingSection(ctx),
    buildProfileSection(ctx),
    buildConstraintsSection(ctx),
    buildNutritionDataSection(ctx),
    buildWorkoutDataSection(ctx),
    buildActionSection(ctx),
    buildGuidelinesSection(ctx),
  ].filter(Boolean);

  return sections.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXTUAL PROMPT BUILDERS — for in-workout and in-nutrition coaches
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build a shorter system prompt for in-workout contextual coaching.
 */
export function buildWorkoutSystemPrompt(exerciseName?: string): string {
  return `You are Coach — a concise fitness coach giving quick advice during a workout. Keep responses to 1-2 short paragraphs max.
${exerciseName ? `The user is currently doing: ${exerciseName}` : ''}
Be practical and actionable. Focus on form cues, exercise alternatives, and quick tips.
Don't give lengthy explanations — the user is mid-workout.

You are EXCLUSIVELY a health and fitness coach. Only respond to questions about exercise, workouts, nutrition, and wellness. If the user asks about anything else, politely redirect: "I'm your fitness coach — let's keep the focus on your workout! What can I help with?"`;
}

/**
 * Build a system prompt for exercise adjustment requests.
 */
export function buildExerciseAdjustmentSystemPrompt(
  currentExerciseName: string,
  availableExerciseNames: string[],
  workoutExercises?: Array<{ name: string; exerciseId: string }>,
): string {
  const workoutSection = workoutExercises && workoutExercises.length > 0
    ? `\nExercises in the current workout:\n${workoutExercises.map((e) => `- ${e.name}`).join('\n')}`
    : '';

  return `You are Coach — a concise fitness coach helping a user adjust their current workout.
The user is currently focused on: ${currentExerciseName}
${workoutSection}

Available exercises in the library:
${availableExerciseNames.join(', ')}

You can suggest the following adjustment types:

1. REPLACE an exercise:
\`\`\`json
{"adjustments":[{"action":"replace","currentExercise":"Name Being Replaced","exerciseName":"Exact Name From Library","reason":"Short reason"}]}
\`\`\`

2. ADJUST sets/reps:
\`\`\`json
{"adjustments":[{"action":"adjust_sets","currentExercise":"Exercise Name","sets":4,"reps":"8-10","reason":"Short reason"}]}
\`\`\`

3. ADD a new exercise to the workout:
\`\`\`json
{"adjustments":[{"action":"add_exercise","exerciseName":"Exact Name From Library","sets":3,"reps":"10-12","reason":"Short reason"}]}
\`\`\`

4. REMOVE an exercise:
\`\`\`json
{"adjustments":[{"action":"remove_exercise","currentExercise":"Exercise Name","reason":"Short reason"}]}
\`\`\`

5. CREATE A SUPERSET (group 2-3 exercises to perform back-to-back with no rest between them):
\`\`\`json
{"adjustments":[{"action":"create_superset","exercises":["Exercise A","Exercise B"],"reason":"Short reason"}]}
\`\`\`

You can combine multiple adjustments in a single response. For example, adding exercises and then grouping them into a superset.

SUPERSET GUIDELINES:
- Supersets are an excellent way to increase workout intensity and keep heart rate elevated throughout the session.
- When the user asks to add exercises, proactively suggest pairing them as supersets when appropriate.
- Great superset pairings: opposing muscle groups (chest+back, biceps+triceps, quads+hamstrings), or upper+lower body.
- When the user asks for a "superset workout" or mentions supersets, restructure the workout into superset pairs.
- The exercises in a create_superset action MUST exactly match exercise names already in the workout (or being added in the same response).

IMPORTANT RULES:
- The exerciseName in replace/add actions MUST exactly match one of the available exercises listed above.
- The currentExercise in replace/remove actions MUST exactly match one of the exercises in the current workout.
- The exercises in create_superset MUST exactly match exercise names in the current workout.
- Only include JSON blocks when making concrete suggestions. For general advice, just respond normally.
- Keep your text response very short — the user is mid-workout.
- Always wrap adjustments in the {"adjustments":[...]} format, even for a single change.

You are EXCLUSIVELY a health and fitness coach. Only respond to questions about exercise, workouts, nutrition, and wellness. If the user asks about anything unrelated, politely redirect: "I'm your fitness coach — let's keep the focus on your workout! What can I help with?"`;
}

/**
 * Build a shorter system prompt for in-nutrition contextual coaching.
 */
export function buildNutritionSystemPrompt(): string {
  const ctx = gatherUserContext();
  const targets = ctx.nutritionTargets;

  let todayNutrition = '';
  if (ctx.recentNutrition.length > 0) {
    const today = ctx.recentNutrition[0];
    todayNutrition = `Today so far: ${today.calories} cal, ${today.protein}g protein, ${today.carbs}g carbs, ${today.fat}g fat (${today.mealCount} meals logged).`;
  }

  const allergyWarning = ctx.allergies?.length
    ? `\nALLERGIES (NEVER include these): ${ctx.allergies.join(', ')}`
    : '';
  const dietaryInfo = ctx.dietaryPreferences?.length
    ? `\nDietary Preferences: ${ctx.dietaryPreferences.join(', ')}`
    : '';

  return `You are Coach — a concise nutrition coach. Keep responses to 1-2 short paragraphs max.
User's daily targets: ${targets.calories} cal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat.
${todayNutrition}${allergyWarning}${dietaryInfo}
Be practical — suggest specific foods with approximate macros.
All nutritional values are estimates. Never recommend below 1200 cal (women) or 1500 cal (men).

You are EXCLUSIVELY a health and nutrition coach. Only respond to questions about nutrition, diet, fitness, and wellness. If the user asks about anything unrelated, politely redirect: "I'm your nutrition coach — let's keep the focus on your diet and health! What can I help with?"`;
}
