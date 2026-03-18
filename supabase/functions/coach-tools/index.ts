// ── Coach Tools Edge Function ────────────────────────────────────────
// Executes tool-style functions called by the AI coach.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider } from '../_shared/ai-provider.ts';
import type { ToolRequest, ToolResponse } from '../_shared/types.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';

// ── Tool Registry ───────────────────────────────────────────────────

type ToolHandler = (
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const TOOLS: Record<string, ToolHandler> = {
  get_user_profile: getUserProfile,
  get_recent_workouts: getRecentWorkouts,
  get_recent_nutrition: getRecentNutrition,
  get_progress_metrics: getProgressMetrics,
  generate_workout_plan: generateWorkoutPlan,
  revise_workout_plan: reviseWorkoutPlan,
  suggest_load_for_set: suggestLoadForSet,
  parse_meal_text: parseMealText,
  analyze_meal_photo: analyzeMealPhoto,
  calculate_daily_targets: calculateDailyTargets,
  generate_meal_plan: generateMealPlan,
  generate_grocery_list: generateGroceryList,
  recommend_supplements: recommendSupplements,
  create_weekly_summary: createWeeklySummary,
};

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: ToolRequest = await req.json();
    const { tool_name, params = {} } = body;

    const handler = TOOLS[tool_name];
    if (!handler) {
      return errorResponse(`Unknown tool: ${tool_name}`, 400);
    }

    const result = await handler(supabase, user_id, params);

    const response: ToolResponse = {
      success: true,
      data: result,
    };

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Coach tools error:', error);
    return jsonResponse({
      success: false,
      data: {},
      error: error instanceof Error ? error.message : 'Tool execution failed',
    }, 500);
  }
});

// ── Tool Implementations ────────────────────────────────────────────

async function getUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const [profileResult, goalsResult, prefsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').single(),
    supabase.from('coach_preferences').select('*').eq('user_id', userId).single(),
  ]);

  return {
    profile: profileResult.data ?? {},
    goals: goalsResult.data ?? null,
    preferences: prefsResult.data ?? null,
  };
}

async function getRecentWorkouts(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const count = (params.count as number) ?? 5;

  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(count);

  return { workouts: data ?? [], count: data?.length ?? 0 };
}

async function getRecentNutrition(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const days = (params.days as number) ?? 3;
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const { data } = await supabase
    .from('nutrition_day_logs')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates)
    .order('date', { ascending: false });

  return { nutrition_days: data ?? [], count: data?.length ?? 0 };
}

async function getProgressMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  // Weight trend (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  // No weight_logs table — weight is stored on profiles.weight_kg (latest only)
  const weightData: Array<Record<string, unknown>> = [];

  // Recent PRs — tracked via set_logs.is_pr joined through workout_sessions
  const { data: recentPRs } = await supabase
    .from('set_logs')
    .select('*, workout_sessions!inner(user_id)')
    .eq('workout_sessions.user_id', userId)
    .eq('is_pr', true)
    .order('created_at', { ascending: false })
    .limit(10);

  // Workout adherence (last 4 weeks)
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400 * 1000).toISOString();
  const { count: workoutCount } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', fourWeeksAgo);

  // Target workouts per week from active program
  const { data: activeProgram } = await supabase
    .from('workout_programs')
    .select('id, days_per_week')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  const targetPerWeek = activeProgram?.days_per_week ?? 3;
  const targetTotal = targetPerWeek * 4;

  return {
    weight_trend: weightData ?? [],
    recent_prs: recentPRs ?? [],
    workout_adherence: {
      completed: workoutCount ?? 0,
      target: targetTotal,
      percentage: targetTotal > 0 ? Math.round(((workoutCount ?? 0) / targetTotal) * 100) : 0,
    },
  };
}

