import { readAsStringAsync } from 'expo-file-system/legacy';
import { getAIConfig, callAI, type AIMessage, type AIContentBlock } from './ai-provider';
import { parseMealText } from './meal-parser';
import { generateNutritionId } from './nutrition-utils';
import type { MealItemEntry } from '../types/nutrition';

// ── System Prompts ──────────────────────────────────────────────────

const TEXT_ANALYSIS_PROMPT =
  'You are a nutrition analysis AI. Analyze the described meal and return a JSON array of food items with estimated nutritional values. Each item must have: name, calories, protein_g, carbs_g, fat_g, fiber_g, quantity, unit. Be as accurate as possible with calorie and macro estimates based on standard serving sizes. Return ONLY valid JSON array, no other text.';

const PHOTO_ANALYSIS_PROMPT =
  'You are a nutrition analysis AI with vision capabilities. Look at this photo of food/meal and identify each food item visible. Estimate the portion sizes and nutritional values. Return a JSON array where each item has: name, calories, protein_g, carbs_g, fat_g, fiber_g, quantity, unit. Be specific about what you see. Return ONLY valid JSON array, no other text.';

// ── Helpers ─────────────────────────────────────────────────────────

interface RawAIItem {
  name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  quantity?: number;
  unit?: string;
}

function parseAIResponse(text: string): MealItemEntry[] {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed: RawAIItem[] = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI response is not a valid array');
  }

  return parsed.map((item) => ({
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

// ── Mock Photo Items (fallback) ─────────────────────────────────────

function generateMockPhotoItems(): MealItemEntry[] {
  return [
    { id: generateNutritionId('mi'), name: 'Grilled Chicken', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'White Rice', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'Mixed Vegetables', calories: 45, protein_g: 2, carbs_g: 8, fat_g: 0.5, fiber_g: 3, quantity: 1, unit: 'cup', is_estimate: true },
  ];
}

// ── Text Analysis ───────────────────────────────────────────────────

export async function analyzeMealText(description: string): Promise<MealItemEntry[]> {
  try {
    const config = await getAIConfig();

    if (config.provider === 'demo') {
      const result = parseMealText(description);
      return result.items;
    }

    const messages: AIMessage[] = [
      { role: 'system', content: TEXT_ANALYSIS_PROMPT },
      { role: 'user', content: description },
    ];

    const response = await callAI(messages, config);
    return parseAIResponse(response.content);
  } catch (error) {
    console.warn('AI meal text analysis failed, falling back to parser:', error);
    const result = parseMealText(description);
    return result.items;
  }
}

// ── Photo Analysis ──────────────────────────────────────────────────

export interface PhotoAnalysisResult {
  items: MealItemEntry[];
  isPreview: boolean;
}

export async function analyzePhotoMeal(imageUri: string): Promise<PhotoAnalysisResult> {
  try {
    const base64data = await readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const config = await getAIConfig();

    if (config.provider === 'demo') {
      return { items: generateMockPhotoItems(), isPreview: true };
    }

    const imageContent: AIContentBlock[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64data,
        },
      },
      {
        type: 'text',
        text: 'Analyze this meal photo and identify all food items with their nutritional estimates.',
      },
    ];

    const messages: AIMessage[] = [
      { role: 'system', content: PHOTO_ANALYSIS_PROMPT },
      { role: 'user', content: imageContent },
    ];

    const response = await callAI(messages, config);
    return { items: parseAIResponse(response.content), isPreview: false };
  } catch (error) {
    console.error('AI photo analysis failed:', error);
    throw new Error('Failed to analyze photo. Please try again or enter items manually.');
  }
}
