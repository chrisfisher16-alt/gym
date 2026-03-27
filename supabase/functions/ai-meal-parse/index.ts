// ── AI Meal Parse Edge Function ──────────────────────────────────────
// Dedicated meal text parsing endpoint with food database first, AI fallback.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';
import { validateOutput } from '../_shared/safety.ts';
import type { MealParseRequest, MealParseResponse, ParsedMealItem } from '../_shared/types.ts';

// ── Rate Limiting (in-memory) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkMealParseRateLimit(key: string): boolean {
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

// ── Common Food Database (primary lookup) ────────────────────────────

const FOOD_DB: Record<string, Omit<ParsedMealItem, 'is_estimate' | 'confidence'>> = {
  'chicken breast': { name: 'Chicken Breast', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving (150g)' },
  'chicken': { name: 'Chicken Breast', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving (150g)' },
  'rice': { name: 'White Rice (cooked)', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup' },
  'white rice': { name: 'White Rice (cooked)', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup' },
  'brown rice': { name: 'Brown Rice (cooked)', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 1.8, fiber_g: 3.5, quantity: 1, unit: 'cup' },
  'eggs': { name: 'Eggs', calories: 144, protein_g: 12, carbs_g: 0.8, fat_g: 10, fiber_g: 0, quantity: 2, unit: 'large' },
  'egg': { name: 'Egg', calories: 72, protein_g: 6, carbs_g: 0.4, fat_g: 5, fiber_g: 0, quantity: 1, unit: 'large' },
  'banana': { name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, quantity: 1, unit: 'medium' },
  'oats': { name: 'Oats (dry)', calories: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.7, fiber_g: 4, quantity: 1, unit: 'serving (40g)' },
  'oatmeal': { name: 'Oatmeal', calories: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.7, fiber_g: 4, quantity: 1, unit: 'serving' },
  'salmon': { name: 'Salmon Fillet', calories: 312, protein_g: 34, carbs_g: 0, fat_g: 18.5, fiber_g: 0, quantity: 1, unit: 'fillet (150g)' },
  'greek yogurt': { name: 'Greek Yogurt (plain)', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, fiber_g: 0, quantity: 1, unit: 'serving (170g)' },
  'protein shake': { name: 'Whey Protein Shake', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0, quantity: 1, unit: 'scoop' },
  'avocado': { name: 'Avocado', calories: 120, protein_g: 1.5, carbs_g: 6, fat_g: 11, fiber_g: 5, quantity: 0.5, unit: 'medium' },
  'bread': { name: 'Bread', calories: 79, protein_g: 2.7, carbs_g: 15, fat_g: 1, fiber_g: 0.6, quantity: 1, unit: 'slice' },
  'peanut butter': { name: 'Peanut Butter', calories: 188, protein_g: 7, carbs_g: 7, fat_g: 16, fiber_g: 1.6, quantity: 2, unit: 'tbsp' },
  'apple': { name: 'Apple', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, quantity: 1, unit: 'medium' },
  'broccoli': { name: 'Broccoli', calories: 31, protein_g: 2.6, carbs_g: 6, fat_g: 0.3, fiber_g: 2.4, quantity: 1, unit: 'cup' },
  'sweet potato': { name: 'Sweet Potato', calories: 129, protein_g: 2.4, carbs_g: 30, fat_g: 0.1, fiber_g: 4.5, quantity: 1, unit: 'medium' },
  'steak': { name: 'Steak (sirloin)', calories: 366, protein_g: 46, carbs_g: 0, fat_g: 19, fiber_g: 0, quantity: 1, unit: 'serving (170g)' },
};

// ── Query Complexity Detection ───────────────────────────────────────

function isSimpleFoodQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Simple if: single food, no complex modifiers
  if (lower.includes(',') || lower.includes(' and ')) return false;
  if (lower.length > 80) return false;
  if (/\d+\s*(g|oz|cup|tbsp|tsp|ml|lb|serving)/i.test(lower)) return false;
  return true;
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);

    // Rate limit
    if (!checkMealParseRateLimit(user_id)) {
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    const body: MealParseRequest = await req.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return errorResponse('No text provided', 400);
    }

    if (text.length > 2000) {
      return errorResponse('Text too long (max 2000 characters)', 400);
    }

    let response: MealParseResponse;

    // Try local database first for simple queries
    const simple = isSimpleFoodQuery(text);
    if (simple) {
      const dbResult = parseMealWithDatabase(text);
      if (dbResult.items.length > 0) {
        // DB had real matches — return without AI call
        return jsonResponse(dbResult);
      }
    }

    // Complex query or no DB matches — use AI
    try {
      const aiProvider = createAIProvider();
      const aiResponse = await aiProvider.chat(
        [
          {
            role: 'system',
            content: `Parse the following meal or food description into structured nutrition data. Return a JSON object with an "items" array.
Each item should have: name (string), calories (number), protein_g (number), carbs_g (number), fat_g (number), fiber_g (number), quantity (number), unit (string), confidence (number 0-1).
Be reasonable with portion sizes. Use standard serving sizes when portions aren't specified. All values are estimates.
Return format: { "items": [...] }`,
          },
          { role: 'user', content: text },
        ],
        { json_mode: true, temperature: 0.3, max_tokens: 1500 },
      );

      const parsed = JSON.parse(aiResponse.content ?? '{"items":[]}');
      const items: ParsedMealItem[] = (Array.isArray(parsed) ? parsed : parsed.items ?? []).map(
        (item: Record<string, unknown>) => ({
          name: item.name as string,
          calories: (item.calories as number) ?? 0,
          protein_g: (item.protein_g as number) ?? 0,
          carbs_g: (item.carbs_g as number) ?? 0,
          fat_g: (item.fat_g as number) ?? 0,
          fiber_g: (item.fiber_g as number) ?? 0,
          quantity: (item.quantity as number) ?? 1,
          unit: (item.unit as string) ?? 'serving',
          is_estimate: true,
          confidence: (item.confidence as number) ?? 0.7,
        }),
      );

      // Safety check: validate AI-generated item names for medical terminology
      const itemNames = items.map((i: ParsedMealItem) => i.name).join(', ');
      const safetyCheck = validateOutput(itemNames);
      if (!safetyCheck.safe) {
        console.warn(`[ai-meal-parse] Safety flagged: ${safetyCheck.reason}`);
      }

      response = { items, raw_text: text, parse_method: 'ai' };

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
    } catch {
      // Fallback to database matching (includes generic fallback)
      response = parseMealWithDatabaseFallback(text);
    }

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Meal parse error:', error);
    return errorResponse('Failed to parse meal. Please try again.', 500);
  }
});

// ── Database Parser (returns real matches only) ─────────────────────

function parseMealWithDatabase(text: string): MealParseResponse {
  const items: ParsedMealItem[] = [];
  const normalizedText = text.toLowerCase();

  for (const [key, food] of Object.entries(FOOD_DB)) {
    if (normalizedText.includes(key)) {
      items.push({
        ...food,
        is_estimate: true,
        confidence: 0.6,
      });
    }
  }

  return { items, raw_text: text, parse_method: 'database_fallback' };
}

// ── Database Fallback Parser (with generic estimate) ────────────────

function parseMealWithDatabaseFallback(text: string): MealParseResponse {
  const result = parseMealWithDatabase(text);
  if (result.items.length > 0) return result;

  // No matches — return a generic estimate
  return {
    items: [{
      name: text.slice(0, 50),
      calories: 300,
      protein_g: 15,
      carbs_g: 30,
      fat_g: 12,
      fiber_g: 3,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
      confidence: 0.3,
    }],
    raw_text: text,
    parse_method: 'database_fallback',
  };
}
