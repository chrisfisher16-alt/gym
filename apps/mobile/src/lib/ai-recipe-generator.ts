// ── AI Recipe Generator ─────────────────────────────────────────────
// Generates recipes via the AI provider, respecting the user's goals,
// allergies, dietary preferences, cooking skill, and available equipment.

import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { useProfileStore } from '../stores/profile-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useGroceryStore } from '../stores/grocery-store';
import type { RecipeEntry, RecipeDifficulty } from '../types/nutrition';
import { generateNutritionId } from './nutrition-utils';

// ── Types ───────────────────────────────────────────────────────────

export interface GenerateRecipeOptions {
  /** Free-form user prompt, e.g. "a high-protein lunch" */
  prompt: string;
  /** Whether to incorporate the user's current grocery list */
  useGroceryList?: boolean;
}

export interface GenerateRecipeResult {
  recipe: Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
  model: string;
}

// ── Raw AI response shape ───────────────────────────────────────────

interface AIRecipeResponse {
  name: string;
  description: string;
  difficulty: string;
  servings: number;
  equipment: string[];
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  }>;
  instructions: string[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

// ── Context builders ────────────────────────────────────────────────

function buildUserContext(): string {
  const profile = useProfileStore.getState().profile;
  const targets = useNutritionStore.getState().targets;
  const lines: string[] = [];

  // Goals
  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight', gain_muscle: 'Gain Muscle',
    build_lean_muscle: 'Build Lean Muscle', improve_endurance: 'Improve Endurance',
    maintain_weight: 'Maintain Weight', improve_general_health: 'Improve General Health',
  };
  if (profile.healthGoals?.length) {
    lines.push(`Goals: ${profile.healthGoals.map((g) => goalLabels[g] ?? g).join(', ')}`);
  }
  if (profile.primaryGoal) {
    lines.push(`Primary goal: ${profile.primaryGoal}`);
  }

  // Allergies (safety-critical)
  if (profile.allergies?.length) {
    lines.push(`ALLERGIES (NEVER include): ${profile.allergies.join(', ')}`);
  }

  // Dietary preferences
  if (profile.dietaryPreferences?.length) {
    lines.push(`Dietary preferences: ${profile.dietaryPreferences.join(', ')}`);
  }
  if (profile.dietaryRestrictions) {
    lines.push(`Dietary restrictions: ${profile.dietaryRestrictions}`);
  }

  // Cooking constraints
  if (profile.cookingSkillLevel) {
    lines.push(`Cooking skill: ${profile.cookingSkillLevel}`);
  }
  if (profile.cookingEquipment?.length) {
    lines.push(`Available equipment: ${profile.cookingEquipment.join(', ')}`);
  }

  // Macro targets
  lines.push(`Daily targets: ${targets.calories} cal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat, ${targets.fiber_g}g fiber`);

  return lines.join('\n');
}

function buildGroceryContext(): string {
  const { currentList } = useGroceryStore.getState();
  if (!currentList) return '';

  const sections: string[] = [];
  for (const cat of currentList.categories) {
    const unchecked = cat.items.filter((item) => !item.checked);
    if (unchecked.length > 0) {
      sections.push(`${cat.name}: ${unchecked.map((i) => `${i.name} (${i.quantity})`).join(', ')}`);
    }
  }

  if (sections.length === 0) return '';
  return `Available groceries:\n${sections.join('\n')}`;
}

// ── System prompt ───────────────────────────────────────────────────

function buildRecipeSystemPrompt(options: GenerateRecipeOptions): string {
  const userCtx = buildUserContext();
  const groceryCtx = options.useGroceryList ? buildGroceryContext() : '';

  return `You are a recipe creation AI for a health and fitness app. Generate a single recipe that is healthy, balanced, and aligned with the user's goals and constraints.

## User Context
${userCtx}
${groceryCtx ? `\n## Grocery List (prefer these ingredients)\n${groceryCtx}\nUse ingredients from this list where possible. You may include a few extra staples (oil, salt, spices) but prioritize what's available.` : ''}

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
}