async function generateWorkoutPlan(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const daysPerWeek = (params.days_per_week as number) ?? 3;
  const goal = (params.goal as string) ?? 'general';
  const level = (params.experience_level as string) ?? 'intermediate';

  const aiProvider = createAIProvider();
  const response = await aiProvider.chat(
    [
      {
        role: 'system',
        content: `Generate a ${daysPerWeek}-day workout program for ${level} level, goal: ${goal}. Return JSON with this structure:
{
  "name": "Program Name",
  "description": "Brief description",
  "days_per_week": ${daysPerWeek},
  "difficulty": "${level}",
  "days": [
    {
      "day_number": 1,
      "name": "Day Name",
      "focus_area": "muscle_group",
      "exercises": [
        {
          "exercise_name": "Exercise Name",
          "target_sets": 3,
          "target_reps": "8-12",
          "rest_seconds": 90,
          "notes": "Optional notes"
        }
      ]
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Create a ${daysPerWeek}-day ${goal} program for ${level} level.`,
      },
    ],
    { json_mode: true, temperature: 0.8, max_tokens: 3000 },
  );

  try {
    const plan = JSON.parse(response.content ?? '{}');
    plan.created_by = 'ai';
    plan.user_id = userId;
    return { workout_plan: plan };
  } catch {
    return { workout_plan: null, error: 'Failed to generate workout plan' };
  }
}

async function reviseWorkoutPlan(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const programId = params.program_id as string;
  const revisions = params.revisions as string;

  const { data: existingProgram } = await supabase
    .from('workout_programs')
    .select('*')
    .eq('id', programId)
    .eq('user_id', userId)
    .single();

  if (!existingProgram) {
    return { error: 'Program not found' };
  }

  const aiProvider = createAIProvider();
  const response = await aiProvider.chat(
    [
      {
        role: 'system',
        content: 'Revise the workout program based on user feedback. Return the full revised program as JSON with the same structure.',
      },
      {
        role: 'user',
        content: `Current program:\n${JSON.stringify(existingProgram, null, 2)}\n\nRevisions requested: ${revisions}`,
      },
    ],
    { json_mode: true, temperature: 0.7, max_tokens: 3000 },
  );

  try {
    const revised = JSON.parse(response.content ?? '{}');
    return { workout_plan: revised };
  } catch {
    return { error: 'Failed to revise workout plan' };
  }
}

