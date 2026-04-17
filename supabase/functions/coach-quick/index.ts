// ── Coach Quick Edge Function ───────────────────────────────────────
// Handles one-shot contextual coach messages (in-workout, in-nutrition,
// exercise-adjustment). Unlike `coach-chat`, this does not persist
// conversation state or run tool calls — it's a simple prompt-and-reply
// flow optimized for mid-session micro-interactions.
//
// Modes:
//   - workout: brief coaching while the user is doing an exercise
//   - nutrition: quick nutrition advice given user's targets/allergies
//   - exercise_adjustment: replace/adjust an exercise in the current
//     workout; server returns a coach reply that the client parses for
//     structured adjustment actions.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';
import { validateInput, SAFETY_SYSTEM_PROMPT } from '../_shared/safety.ts';
import type { AIMessage } from '../_shared/types.ts';

type CoachQuickMode = 'workout' | 'nutrition' | 'exercise_adjustment';

interface CoachQuickRequest {
  mode: CoachQuickMode;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Mode-specific context
  workout?: { current_exercise?: string };
  nutrition?: {
    targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    today_totals?: { calories: number; protein: number; carbs: number; fat: number; meal_count: number };
    allergies?: string[];
    dietary_preferences?: string[];
  };
  adjustment?: {
    current_exercise: string;
    workout_exercises?: Array<{ name: string }>;
    available_exercises: string[];
  };
}

interface CoachQuickResponse {
  content: string;
  model: string;
}

const MAX_AVAILABLE_EXERCISES = 600;
const MAX_HISTORY = 8;

// ── Prompt builders ─────────────────────────────────────────────────

function buildWorkoutPrompt(exerciseName?: string): string {
  return `You are Coach — a concise fitness coach giving quick advice during a workout. Keep responses to 1-2 short paragraphs max.
${exerciseName ? `The user is currently doing: ${exerciseName}` : ''}
Be practical and actionable. Focus on form cues, exercise alternatives, and quick tips. Don't give lengthy explanations — the user is mid-workout.

${SAFETY_SYSTEM_PROMPT}

You are EXCLUSIVELY a health and fitness coach. Only respond to questions about exercise, workouts, nutrition, and wellness. If the user asks about anything else, politely redirect: "I'm your fitness coach — let's keep the focus on your workout! What can I help with?"`;
}

function buildNutritionPrompt(ctx: NonNullable<CoachQuickRequest['nutrition']>): string {
  const t = ctx.targets;
  const today = ctx.today_totals
    ? `Today so far: ${ctx.today_totals.calories} cal, ${ctx.today_totals.protein}g protein, ${ctx.today_totals.carbs}g carbs, ${ctx.today_totals.fat}g fat (${ctx.today_totals.meal_count} meals logged).`
    : '';
  const allergyWarning = ctx.allergies?.length
    ? `\nALLERGIES (NEVER include these): ${ctx.allergies.join(', ')}`
    : '';
  const dietaryInfo = ctx.dietary_preferences?.length
    ? `\nDietary Preferences: ${ctx.dietary_preferences.join(', ')}`
    : '';

  return `You are Coach — a concise nutrition coach. Keep responses to 1-2 short paragraphs max.
User's daily targets: ${t.calories} cal, ${t.protein_g}g protein, ${t.carbs_g}g carbs, ${t.fat_g}g fat.
${today}${allergyWarning}${dietaryInfo}
Be practical — suggest specific foods with approximate macros. All nutritional values are estimates.

${SAFETY_SYSTEM_PROMPT}

You are EXCLUSIVELY a health and nutrition coach. Only respond to questions about nutrition, diet, fitness, and wellness. If the user asks about anything unrelated, politely redirect: "I'm your nutrition coach — let's keep the focus on your diet and health! What can I help with?"`;
}