// ── Generator ───────────────────────────────────────────────────────

export async function generateRecipe(
  options: GenerateRecipeOptions,
): Promise<GenerateRecipeResult> {
  const config = await getAIConfig();

  if (config.provider === 'demo') {
    return { recipe: getDemoRecipe(options.prompt), model: 'Demo Mode' };
  }

  const systemPrompt = buildRecipeSystemPrompt(options);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: options.prompt },
  ];

  const response = await callAI(messages, config);
  const parsed = parseAIRecipeResponse(response.content);

  return { recipe: parsed, model: response.model };
}

// ── Response parsing ────────────────────────────────────────────────

function parseAIRecipeResponse(
  raw: string,
): Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const data: AIRecipeResponse = JSON.parse(cleaned);

  // Validate required fields
  if (!data.name || !data.ingredients || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    throw new Error('AI response missing required recipe fields');
  }

  const difficulty = normalizeDifficulty(data.difficulty);

  return {
    name: data.name,
    description: data.description ?? '',
    servings: data.servings ?? 1,
    source: 'ai',
    difficulty,
    equipment: data.equipment ?? [],
    ingredientsList: data.ingredients.map((i) => `${i.quantity} ${i.unit} ${i.name}`),
    instructions: data.instructions ?? [],
    calories: data.totals?.calories ?? 0,
    protein_g: data.totals?.protein_g ?? 0,
    carbs_g: data.totals?.carbs_g ?? 0,
    fat_g: data.totals?.fat_g ?? 0,
    fiber_g: data.totals?.fiber_g ?? 0,
    items: data.ingredients.map((ing, idx) => ({
      id: generateNutritionId('ri'),
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
  };
}

function normalizeDifficulty(raw: string | undefined): RecipeDifficulty {
  if (!raw) return 'Easy';
  const lower = raw.toLowerCase();
  if (lower === 'hard') return 'Hard';
  if (lower === 'medium') return 'Medium';
  return 'Easy';
}

// ── Demo fallback ───────────────────────────────────────────────────

function getDemoRecipe(
  _prompt: string,
): Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Grilled Chicken & Veggie Bowl',
    description: 'A balanced, high-protein bowl with grilled chicken, roasted vegetables, and quinoa.',
    servings: 1,
    source: 'ai',
    difficulty: 'Easy',
    equipment: ['stove', 'oven'],
    ingredientsList: ['6 oz chicken breast', '1 cup quinoa (cooked)', '1 cup mixed vegetables', '1 tbsp olive oil', 'salt and pepper'],
    instructions: [
      'Preheat oven to 400°F.',
      'Season chicken with salt, pepper, and olive oil.',
      'Roast vegetables for 20 minutes.',
      'Grill or bake chicken for 20–25 minutes.',
      'Serve chicken sliced over quinoa and vegetables.',
    ],
    calories: 480,
    protein_g: 42,
    carbs_g: 38,
    fat_g: 14,
    fiber_g: 6,
    items: [
      { id: 'demo_ri_1', name: 'chicken breast', calories: 187, protein_g: 35, carbs_g: 0, fat_g: 4, fiber_g: 0, quantity: 6, unit: 'oz', is_estimate: true },
      { id: 'demo_ri_2', name: 'quinoa (cooked)', calories: 120, protein_g: 4, carbs_g: 21, fat_g: 2, fiber_g: 3, quantity: 1, unit: 'cup', is_estimate: true },
      { id: 'demo_ri_3', name: 'mixed vegetables', calories: 50, protein_g: 2, carbs_g: 10, fat_g: 0, fiber_g: 3, quantity: 1, unit: 'cup', is_estimate: true },
      { id: 'demo_ri_4', name: 'olive oil', calories: 120, protein_g: 0, carbs_g: 0, fat_g: 14, fiber_g: 0, quantity: 1, unit: 'tbsp', is_estimate: true },
    ],
  };
}