async function suggestLoadForSet(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const exerciseName = params.exercise_name as string;

  // Find recent sets for this exercise via set_logs joined through workout_sessions and exercises
  const { data: setData } = await supabase
    .from('set_logs')
    .select('weight_kg, reps, created_at, exercises!inner(name), workout_sessions!inner(user_id, completed_at)')
    .eq('workout_sessions.user_id', userId)
    .not('workout_sessions.completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  // Extract sets for the exercise
  const exerciseSets: Array<{ weight: number; reps: number; date: string }> = [];
  for (const set of setData ?? []) {
    const setExerciseName = ((set.exercises as Record<string, unknown>)?.name as string) ?? '';
    if (setExerciseName.toLowerCase() === exerciseName.toLowerCase() && set.weight_kg && set.reps) {
      exerciseSets.push({
        weight: set.weight_kg as number,
        reps: set.reps as number,
        date: (set.workout_sessions as Record<string, unknown>)?.completed_at as string,
      });
    }
    if (exerciseSets.length >= 10) break;
  }

  if (exerciseSets.length === 0) {
    return {
      suggestion: {
        suggested_weight: null,
        suggested_reps: null,
        explanation: `No previous data for ${exerciseName}. Start with a comfortable weight for 8-12 reps.`,
        confidence: 'low',
      },
    };
  }

  // Simple progressive overload: take the best recent set and suggest +2.5% weight or +1 rep
  const bestSet = exerciseSets.reduce((best, s) => (s.weight * s.reps > best.weight * best.reps ? s : best));
  const suggestedWeight = Math.round((bestSet.weight * 1.025) * 2) / 2; // Round to nearest 0.5
  const suggestedReps = bestSet.reps;

  return {
    suggestion: {
      suggested_weight: suggestedWeight,
      suggested_reps: suggestedReps,
      explanation: `Based on your best recent set of ${bestSet.weight}kg × ${bestSet.reps}, try ${suggestedWeight}kg × ${suggestedReps} for progressive overload.`,
      confidence: exerciseSets.length >= 5 ? 'high' : 'medium',
      recent_history: exerciseSets.slice(0, 5),
    },
  };
}

async function parseMealText(
  _supabase: SupabaseClient,
  _userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const text = params.text as string;
  if (!text) return { error: 'No text provided' };

  const aiProvider = createAIProvider();
  const response = await aiProvider.chat(
    [
      {
        role: 'system',
        content: `Parse the following meal description into structured nutrition data. Return JSON array:
[
  {
    "name": "Food item name",
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "fiber_g": 0,
    "quantity": 1,
    "unit": "serving",
    "is_estimate": true,
    "confidence": 0.8
  }
]
Be reasonable with portion sizes. All values are estimates.`,
      },
      { role: 'user', content: text },
    ],
    { json_mode: true, temperature: 0.3, max_tokens: 1500 },
  );

  try {
    const parsed = JSON.parse(response.content ?? '[]');
    const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
    return {
      items: items.map((item: Record<string, unknown>) => ({
        ...item,
        is_estimate: true,
      })),
      raw_text: text,
      parse_method: 'ai',
    };
  } catch {
    return { items: [], raw_text: text, parse_method: 'ai', error: 'Failed to parse meal text' };
  }
}

async function analyzeMealPhoto(
  _supabase: SupabaseClient,
  _userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Placeholder implementation — returns reasonable estimates
  const description = (params.description as string) ?? 'meal photo';

  return {
    items: [
      {
        name: 'Detected food item',
        calories: 350,
        protein_g: 25,
        carbs_g: 30,
        fat_g: 12,
        fiber_g: 4,
        quantity: 1,
        unit: 'serving',
        is_estimate: true,
        confidence: 0.5,
      },
    ],
    analysis_method: 'placeholder',
    description: `Photo analysis is a preview feature. The items shown are estimates based on: ${description}. Please review and adjust.`,
  };
}

async function calculateDailyTargets(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!profile) return { error: 'Profile not found' };

  // Mifflin-St Jeor equation
  const weightKg = profile.weight_kg ?? 70;
  const heightCm = profile.height_cm ?? 170;
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400 * 1000))
    : 30;
  const isFemale = profile.gender === 'female';

  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  bmr += isFemale ? -161 : 5;

  // Activity multiplier (no activity_level column on goals; default to moderate)
  const activityMultipliers = [1.2, 1.375, 1.55, 1.725, 1.9];
  const activityLevel = 3;
  const tdee = Math.round(bmr * (activityMultipliers[activityLevel - 1] ?? 1.55));

  // Adjust for goal
  let targetCalories = tdee;
  const goalType = goals?.goal_type ?? 'general_health';
  if (goalType === 'weight_loss') targetCalories = Math.round(tdee * 0.8);
  else if (goalType === 'muscle_gain') targetCalories = Math.round(tdee * 1.1);

  // Enforce minimum calories
  const minCalories = isFemale ? 1200 : 1500;
  targetCalories = Math.max(targetCalories, minCalories);

  // Macro split
  const proteinG = Math.round(weightKg * 1.8); // 1.8g per kg for active individuals
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbsG = Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4);

  return {
    targets: {
      calories: targetCalories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      fiber_g: isFemale ? 25 : 30,
      water_ml: Math.round(weightKg * 35),
    },
    calculation: {
      bmr: Math.round(bmr),
      tdee,
      goal_adjustment: goalType,
      method: 'Mifflin-St Jeor',
    },
  };
}

async function generateMealPlan(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const duration = (params.duration as string) ?? 'day';
  const dietary = (params.dietary_preferences as string) ?? 'no restrictions';

  // Get user targets
  const targets = await calculateDailyTargets(supabase, userId);
  const cal = (targets.targets as Record<string, number>)?.calories ?? 2200;
  const protein = (targets.targets as Record<string, number>)?.protein_g ?? 150;

  const aiProvider = createAIProvider();
  const response = await aiProvider.chat(
    [
      {
        role: 'system',
        content: `Generate a ${duration === 'week' ? '7-day' : '1-day'} meal plan. Target: ~${cal} calories, ~${protein}g protein per day. Dietary preferences: ${dietary}.
Return JSON:
{
  "days": [
    {
      "day": 1,
      "meals": [
        {
          "meal_type": "breakfast",
          "name": "Meal Name",
          "items": [
            { "name": "Food", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "quantity": 1, "unit": "serving" }
          ]
        }
      ],
      "totals": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
    }
  ]
}`,
      },
      { role: 'user', content: `Create a ${duration} meal plan.` },
    ],
    { json_mode: true, temperature: 0.8, max_tokens: 4000 },
  );

  try {
    const plan = JSON.parse(response.content ?? '{}');
    return { meal_plan: plan, is_estimate: true };
  } catch {
    return { error: 'Failed to generate meal plan' };
  }
}

