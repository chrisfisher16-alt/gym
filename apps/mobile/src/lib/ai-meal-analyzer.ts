import { readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getAIConfig, getProviderDefaults } from './ai-provider';
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

const CLAUDE_WEB_PROXY_URL = 'http://localhost:3001/api/anthropic';

function getClaudeUrl(configBaseUrl: string, defaultBaseUrl: string): string {
  if (Platform.OS === 'web') {
    return CLAUDE_WEB_PROXY_URL;
  }
  return configBaseUrl || defaultBaseUrl;
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
    const defaults = getProviderDefaults('claude');
    const baseUrl = getClaudeUrl(config.baseUrl || '', defaults.baseUrl);
    const model = config.model || defaults.model;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: TEXT_ANALYSIS_PROMPT,
        messages: [
          { role: 'user', content: description },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');

    if (!textBlock?.text) {
      throw new Error('No text in AI response');
    }

    return parseAIResponse(textBlock.text);
  } catch (error) {
    console.warn('AI meal text analysis failed, falling back to parser:', error);
    const result = parseMealText(description);
    return result.items;
  }
}

// ── Photo Analysis ──────────────────────────────────────────────────

export async function analyzePhotoMeal(imageUri: string): Promise<MealItemEntry[]> {
  try {
    const base64data = await readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const config = await getAIConfig();
    const defaults = getProviderDefaults('claude');
    const baseUrl = getClaudeUrl(config.baseUrl || '', defaults.baseUrl);
    const model = config.model || defaults.model;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: PHOTO_ANALYSIS_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
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
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');

    if (!textBlock?.text) {
      throw new Error('No text in AI response');
    }

    return parseAIResponse(textBlock.text);
  } catch (error) {
    console.warn('AI photo analysis failed, falling back to mock data:', error);
    return generateMockPhotoItems();
  }
}
