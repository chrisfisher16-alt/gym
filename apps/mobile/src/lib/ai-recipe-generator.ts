// ── AI Recipe Generator ─────────────────────────────────────────────
// Calls the `ai-recipe-generate` Supabase Edge Function. Profile context
// (allergies, dietary prefs, cooking skills, targets, grocery list) is
// passed in the body since it lives client-side. Falls back to a demo
// recipe when unauthenticated.

import { supabase, isSupabaseConfigured } from './supabase';
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

interface EdgeRecipeResponse {
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
  model: string;
}

// ── Context gathering ───────────────────────────────────────────────

function gatherRequestContext(useGroceryList: boolean): Record<string, unknown> {
  const profile = useProfileStore.getState().profile;
  const targets = useNutritionStore.getState().targets;

  const context: Record<string, unknown> = {
    goals: profile.healthGoals,
    primary_goal: profile.primaryGoal,
    allergies: profile.allergies,
    dietary_preferences: profile.dietaryPreferences,
    dietary_restrictions: profile.dietaryRestrictions,
    cooking_skill: profile.cookingSkillLevel,
    cooking_equipment: profile.cookingEquipment,
    daily_targets: {
      calories: targets.calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      fiber_g: targets.fiber_g,
    },
  };

  if (useGroceryList) {
    const { currentList } = useGroceryStore.getState();
    if (currentList) {
      const items: string[] = [];
      for (const cat of currentList.categories) {
        for (const item of cat.items) {
          if (!item.checked) items.push(`${item.name} (${item.quantity})`);
        }
      }
      if (items.length > 0) {
        context.grocery_list = items;
      }
    }
  }

  return context;
}

// ── Generator ───────────────────────────────────────────────────────

export async function generateRecipe(
  options: GenerateRecipeOptions,
): Promise<GenerateRecipeResult> {
  if (!isSupabaseConfigured) {
    return { recipe: getDemoRecipe(), model: 'Demo Mode' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { recipe: getDemoRecipe(), model: 'Demo Mode' };
  }

  const context = gatherRequestContext(!!options.useGroceryList);

  const { data, error } = await supabase.functions.invoke<EdgeRecipeResponse>(
    'ai-recipe-generate',
    {
      body: {
        prompt: options.prompt,
        context,
      },
    },
  );

  if (error) throw error;
  if (!data) throw new Error('Recipe generator returned no data');

  const difficulty = normalizeDifficulty(data.difficulty);

  const recipe: Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
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
    items: data.ingredients.map((ing) => ({
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

  return { recipe, model: data.model };
}

function normalizeDifficulty(raw: string | undefined): RecipeDifficulty {
  if (!raw) return 'Easy';
  const lower = raw.toLowerCase();
  if (lower === 'hard') return 'Hard';
  if (lower === 'medium') return 'Medium';
  return 'Easy';
}

// ── Demo fallback ───────────────────────────────────────────────────

function getDemoRecipe(): Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
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
