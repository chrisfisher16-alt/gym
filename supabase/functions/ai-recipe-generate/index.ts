// ── AI Recipe Generate Edge Function ─────────────────────────────────
// Generates recipes based on user context, goals, and preferences.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';
import { validateOutput } from '../_shared/safety.ts';
import type { CacheableSystemBlock } from '../_shared/types.ts';

// ── Types ────────────────────────────────────────────────────────────

interface RecipeGenerateRequest {
  prompt: string;
  userContext?: {
    goals?: string[];
    primaryGoal?: string;
    allergies?: string[];
    dietaryPreferences?: string[];
    dietaryRestrictions?: string;
    cookingSkillLevel?: string;
    cookingEquipment?: string[];
    dailyTargets?: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
    };
  };
  groceryList?: string;
}

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface RecipeResponse {
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  servings: number;
  equipment: string[];
  ingredientsList: string[];
  instructions: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  items: Array<{
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    quantity: number;
    unit: string;
    is_estimate: boolean;
  }>;
  source: 'ai';
  model: string;
}

// ── Rate Limiting (in-memory) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── ID Generation ───────────────────────────────────────────────────

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ── System Prompt Builder ───────────────────────────────────────────

// Static instructions block — identical for every request (cacheable)
const RECIPE_STATIC_INSTRUCTIONS = `You are a recipe creation AI for a health and fitness app. Generate a single recipe that is healthy, balanced, and aligned with the user's goals and constraints.

## Requirements
- The recipe MUST respect all allergies listed above. Never include allergens.
- The recipe must match the user's dietary preferences.
- Use only equipment the user has (or no special equipment if none listed).
- Match the recipe difficulty to the user's cooking skill level.
- Design the recipe to support the user's health/fitness goals (e.g. high protein for muscle gain, lower calorie for weight loss).
- Be realistic with macro estimates — label them as estimates.
- Each ingredient must have macros estimated per the quantity used in the recipe.

## Output Format
Respond with ONLY a valid JSON object (no markdown fences, no extra text) in this exact shape:
{
  "name": "Recipe Name",
  "description": "One-sentence description of the dish",
  "difficulty": "Easy" | "Medium" | "Hard",
  "servings": 1,
  "equipment": ["stove", "pan"],
  "ingredients": [
    {
      "name": "chicken breast",
      "quantity": 6,
      "unit": "oz",
      "calories": 187,
      "protein_g": 35,
      "carbs_g": 0,
      "fat_g": 4,
      "fiber_g": 0
    }
  ],
  "instructions": [
    "Season chicken breast with salt, pepper, and paprika.",
    "Heat pan over medium-high heat with olive oil.",
    "Cook chicken 5–6 minutes per side until internal temp reaches 165°F.",
    "Rest 5 minutes, slice, and serve."
  ],
  "totals": {
    "calories": 450,
    "protein_g": 42,
    "carbs_g": 30,
    "fat_g": 15,
    "fiber_g": 6
  }
}`;

