// ── Weekly Summary Edge Function ────────────────────────────────────
// Generates a comprehensive weekly coaching summary.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import type { WeeklySummaryRequest } from '../_shared/types.ts';

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabase } = await verifyAuth(req);

    let body: WeeklySummaryRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine, defaults to current week
    }

    // Determine week range
    const now = new Date();
    let weekStart: Date;
    if (body.week_start) {
      weekStart = new Date(body.week_start + 'T00:00:00');
    } else {
      weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Fetch data in parallel
    const [workoutsResult, nutritionResult, prefsResult, profileResult, goalsResult, programResult] =
      await Promise.all([
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user_id)
          .not('completed_at', 'is', null)
          .gte('completed_at', weekStart.toISOString())
          .lte('completed_at', weekEnd.toISOString())
          .order('completed_at', { ascending: true }),
        supabase
          .from('nutrition_day_logs')
          .select('*')
          .eq('user_id', user_id)
          .gte('date', weekStartStr)
          .lte('date', weekEndStr)
          .order('date', { ascending: true }),
        supabase.from('coach_preferences').select('*').eq('user_id', user_id).single(),
        supabase.from('profiles').select('*').eq('user_id', user_id).single(),
        supabase.from('goals').select('*').eq('user_id', user_id).eq('status', 'active').single(),
        supabase
          .from('workout_programs')
          .select('days')
          .eq('user_id', user_id)
          .eq('is_active', true)
          .single(),
      ]);

    const workouts = workoutsResult.data ?? [];
    const nutritionDays = nutritionResult.data ?? [];
    const prefs = prefsResult.data;
    const profile = profileResult.data;
    const goals = goalsResult.data;
    const coachTone = (prefs?.coach_tone as string) ?? 'balanced';

    // Workout adherence
    const plannedWorkouts = programResult.data?.days?.length ?? 3;
    const completedWorkouts = workouts.length;

    // PRs
    const prs: Array<{ exercise: string; type: string; value: string }> = [];
    for (const w of workouts) {
      const sets = (w.sets as Array<Record<string, unknown>>) ?? [];
      for (const set of sets) {
        if (set.is_pr) {
          prs.push({
            exercise: (set.exercise_name as string) ?? 'Unknown',
            type: 'weight',
            value: `${set.weight_kg ?? 0}kg x ${set.reps ?? 0}`,
          });
        }
      }
    }

    // Nutrition adherence
    const isFemale = profile?.gender === 'female';
    const weightKg = profile?.weight_kg ?? 70;
    const heightCm = profile?.height_cm ?? 170;
    const age = profile?.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400 * 1000),
        )
      : 30;

    let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (isFemale ? -161 : 5);
    const activityMultipliers = [1.2, 1.375, 1.55, 1.725, 1.9];
    const activityLevel = goals?.activity_level ?? 2;
    const tdee = Math.round(bmr * (activityMultipliers[activityLevel - 1] ?? 1.55));

    let targetCalories = tdee;
    const goalType = goals?.goal_type ?? 'maintain';
    if (goalType === 'lose_fat') targetCalories = Math.round(tdee * 0.8);
    else if (goalType === 'build_muscle') targetCalories = Math.round(tdee * 1.1);
    targetCalories = Math.max(targetCalories, isFemale ? 1200 : 1500);

    const targetProtein = Math.round(weightKg * 1.8);

    const avgCalories = nutritionDays.length
      ? Math.round(
          nutritionDays.reduce((s: number, d: Record<string, unknown>) => s + ((d.total_calories as number) ?? 0), 0) /
            nutritionDays.length,
        )
      : 0;
    const avgProtein = nutritionDays.length
      ? Math.round(
          nutritionDays.reduce(
            (s: number, d: Record<string, unknown>) => s + ((d.total_protein_g as number) ?? 0),
            0,
          ) / nutritionDays.length,
        )
      : 0;

    // Trends
    const workoutTrend =
      completedWorkouts >= plannedWorkouts
        ? 'improving'
        : completedWorkouts >= plannedWorkouts * 0.7
          ? 'maintaining'
          : 'declining';

    const nutritionTrend =
      avgCalories > 0
        ? Math.abs(avgCalories - targetCalories) / targetCalories < 0.1
          ? 'maintaining'
          : avgCalories >= targetCalories * 0.9
            ? 'improving'
            : 'declining'
        : 'maintaining';

    const overallTrend =
      workoutTrend === 'improving' && nutritionTrend !== 'declining'
        ? 'improving'
        : workoutTrend === 'declining' || nutritionTrend === 'declining'
          ? 'declining'
          : 'maintaining';

    // Recommendations
    const recommendations: string[] = [];
    if (completedWorkouts < plannedWorkouts) {
      recommendations.push(
        `You completed ${completedWorkouts}/${plannedWorkouts} planned workouts. Try to schedule sessions at fixed times to build consistency.`,
      );
    } else {
      recommendations.push('Workout adherence is on track — great discipline!');
    }

    if (avgCalories > 0 && avgCalories < targetCalories * 0.85) {
      recommendations.push(
        `Average calorie intake (${avgCalories}) is below your target (${targetCalories}). Ensure you\'re fueling enough for recovery.`,
      );
    }

    if (avgProtein > 0 && avgProtein < targetProtein * 0.85) {
      recommendations.push(
        `Average protein (${avgProtein}g) is below target (${targetProtein}g). Consider adding a protein source to each meal.`,
      );
    }

    if (prs.length > 0) {
      recommendations.push(
        `You hit ${prs.length} PR${prs.length > 1 ? 's' : ''} this week! Progressive overload is working.`,
      );
    }

    // Motivational message based on tone
    let motivationalMessage: string;
    if (coachTone === 'direct') {
      motivationalMessage =
        completedWorkouts === 0
          ? 'Zero workouts. No shortcuts — show up and put in the work.'
          : `${completedWorkouts} sessions. ${prs.length > 0 ? `${prs.length} PRs. ` : ''}Numbers don't lie — keep executing.`;
    } else if (coachTone === 'encouraging') {
      motivationalMessage =
        completedWorkouts === 0
          ? "This week was tough, and that's okay! Every week is a fresh chance to show up for yourself. You've got this!"
          : `What a week! ${completedWorkouts} workout${completedWorkouts > 1 ? 's' : ''} completed${prs.length > 0 ? ` with ${prs.length} personal record${prs.length > 1 ? 's' : ''}!` : '!'} Your dedication is truly inspiring!`;
    } else {
      motivationalMessage =
        completedWorkouts === 0
          ? "No workouts this week — let's get back on track. One session at a time."
          : `Good week: ${completedWorkouts} workout${completedWorkouts > 1 ? 's' : ''}${prs.length > 0 ? `, ${prs.length} PR${prs.length > 1 ? 's' : ''}` : ''}. Consistency builds results.`;
    }

    return jsonResponse({
      period: { start: weekStartStr, end: weekEndStr },
      workout_adherence: {
        completed: completedWorkouts,
        planned: plannedWorkouts,
        percentage:
          plannedWorkouts > 0 ? Math.round((completedWorkouts / plannedWorkouts) * 100) : 0,
      },
      nutrition_adherence: {
        avg_calories: avgCalories,
        target_calories: targetCalories,
        avg_protein_g: avgProtein,
        target_protein_g: targetProtein,
        percentage: targetCalories > 0 ? Math.round((avgCalories / targetCalories) * 100) : 0,
      },
      prs_achieved: prs,
      trends: {
        workout: workoutTrend,
        nutrition: nutritionTrend,
        overall: overallTrend,
      },
      recommendations,
      motivational_message: motivationalMessage,
      coach_tone: coachTone,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Weekly summary error:', error);
    return errorResponse('Failed to generate weekly summary. Please try again.', 500);
  }
});