function buildAdjustmentPrompt(ctx: NonNullable<CoachQuickRequest['adjustment']>): string {
  const workoutSection =
    ctx.workout_exercises && ctx.workout_exercises.length > 0
      ? `\nExercises in the current workout:\n${ctx.workout_exercises.map((e) => `- ${e.name}`).join('\n')}`
      : '';

  const availableNames = ctx.available_exercises.slice(0, MAX_AVAILABLE_EXERCISES);

  return `You are Coach — a concise fitness coach helping a user adjust their current workout.
The user is currently focused on: ${ctx.current_exercise}
${workoutSection}

Available exercises in the library:
${availableNames.join(', ')}

When the user asks to replace, swap, or find an alternative for a SINGLE exercise, respond with:
1. A brief explanation (1-2 sentences) of why this is a good swap.
2. A JSON block on its own line in this exact format:
\`\`\`json
{"adjustments":[{"action":"replace","currentExercise":"Name Of Exercise Being Replaced","exerciseName":"Exact Exercise Name From Library","reason":"Short reason"}]}
\`\`\`

When the user asks to replace or modify MULTIPLE exercises (e.g. "replace all dumbbell exercises with barbell"), respond with:
1. A brief explanation of the changes.
2. A JSON block with multiple adjustments:
\`\`\`json
{"adjustments":[{"action":"replace","currentExercise":"Dumbbell Press","exerciseName":"Barbell Bench Press","reason":"..."},{"action":"replace","currentExercise":"Dumbbell Row","exerciseName":"Barbell Row","reason":"..."}]}
\`\`\`

When the user asks to adjust sets, reps, or weight for an exercise, respond with:
1. A brief explanation of the adjustment.
2. A JSON block:
\`\`\`json
{"adjustments":[{"action":"adjust_sets","currentExercise":"Exercise Name","sets":4,"reps":"8-10","reason":"Short reason"}]}
\`\`\`

IMPORTANT:
- The exerciseName in replace actions MUST exactly match one of the available exercises listed above.
- The currentExercise MUST exactly match one of the exercises in the current workout.
- Only include the JSON block when you are making concrete suggestions. For general advice, just respond normally.
- Keep your text response very short — the user is mid-workout.
- Always wrap adjustments in the {"adjustments":[...]} format, even for a single change.

${SAFETY_SYSTEM_PROMPT}

You are EXCLUSIVELY a health and fitness coach. Only respond to questions about exercise, workouts, nutrition, and wellness. If the user asks about anything unrelated, politely redirect: "I'm your fitness coach — let's keep the focus on your workout! What can I help with?"`;
}

// ── Handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: CoachQuickRequest = await req.json();

    const inputCheck = validateInput(body.message ?? '');
    if (!inputCheck.safe) {
      return errorResponse(inputCheck.reason ?? 'Invalid input', 400);
    }

    let systemPrompt: string;
    let coachContext: 'workout' | 'nutrition' | 'progress';

    switch (body.mode) {
      case 'workout':
        systemPrompt = buildWorkoutPrompt(body.workout?.current_exercise);
        coachContext = 'workout';
        break;
      case 'nutrition':
        if (!body.nutrition?.targets) {
          return errorResponse('nutrition.targets required for nutrition mode', 400);
        }
        systemPrompt = buildNutritionPrompt(body.nutrition);
        coachContext = 'nutrition';
        break;
      case 'exercise_adjustment':
        if (!body.adjustment?.current_exercise || !Array.isArray(body.adjustment.available_exercises)) {
          return errorResponse('adjustment.current_exercise and available_exercises required', 400);
        }
        systemPrompt = buildAdjustmentPrompt(body.adjustment);
        coachContext = 'workout';
        break;
      default:
        return errorResponse('Invalid mode (expected: workout, nutrition, exercise_adjustment)', 400);
    }

    // Build messages: system + windowed history + current message
    const recentHistory = (body.history ?? []).slice(-MAX_HISTORY).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: body.message },
    ];

    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(messages, {
      temperature: 0.7,
      max_tokens: 1024,
    });

    const response: CoachQuickResponse = {
      content: aiResponse.content ?? '',
      model: aiResponse.model,
    };

    const latencyMs = Date.now() - startTime;
    await supabase.from('ai_usage_events').insert({
      user_id,
      model: aiResponse.model,
      input_tokens: aiResponse.input_tokens,
      output_tokens: aiResponse.output_tokens,
      total_tokens: aiResponse.total_tokens,
      estimated_cost_usd: estimateCost(aiResponse.model, aiResponse.input_tokens, aiResponse.output_tokens),
      latency_ms: latencyMs,
      status: 'success',
      tool_calls_count: 0,
      context: coachContext,
      created_at: new Date().toISOString(),
    });

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Coach quick error:', error);
    return errorResponse('Coach is temporarily unavailable. Please try again.', 500);
  }
});