// Dynamic user context block — varies per request
function buildDynamicContext(req: RecipeGenerateRequest): string {
  const ctx = req.userContext;
  const lines: string[] = [];

  if (ctx) {
    const goalLabels: Record<string, string> = {
      lose_weight: 'Lose Weight', gain_muscle: 'Gain Muscle',
      build_lean_muscle: 'Build Lean Muscle', improve_endurance: 'Improve Endurance',
      maintain_weight: 'Maintain Weight', improve_general_health: 'Improve General Health',
    };

    if (ctx.goals?.length) {
      lines.push(`Goals: ${ctx.goals.map((g) => goalLabels[g] ?? g).join(', ')}`);
    }
    if (ctx.primaryGoal) {
      lines.push(`Primary goal: ${ctx.primaryGoal}`);
    }
    if (ctx.allergies?.length) {
      lines.push(`ALLERGIES (NEVER include): ${ctx.allergies.join(', ')}`);
    }
    if (ctx.dietaryPreferences?.length) {
      lines.push(`Dietary preferences: ${ctx.dietaryPreferences.join(', ')}`);
    }
    if (ctx.dietaryRestrictions) {
      lines.push(`Dietary restrictions: ${ctx.dietaryRestrictions}`);
    }
    if (ctx.cookingSkillLevel) {
      lines.push(`Cooking skill: ${ctx.cookingSkillLevel}`);
    }
    if (ctx.cookingEquipment?.length) {
      lines.push(`Available equipment: ${ctx.cookingEquipment.join(', ')}`);
    }
    if (ctx.dailyTargets) {
      const t = ctx.dailyTargets;
      lines.push(`Daily targets: ${t.calories} cal, ${t.protein_g}g protein, ${t.carbs_g}g carbs, ${t.fat_g}g fat, ${t.fiber_g}g fiber`);
    }
  }

  const grocerySection = req.groceryList
    ? `\n## Grocery List (prefer these ingredients)\n${req.groceryList}\nUse ingredients from this list where possible. You may include a few extra staples (oil, salt, spices) but prioritize what's available.`
    : '';

  return `## User Context\n${lines.join('\n')}${grocerySection}`;
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);

    // Rate limit
    if (!checkRateLimit(user_id)) {
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    const body: RecipeGenerateRequest = await req.json();
    const { prompt } = body;

    if (!prompt || prompt.trim().length === 0) {
      return errorResponse('No prompt provided', 400);
    }
    if (prompt.length > 2000) {
      return errorResponse('Prompt too long (max 2000 characters)', 400);
    }

    const dynamicContext = buildDynamicContext(body);
    const aiProvider = createAIProvider();

    const cachedSystemBlocks: CacheableSystemBlock[] = [
      { text: RECIPE_STATIC_INSTRUCTIONS, cacheControl: true },
      { text: dynamicContext },
    ];

    const aiResponse = await aiProvider.chat(
      [
        { role: 'system', content: RECIPE_STATIC_INSTRUCTIONS + '\n\n' + dynamicContext },
        { role: 'user', content: prompt },
      ],
      {
        json_mode: true,
        temperature: 0.8,
        max_tokens: 3000,
        cacheOptions: { cachedSystemBlocks },
      },
    );

    // Parse AI response
    let cleaned = (aiResponse.content ?? '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let data;
    try {
      data = JSON.parse(cleaned);
    } catch {
      return errorResponse('Failed to parse AI recipe response. Please try again.', 502);
    }

    if (!data.name || !data.ingredients || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
      throw new Error('AI response missing required recipe fields');
    }

    // Safety check: validate AI-generated instructions for medical/dangerous content
    const instructionText = (data.instructions ?? []).join(' ');
    const safetyCheck = validateOutput(instructionText);
    if (!safetyCheck.safe) {
      console.warn(`[ai-recipe-generate] Safety flagged: ${safetyCheck.reason}`);
      // Remove unsafe instructions but don't block the entire recipe
      data.instructions = data.instructions.filter((inst: string) => validateOutput(inst).safe);
    }

    const difficulty = normalizeDifficulty(data.difficulty);

    const result: RecipeResponse = {
      name: data.name,
      description: data.description ?? '',
      servings: data.servings ?? 1,
      source: 'ai',
      difficulty,
      equipment: data.equipment ?? [],
      ingredientsList: data.ingredients.map((i: RecipeIngredient) => `${i.quantity} ${i.unit} ${i.name}`),
      instructions: data.instructions ?? [],
      calories: data.totals?.calories ?? 0,
      protein_g: data.totals?.protein_g ?? 0,
      carbs_g: data.totals?.carbs_g ?? 0,
      fat_g: data.totals?.fat_g ?? 0,
      fiber_g: data.totals?.fiber_g ?? 0,
      items: data.ingredients.map((ing: RecipeIngredient) => ({
        id: generateId('ri'),
        name: ing.name,
        calories: ing.calories ?? 0,
        protein_g: ing.protein_g ?? 0,
        carbs_g: ing.carbs_g ?? 0,
        fat_g: ing.fat_g ?? 0,
        fiber_g: ing.fiber_g ?? 0,
        quantity: ing.quantity ?? 1,
        unit: ing.unit ?? 'serving',
        is_estimate: true,
      })),
      model: aiResponse.model,
    };

    // Log usage
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
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cache_hit: false,
      created_at: new Date().toISOString(),
    });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Recipe generate error:', error);
    return errorResponse('Failed to generate recipe. Please try again.', 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeDifficulty(raw: string | undefined): 'Easy' | 'Medium' | 'Hard' {
  if (!raw) return 'Easy';
  const lower = raw.toLowerCase();
  if (lower === 'hard') return 'Hard';
  if (lower === 'medium') return 'Medium';
  return 'Easy';
}
