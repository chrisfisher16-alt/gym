import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase, isSupabaseConfigured } from './supabase';
import { parseMealText } from './meal-parser';
import { generateNutritionId } from './nutrition-utils';
import type { MealItemEntry } from '../types/nutrition';

// ── Edge Function response shape (matches supabase/functions/_shared/types.ts) ─

interface EdgeParsedItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity: number;
  unit: string;
  is_estimate: boolean;
  confidence?: number;
}

interface EdgeItemsResponse {
  items?: EdgeParsedItem[];
}

function toMealItems(items: EdgeParsedItem[]): MealItemEntry[] {
  return items.map((item) => ({
    id: generateNutritionId('mi'),
    name: item.name ?? 'Unknown Item',
    calories: Math.round(item.calories ?? 0),
    protein_g: Math.round((item.protein_g ?? 0) * 10) / 10,
    carbs_g: Math.round((item.carbs_g ?? 0) * 10) / 10,
    fat_g: Math.round((item.fat_g ?? 0) * 10) / 10,
    fiber_g: Math.round((item.fiber_g ?? 0) * 10) / 10,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? 'serving',
    is_estimate: true,
  }));
}

// ── Mock Photo Items (fallback when backend unavailable) ───────────

function generateMockPhotoItems(): MealItemEntry[] {
  return [
    { id: generateNutritionId('mi'), name: 'Grilled Chicken', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'White Rice', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'Mixed Vegetables', calories: 45, protein_g: 2, carbs_g: 8, fat_g: 0.5, fiber_g: 3, quantity: 1, unit: 'cup', is_estimate: true },
  ];
}

// ── Text Analysis (via Supabase Edge Function) ──────────────────────

export async function analyzeMealText(description: string): Promise<MealItemEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke<EdgeItemsResponse>('ai-meal-parse', {
        body: { text: description },
      });
      if (error) throw error;
      if (data?.items && data.items.length > 0) {
        return toMealItems(data.items);
      }
    } catch (error) {
      console.warn('ai-meal-parse edge function failed, falling back to local parser:', error);
    }
  }
  const result = parseMealText(description);
  return result.items;
}

// ── Photo Analysis (via Supabase Edge Function) ─────────────────────

export async function analyzePhotoMeal(imageUri: string): Promise<MealItemEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const image_base64 = await readAsStringAsync(imageUri, { encoding: 'base64' });
      const { data, error } = await supabase.functions.invoke<EdgeItemsResponse>('ai-photo-analyze', {
        body: { image_base64 },
      });
      if (error) throw error;
      if (data?.items && data.items.length > 0) {
        return toMealItems(data.items);
      }
    } catch (error) {
      console.warn('ai-photo-analyze edge function failed, falling back to mock items:', error);
    }
  }
  return generateMockPhotoItems();
}
