import type { MealItemEntry } from '../types/nutrition';
import { FOOD_DATABASE, searchFoods } from './food-database';
import { generateNutritionId } from './nutrition-utils';

// ── Meal Parser ────────────────────────────────────────────────────
// Simple keyword-based parser for natural language meal descriptions.
// Splits text into items, matches against food database, estimates macros.
// Will be replaced by AI parsing in Phase 4.

interface ParsedMealResult {
  items: MealItemEntry[];
  unparsedTexts: string[];
}

// Quantity patterns: "2 eggs", "a cup of rice", "3 slices of bread"
const QUANTITY_PATTERN = /^(\d+(?:\.\d+)?)\s*/;
const ARTICLE_PATTERN = /^(?:a|an|one|some|few)\s+/i;
const QUANTITY_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
  couple: 2,
};

function extractQuantity(text: string): { quantity: number; remainder: string } {
  const trimmed = text.trim();

  // Try numeric pattern: "2 eggs"
  const numMatch = trimmed.match(QUANTITY_PATTERN);
  if (numMatch) {
    return {
      quantity: parseFloat(numMatch[1]),
      remainder: trimmed.substring(numMatch[0].length).trim(),
    };
  }

  // Try word-based quantity: "two eggs", "a cup"
  for (const [word, qty] of Object.entries(QUANTITY_WORDS)) {
    const pattern = new RegExp(`^${word}\\s+`, 'i');
    if (pattern.test(trimmed)) {
      return {
        quantity: qty,
        remainder: trimmed.replace(pattern, '').trim(),
      };
    }
  }

  // Default: 1 serving
  // Remove leading articles
  const noArticle = trimmed.replace(ARTICLE_PATTERN, '');
  return { quantity: 1, remainder: noArticle };
}

function cleanItemText(text: string): string {
  return text
    .replace(/\bof\b/gi, '')
    .replace(/\bwith\b/gi, '')
    .replace(/\bsome\b/gi, '')
    .replace(/\bfresh\b/gi, '')
    .replace(/\blarge\b/gi, '')
    .replace(/\bsmall\b/gi, '')
    .replace(/\bmedium\b/gi, '')
    .replace(/\bcup(?:s)?\b/gi, '')
    .replace(/\bpiece(?:s)?\b/gi, '')
    .replace(/\bserving(?:s)?\b/gi, '')
    .replace(/\bslice(?:s)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchFood(text: string): MealItemEntry | null {
  const cleaned = cleanItemText(text);
  if (!cleaned) return null;

  const matches = searchFoods(cleaned);
  if (matches.length === 0) return null;

  const food = matches[0];
  return {
    id: generateNutritionId('mi'),
    name: food.name,
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    fiber_g: food.fiber_g,
    quantity: 1,
    unit: food.servingUnit,
    is_estimate: true,
  };
}

function createUnknownItem(text: string): MealItemEntry {
  // Fallback: create a generic item with rough estimate
  const name = text.trim().substring(0, 50);
  return {
    id: generateNutritionId('mi'),
    name: name.charAt(0).toUpperCase() + name.slice(1),
    calories: 150,
    protein_g: 5,
    carbs_g: 15,
    fat_g: 7,
    fiber_g: 1,
    quantity: 1,
    unit: 'serving',
    is_estimate: true,
  };
}

export function parseMealText(text: string): ParsedMealResult {
  const items: MealItemEntry[] = [];
  const unparsedTexts: string[] = [];

  // Split by commas, "and", newlines
  const segments = text
    .split(/[,\n]+/)
    .flatMap((s) => s.split(/\band\b/i))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const segment of segments) {
    const { quantity, remainder } = extractQuantity(segment);

    const matched = matchFood(remainder);
    if (matched) {
      // Scale macros by quantity
      items.push({
        ...matched,
        quantity,
        calories: Math.round(matched.calories * quantity),
        protein_g: Math.round(matched.protein_g * quantity * 10) / 10,
        carbs_g: Math.round(matched.carbs_g * quantity * 10) / 10,
        fat_g: Math.round(matched.fat_g * quantity * 10) / 10,
        fiber_g: Math.round(matched.fiber_g * quantity * 10) / 10,
      });
    } else {
      // Create unknown item
      const unknown = createUnknownItem(remainder || segment);
      items.push({
        ...unknown,
        quantity,
        calories: Math.round(unknown.calories * quantity),
        protein_g: Math.round(unknown.protein_g * quantity * 10) / 10,
        carbs_g: Math.round(unknown.carbs_g * quantity * 10) / 10,
        fat_g: Math.round(unknown.fat_g * quantity * 10) / 10,
        fiber_g: Math.round(unknown.fiber_g * quantity * 10) / 10,
      });
      unparsedTexts.push(segment);
    }
  }

  return { items, unparsedTexts };
}
