// ── Coach System Prompt Builder ──────────────────────────────────────
// Builds a comprehensive system prompt with user context for the AI coach.

import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useAuthStore } from '../stores/auth-store';
import { useProfileStore } from '../stores/profile-store';
import type { CompletedSession, CompletedSet } from '../types/workout';
import type { DailyNutritionLog, NutritionTargets } from '../types/nutrition';
import { getDateString } from '../lib/nutrition-utils';

// ── Types ───────────────────────────────────────────────────────────

export type CoachTone = 'direct' | 'balanced' | 'encouraging';

interface UserContext {
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

// ── Context Gathering ───────────────────────────────────────────────

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

export function gatherUserContext(): UserContext {
  const authState = useAuthStore.getState();
  const nutritionState = useNutritionStore.getState();
  const profileStore = useProfileStore.getState();
  const profile = authState.profile;
  const coachPrefs = authState.coachPreferences;
  const userProfile = profileStore.profile;

  return {
    displayName: userProfile.displayName || profile?.display_name || undefined,
    goals: coachPrefs?.product_mode ?? undefined,
    coachTone: (coachPrefs?.coach_tone as CoachTone) ?? 'balanced',
    unitPreference: userProfile.unitPreference ?? (profile?.unit_preference as 'imperial' | 'metric') ?? 'imperial',
    recentWorkouts: getRecentWorkouts(5),
    recentNutrition: getRecentNutrition(3),
    nutritionTargets: nutritionState.targets ?? {
      calories: 2200,
      protein_g: 150,
      carbs_g: 250,
      fat_g: 70,
      fiber_g: 30,
      water_ml: 2500,
    },
    // Profile / questionnaire data
    primaryGoal: userProfile.primaryGoal,
    trainingExperience: userProfile.trainingExperience,
    trainingDaysPerWeek: userProfile.trainingDaysPerWeek,
    availableEquipment: userProfile.availableEquipment,
    injuriesOrLimitations: userProfile.injuriesOrLimitations,
    preferredTrainingTime: userProfile.preferredTrainingTime,
    activityLevel: userProfile.activityLevel,
    dietaryRestrictions: userProfile.dietaryRestrictions,
  };
}

// ── System Prompt Builder ───────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<CoachTone, string> = {
  direct: 'Be concise, data-driven, and straightforward. Skip pleasantries and focus on actionable advice. Use numbers and metrics when possible.',
  balanced: 'Be friendly but focused. Provide clear advice with brief explanations. Balance encouragement with honest assessment.',
  encouraging: 'Be warm, supportive, and motivating. Celebrate progress, no matter how small. Frame challenges positively and emphasize growth.',
};