async function generateGroceryList(
  _supabase: SupabaseClient,
  _userId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const mealPlan = params.meal_plan;
  if (!mealPlan) return { error: 'No meal plan provided' };

  const aiProvider = createAIProvider();
  const response = await aiProvider.chat(
    [
      {
        role: 'system',
        content: `Given this meal plan, generate a consolidated grocery list grouped by category. Return JSON:
{
  "categories": [
    {
      "name": "Proteins",
      "items": [{ "name": "Chicken Breast", "quantity": "2 lbs", "estimated_cost": 8.99 }]
    }
  ],
  "estimated_total_cost": 0
}`,
      },
      { role: 'user', content: JSON.stringify(mealPlan) },
    ],
    { json_mode: true, temperature: 0.5, max_tokens: 2000 },
  );

  try {
    return JSON.parse(response.content ?? '{}');
  } catch {
    return { error: 'Failed to generate grocery list' };
  }
}

async function recommendSupplements(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').single();
  const { data: nutrition } = await supabase
    .from('nutrition_day_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(7);

  const goalType = goals?.goal_type ?? 'general';
  const avgProtein = nutrition?.length
    ? nutrition.reduce((sum: number, d: Record<string, unknown>) => sum + ((d.total_protein_g as number) ?? 0), 0) / nutrition.length
    : 0;

  const recommendations: Array<Record<string, unknown>> = [
    {
      name: 'Vitamin D3',
      reason: 'General health — most people are deficient, especially those who train indoors.',
      standard_dose: '2000-4000 IU daily',
      disclaimer: 'Consult your doctor for personalized dosage based on blood levels.',
    },
    {
      name: 'Creatine Monohydrate',
      reason: 'Well-researched for strength and muscle gains.',
      standard_dose: '3-5g daily',
      disclaimer: 'One of the most studied supplements. Generally safe for healthy adults.',
    },
  ];

  if (avgProtein < (profile?.weight_kg ?? 70) * 1.6) {
    recommendations.push({
      name: 'Whey Protein',
      reason: `Your average protein intake (${Math.round(avgProtein)}g) is below the recommended ${Math.round((profile?.weight_kg ?? 70) * 1.6)}g for your goals.`,
      standard_dose: '20-40g per serving, 1-2 servings daily as needed',
      disclaimer: 'A convenient way to meet protein targets. Whole food sources are preferred.',
    });
  }

  if (goalType === 'muscle_gain' || goalType === 'strength') {
    recommendations.push({
      name: 'Magnesium',
      reason: 'Supports muscle recovery and sleep quality, important for strength training.',
      standard_dose: '200-400mg daily (glycinate or citrate form)',
      disclaimer: 'Consult your doctor. May interact with some medications.',
    });
  }

  return {
    recommendations,
    general_disclaimer: 'These are general supplement suggestions based on common research. Always consult a healthcare provider before starting any supplement regimen. Individual needs vary.',
  };
}

async function createWeeklySummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = now.toISOString().split('T')[0];

  // Workout data
  const { data: workouts } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', weekStart.toISOString())
    .order('completed_at', { ascending: true });

  // Nutrition data
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (d <= now) dates.push(d.toISOString().split('T')[0]);
  }

  const { data: nutritionDays } = await supabase
    .from('nutrition_day_logs')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates);

  // Targets
  const { data: prefs } = await supabase.from('coach_preferences').select('*').eq('user_id', userId).single();
  const targets = await calculateDailyTargets(supabase, userId);
  const targetCal = (targets.targets as Record<string, number>)?.calories ?? 2200;
  const targetProtein = (targets.targets as Record<string, number>)?.protein_g ?? 150;

  // Active program for planned workouts
  const { data: activeProgram } = await supabase
    .from('workout_programs')
    .select('id, days_per_week')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  const plannedWorkouts = activeProgram?.days_per_week ?? 3;
  const completedWorkouts = workouts?.length ?? 0;

  // Nutrition averages
  const avgCalories = nutritionDays?.length
    ? Math.round(nutritionDays.reduce((s: number, d: Record<string, unknown>) => s + ((d.total_calories as number) ?? 0), 0) / nutritionDays.length)
    : 0;
  const avgProtein = nutritionDays?.length
    ? Math.round(nutritionDays.reduce((s: number, d: Record<string, unknown>) => s + ((d.total_protein_g as number) ?? 0), 0) / nutritionDays.length)
    : 0;

  // PRs — query set_logs with is_pr flag joined through workout_sessions
  const { data: prSetLogs } = await supabase
    .from('set_logs')
    .select('weight_kg, reps, exercises(name), workout_sessions!inner(user_id, completed_at)')
    .eq('workout_sessions.user_id', userId)
    .eq('is_pr', true)
    .gte('workout_sessions.completed_at', weekStart.toISOString())
    .order('created_at', { ascending: false });

  const prs: Array<Record<string, string>> = [];
  for (const set of prSetLogs ?? []) {
    prs.push({
      exercise: ((set.exercises as Record<string, unknown>)?.name as string) ?? 'Unknown',
      type: 'weight',
      value: `${set.weight_kg}kg × ${set.reps}`,
    });
  }

  // Determine trends
  const workoutTrend = completedWorkouts >= plannedWorkouts ? 'improving' : completedWorkouts >= plannedWorkouts * 0.7 ? 'maintaining' : 'declining';
  const nutritionTrend = avgCalories > 0
    ? Math.abs(avgCalories - targetCal) / targetCal < 0.1 ? 'maintaining' : avgCalories > targetCal * 0.9 ? 'improving' : 'declining'
    : 'maintaining';

  const coachTone = (prefs?.tone as string) ?? 'balanced';

  return {
    period: { start: weekStartStr, end: weekEndStr },
    workout_adherence: {
      completed: completedWorkouts,
      planned: plannedWorkouts,
      percentage: plannedWorkouts > 0 ? Math.round((completedWorkouts / plannedWorkouts) * 100) : 0,
    },
    nutrition_adherence: {
      avg_calories: avgCalories,
      target_calories: targetCal,
      avg_protein_g: avgProtein,
      target_protein_g: targetProtein,
      percentage: targetCal > 0 ? Math.round((avgCalories / targetCal) * 100) : 0,
    },
    prs_achieved: prs,
    trends: {
      workout: workoutTrend,
      nutrition: nutritionTrend,
      overall: workoutTrend === 'improving' && nutritionTrend !== 'declining' ? 'improving' : workoutTrend === 'declining' || nutritionTrend === 'declining' ? 'declining' : 'maintaining',
    },
    recommendations: generateRecommendations(completedWorkouts, plannedWorkouts, avgCalories, targetCal, avgProtein, targetProtein),
    motivational_message: generateMotivation(coachTone, completedWorkouts, prs.length),
    coach_tone: coachTone,
  };
}

