// ── AI Recipe Generate Edge Function ────────────────────────────────
// Generates a single recipe from the user's prompt plus profile context
// (allergies, dietary preferences, cooking skills, macro targets). All
// context is supplied in the request body since it lives client-side.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';

interface RecipeIngredientRequest {
  name: string;
  quantity: number;
}

interface RecipeGenerateRequest {
  prompt: string;
  context?: {
    goals?: string[];
    primary_goal?: string;
    allergies?: string[];
    dietary_preferences?: string[];
    dietary_restrictions?: string;
    cooking_skill?: string;
    cooking_equipment?: string[];
    daily_targets?: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
    };
    grocery_list?: string[]; // unchecked items, "name (quantity)"
  };
}

interface GeneratedIngredient {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface RecipeGenerateResponse {
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  servings: number;
  equipment: string[];
  ingredients: GeneratedIngredient[];
  instructions: string[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
  model: string;
}

const MAX_PROMPT_LENGTH = 1000;

function buildContextBlock(ctx: RecipeGenerateRequest['context']): string {
  if (!ctx) return '';
  const lines: string[] = [];

  if (ctx.goals?.length) lines.push(`Goals: ${ctx.goals.join(', ')}`);
  if (ctx.primary_goal) lines.push(`Primary goal: ${ctx.primary_goal}`);
  if (ctx.allergies?.length) lines.push(`ALLERGIES (NEVER include): ${ctx.allergies.join(', ')}`);
  if (ctx.dietary_preferences?.length) lines.push(`Dietary preferences: ${ctx.dietary_preferences.join(', ')}`);
  if (ctx.dietary_restrictions) lines.push(`Dietary restrictions: ${ctx.dietary_restrictions}`);
  if (ctx.cooking_skill) lines.push(`Cooking skill: ${ctx.cooking_skill}`);
  if (ctx.cooking_equipment?.length) lines.push(`Available equipment: ${ctx.cooking_equipment.join(', ')}`);
  if (ctx.daily_targets) {
    const t = ctx.daily_targets;
    lines.push(`Daily targets: ${t.calories} cal, ${t.protein_g}g protein, ${t.carbs_g}g carbs, ${t.fat_g}g fat, ${t.fiber_g}g fiber`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(ctx: string, grocery: string[] | undefined): string {
  const groceryBlock =
    grocery && grocery.length > 0
      ? `\n## Grocery List (prefer these ingredients)\n${grocery.join(', ')}\nUse ingredients from this list where possible. You may include a few extra staples (oil, salt, spices) but prioritize what's available.`
      : '';

  return `You are a recipe creation AI for a health and fitness app. Generate a single recipe that is healthy, balanced, and aligned with the user's goals and constraints.

## User Context
${ctx || '(no additional context provided)'}
${groceryBlock}

## Requirements
- The recipe MUST respect all allergies listed above. Never include allergens.
- Match the user's dietary preferences.
- Use only equipment the user has (or no special equipment if none listed).
- Match difficulty to the user's cooking skill.
- Design the recipe to support the user's goals (high protein for muscle gain, lower calorie for weight loss, etc.).
- Each ingredient must have macros estimated for the quantity used.
- All values are estimates.

## Output Format
Return a JSON object in this exact shape:
{
  "name": "Recipe Name",
  "description": "One-sentence description of the dish",
  "difficulty": "Easy" | "Medium" | "Hard",
  "servings": 1,
  "equipment": ["stove", "pan"],
  "ingredients": [
    { "name": "chicken breast", "quantity": 6, "unit": "oz", "calories": 187, "protein_g": 35, "carbs_g": 0, "fat_g": 4, "fiber_g": 0 }
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "totals": { "calories": 450, "protein_g": 42, "carbs_g": 30, "fat_g": 15, "fiber_g": 6 }
}`;
}

function normalizeDifficulty(raw: unknown): 'Easy' | 'Medium' | 'Hard' {
  const lower = String(raw ?? '').toLowerCase();
  if (lower === 'hard') return 'Hard';
  if (lower === 'medium') return 'Medium';
  return 'Easy';
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: RecipeGenerateRequest = await req.json();

    if (!body.prompt || body.prompt.trim().length === 0) {
      return errorResponse('Prompt is required', 400);
    }
    if (body.prompt.length > MAX_PROMPT_LENGTH) {
      return errorResponse(`Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`, 400);
    }

    const contextBlock = buildContextBlock(body.context);
    const systemPrompt = buildSystemPrompt(contextBlock, body.context?.grocery_list);

    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: body.prompt },
      ],
      { json_mode: true, temperature: 0.6, max_tokens: 2000 },
    );

    const parsed = JSON.parse(aiResponse.content ?? '{}');
    if (!parsed.name || !Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      throw new Error('AI response missing required recipe fields');
    }

    const ingredients: GeneratedIngredient[] = parsed.ingredients.map(
      (i: Record<string, unknown>) => ({
        name: String(i.name ?? 'Ingredient'),
        quantity: Number(i.quantity ?? 1),
        unit: String(i.unit ?? 'serving'),
        calories: Number(i.calories ?? 0),
        protein_g: Number(i.protein_g ?? 0),
        carbs_g: Number(i.carbs_g ?? 0),
        fat_g: Number(i.fat_g ?? 0),
        fiber_g: Number(i.fiber_g ?? 0),
      }),
    );

    const totalsRaw: Record<string, unknown> = parsed.totals ?? {};
    const response: RecipeGenerateResponse = {
      name: String(parsed.name),
      description: String(parsed.description ?? ''),
      difficulty: normalizeDifficulty(parsed.difficulty),
      servings: Number(parsed.servings ?? 1),
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment.map(String) : [],
      ingredients,
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions.map(String) : [],
      totals: {
        calories: Number(totalsRaw.calories ?? 0),
        protein_g: Number(totalsRaw.protein_g ?? 0),
        carbs_g: Number(totalsRaw.carbs_g ?? 0),
        fat_g: Number(totalsRaw.fat_g ?? 0),
        fiber_g: Number(totalsRaw.fiber_g ?? 0),
      },
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
      context: 'nutrition',
      created_at: new Date().toISOString(),
    });

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Recipe generate error:', error);
    return errorResponse('Failed to generate recipe. Please try again.', 500);
  }
});