export function buildSystemPrompt(context?: UserContext): string {
  const ctx = context ?? gatherUserContext();

  let workoutSection = 'No recent workout data available.';
  if (ctx.recentWorkouts.length > 0) {
    workoutSection = ctx.recentWorkouts
      .map((w) => {
        const exercises = w.exercises
          .map((e) => `  • ${e.name}: ${e.sets} sets, best set ${e.bestSet}`)
          .join('\n');
        return `${w.date} — ${w.name} (${w.durationMinutes} min)\n${exercises}`;
      })
      .join('\n\n');
  }

  let nutritionSection = 'No recent nutrition data available.';
  if (ctx.recentNutrition.length > 0) {
    nutritionSection = ctx.recentNutrition
      .map(
        (n) =>
          `${n.date}: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat (${n.mealCount} meals)`,
      )
      .join('\n');
  }

  const targets = ctx.nutritionTargets;

  return `You are a friendly, knowledgeable health and fitness coach. Your name is Coach.

## Communication Style
${TONE_INSTRUCTIONS[ctx.coachTone]}

## User Profile
${ctx.displayName ? `Name: ${ctx.displayName}` : 'Name: not set'}
${ctx.goals ? `Goals: ${ctx.goals}` : 'Goals: general fitness'}
${ctx.primaryGoal ? `Primary Goal: ${ctx.primaryGoal}` : ''}
${ctx.trainingExperience ? `Experience Level: ${ctx.trainingExperience}` : ''}
${ctx.trainingDaysPerWeek ? `Training Days/Week: ${ctx.trainingDaysPerWeek}` : ''}
${ctx.activityLevel ? `Activity Level: ${ctx.activityLevel}/5` : ''}
${ctx.availableEquipment?.length ? `Equipment: ${ctx.availableEquipment.join(', ')}` : ''}
${ctx.injuriesOrLimitations ? `Injuries/Limitations: ${ctx.injuriesOrLimitations}` : ''}
${ctx.preferredTrainingTime ? `Preferred Training Time: ${ctx.preferredTrainingTime}` : ''}
${ctx.dietaryRestrictions ? `Dietary Restrictions: ${ctx.dietaryRestrictions}` : ''}
Units: ${ctx.unitPreference}

## Nutrition Targets
Calories: ${targets.calories} | Protein: ${targets.protein_g}g | Carbs: ${targets.carbs_g}g | Fat: ${targets.fat_g}g

## Recent Workouts (last 5)
${workoutSection}

## Recent Nutrition (last 3 days)
${nutritionSection}

## Guidelines
- Be encouraging but honest
- Give specific, actionable advice
- Reference the user's actual data when relevant
- For workout questions: suggest exercises, sets, reps, and explain why
- For nutrition questions: give practical meal ideas with approximate macros
- Keep responses concise and mobile-friendly (users read on phones)
- All nutritional estimates should be clearly labeled as estimates
- Never diagnose medical conditions
- Never recommend dangerously low calorie intake (below 1200 for women, 1500 for men)
- Always suggest consulting a healthcare provider for medical concerns
- Label all estimates clearly as estimates`;
}

/**
 * Build a shorter system prompt for in-workout contextual coaching.
 */
export function buildWorkoutSystemPrompt(exerciseName?: string): string {
  return `You are a concise fitness coach giving quick advice during a workout. Keep responses to 1-2 short paragraphs max.
${exerciseName ? `The user is currently doing: ${exerciseName}` : ''}
Be practical and actionable. Focus on form cues, exercise alternatives, and quick tips.
Don't give lengthy explanations — the user is mid-workout.`;
}

/**
 * Build a system prompt for exercise adjustment requests.
 * Instructs the AI to respond with a structured JSON block so the app can
 * programmatically apply the suggestion.
 */
export function buildExerciseAdjustmentSystemPrompt(
  currentExerciseName: string,
  availableExerciseNames: string[],
): string {
  return `You are a concise fitness coach helping a user adjust their current workout.
The user is currently doing: ${currentExerciseName}

Available exercises in the library:
${availableExerciseNames.join(', ')}

When the user asks to replace, swap, or find an alternative exercise, respond with:
1. A brief explanation (1-2 sentences) of why this is a good swap.
2. A JSON block on its own line in this exact format:
\`\`\`json
{"action":"replace","exerciseName":"Exact Exercise Name From Library","reason":"Short reason"}
\`\`\`

When the user asks to adjust sets, reps, or weight, respond with:
1. A brief explanation of the adjustment.
2. A JSON block:
\`\`\`json
{"action":"adjust_sets","sets":4,"reps":"8-10","reason":"Short reason"}
\`\`\`

IMPORTANT:
- The exerciseName in your JSON MUST exactly match one of the available exercises listed above.
- Only include the JSON block when you are making a concrete suggestion. For general advice, just respond normally.
- Keep your text response very short — the user is mid-workout.`;
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

  return `You are a concise nutrition coach. Keep responses to 1-2 short paragraphs max.
User's daily targets: ${targets.calories} cal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat.
${todayNutrition}
Be practical — suggest specific foods with approximate macros.
All nutritional values are estimates. Never recommend below 1200 cal (women) or 1500 cal (men).`;
}
