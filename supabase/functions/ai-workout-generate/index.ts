// ── AI Workout Generate Edge Function ───────────────────────────────
// Generates a single workout session from the user's prompt and context.
// Context (profile/equipment/exercise library) is passed in by the client
// since it lives client-side; the server never sees the raw AI key.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';

interface WorkoutGenerateRequest {
  prompt: string;
  exercise_names: string[];
  context?: {
    goals?: string[];
    primary_goal?: string;
    training_experience?: string;
    training_days_per_week?: number;
    injuries?: string;
    equipment?: string[];
    recent_workouts?: Array<{ name: string; date?: string; exercises: string[] }>;
    active_program?: { name: string; difficulty?: string; days_per_week?: number };
  };
}

interface GeneratedExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
}

interface WorkoutGenerateResponse {
  name: string;
  exercises: GeneratedExercise[];
  model: string;
}

const MAX_EXERCISE_NAMES = 600;
const MAX_PROMPT_LENGTH = 1000;

function buildContextBlock(ctx: WorkoutGenerateRequest['context']): string {
  if (!ctx) return '';
  const lines: string[] = [];

  if (ctx.goals?.length) lines.push(`Goals: ${ctx.goals.join(', ')}`);
  if (ctx.primary_goal) lines.push(`Primary goal: ${ctx.primary_goal}`);
  if (ctx.training_experience) lines.push(`Training experience: ${ctx.training_experience}`);
  if (ctx.training_days_per_week) lines.push(`Training days/week: ${ctx.training_days_per_week}`);
  if (ctx.injuries) lines.push(`Injuries/limitations: ${ctx.injuries}`);
  if (ctx.equipment?.length) lines.push(`Available equipment: ${ctx.equipment.join(', ')}`);

  if (ctx.recent_workouts?.length) {
    lines.push('\nRecent workouts:');
    for (const w of ctx.recent_workouts.slice(0, 5)) {
      lines.push(`- ${w.name}${w.date ? ` (${w.date})` : ''}: ${w.exercises.join(', ')}`);
    }
  }

  if (ctx.active_program) {
    const p = ctx.active_program;
    lines.push(`\nActive program: ${p.name}${p.difficulty ? ` (${p.difficulty})` : ''}${p.days_per_week ? ` — ${p.days_per_week} days/week` : ''}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(ctx: string, exerciseNames: string[]): string {
  return `You are a workout programming AI for a health and fitness app. Generate a single workout session based on the user's prompt, goals, equipment, and experience.

## User Context
${ctx || '(no additional context provided)'}

## Requirements
- ONLY use exercises from the "Available exercises" list below. Use the EXACT exercise names.
- Respect any listed injuries — avoid movements that aggravate them.
- Match volume and intensity to the user's experience level.
- Consider recent workouts to avoid overtraining the same muscle groups back-to-back.
- Use appropriate equipment based on what the user has.
- Include 4–8 exercises per workout.
- Sets: 2–5 per exercise. Reps: appropriate for the goal (e.g. "6-8" for strength, "8-12" for hypertrophy, "12-15" for endurance).
- Rest seconds: 60–90 for hypertrophy, 120–180 for strength, 30–60 for conditioning.

## Available exercises (use ONLY these exact names)
${exerciseNames.join(', ')}

## Output Format
Return a JSON object in this exact shape:
{
  "name": "Workout Name",
  "exercises": [
    { "name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "rest_seconds": 90, "notes": "Focus on controlled tempo" }
  ]
}`;
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: WorkoutGenerateRequest = await req.json();

    if (!body.prompt || body.prompt.trim().length === 0) {
      return errorResponse('Prompt is required', 400);
    }
    if (body.prompt.length > MAX_PROMPT_LENGTH) {
      return errorResponse(`Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`, 400);
    }
    if (!Array.isArray(body.exercise_names) || body.exercise_names.length === 0) {
      return errorResponse('exercise_names must be a non-empty array', 400);
    }

    const names = body.exercise_names.slice(0, MAX_EXERCISE_NAMES);
    const contextBlock = buildContextBlock(body.context);
    const systemPrompt = buildSystemPrompt(contextBlock, names);

    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: body.prompt },
      ],
      { json_mode: true, temperature: 0.5, max_tokens: 1500 },
    );

    const parsed = JSON.parse(aiResponse.content ?? '{}');
    if (!parsed.name || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      throw new Error('AI response missing required workout fields');
    }

    const exercises: GeneratedExercise[] = parsed.exercises.map(
      (ex: Record<string, unknown>) => ({
        name: String(ex.name ?? 'Exercise'),
        sets: Number(ex.sets ?? 3),
        reps: String(ex.reps ?? '8-12'),
        rest_seconds: Number(ex.rest_seconds ?? 90),
        notes: ex.notes ? String(ex.notes) : undefined,
      }),
    );

    const response: WorkoutGenerateResponse = {
      name: String(parsed.name),
      exercises,
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
      context: 'workout',
      created_at: new Date().toISOString(),
    });

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Workout generate error:', error);
    return errorResponse('Failed to generate workout. Please try again.', 500);
  }
});