function generateRecommendations(
  completedWorkouts: number,
  plannedWorkouts: number,
  avgCalories: number,
  targetCalories: number,
  avgProtein: number,
  targetProtein: number,
): string[] {
  const recs: string[] = [];

  if (completedWorkouts < plannedWorkouts) {
    recs.push(`You completed ${completedWorkouts}/${plannedWorkouts} planned workouts. Try to prioritize consistency — even shorter sessions count.`);
  }

  if (avgCalories > 0 && avgCalories < targetCalories * 0.85) {
    recs.push(`Your average calorie intake (${avgCalories}) is below target (${targetCalories}). Consider adding a snack or increasing portions.`);
  } else if (avgCalories > targetCalories * 1.15) {
    recs.push(`Your average calorie intake (${avgCalories}) is above target (${targetCalories}). Review portion sizes or swap in lower-calorie options.`);
  }

  if (avgProtein > 0 && avgProtein < targetProtein * 0.85) {
    recs.push(`Protein is below target (${avgProtein}g avg vs ${targetProtein}g). Add a protein source to each meal.`);
  }

  if (recs.length === 0) {
    recs.push("Great consistency this week! Keep up the solid work and focus on progressive overload in your workouts.");
  }

  return recs;
}

function generateMotivation(tone: string, workouts: number, prs: number): string {
  if (tone === 'direct') {
    if (workouts === 0) return 'No workouts this week. Time to get after it.';
    return `${workouts} workouts done${prs > 0 ? `, ${prs} PRs` : ''}. Keep pushing.`;
  }
  if (tone === 'encouraging') {
    if (workouts === 0) return "Every journey has its ups and downs. This week is a fresh start — you've got this!";
    return `Amazing work getting ${workouts} workout${workouts > 1 ? 's' : ''} in${prs > 0 ? ` and smashing ${prs} PR${prs > 1 ? 's' : ''}` : ''}! You should be proud of your dedication!`;
  }
  // balanced
  if (workouts === 0) return "No workouts logged this week. Let's focus on getting back on track — start with one session.";
  return `Solid week with ${workouts} workout${workouts > 1 ? 's' : ''}${prs > 0 ? ` and ${prs} PR${prs > 1 ? 's' : ''}` : ''}. Consistency is key — keep it going.`;
}
