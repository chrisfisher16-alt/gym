// ── AI Photo Analyze Edge Function ──────────────────────────────────
// Calls a vision-capable model (OpenAI-compatible chat completions API)
// to identify food items in a meal photo. Falls back to placeholder
// items when the vision model is unavailable.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { estimateCost } from '../_shared/ai-provider.ts';
import type { PhotoAnalyzeRequest, PhotoAnalyzeResponse, ParsedMealItem } from '../_shared/types.ts';

// ── Configuration ───────────────────────────────────────────────────

const VISION_PROMPT = `You are a nutrition analysis AI with vision capabilities. Look at the food photo and identify each distinct item visible. Estimate portion sizes and nutritional values based on what you see.

Return a JSON object with an "items" array. Each item must have:
- name (string): concise name of the food item
- calories (number)
- protein_g (number)
- carbs_g (number)
- fat_g (number)
- fiber_g (number)
- quantity (number): estimated amount
- unit (string): serving unit (e.g. "serving", "cup", "piece", "oz")
- confidence (number 0-1): how confident you are in the identification and macros

Be specific about what you see. If the photo is unclear or doesn't show food, return { "items": [] }. Return ONLY valid JSON.`;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB pre-base64

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: PhotoAnalyzeRequest = await req.json();
    const { image_base64, image_url } = body;

    if (!image_base64 && !image_url) {
      return errorResponse('No image provided (need image_base64 or image_url)', 400);
    }

    if (image_base64 && image_base64.length > MAX_IMAGE_BYTES * 1.4) {
      return errorResponse('Image too large (max ~10MB)', 413);
    }

    const imageDataUrl = image_url ?? `data:image/jpeg;base64,${image_base64}`;

    let response: PhotoAnalyzeResponse;
    let usageEvent: {
      model: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      estimated_cost_usd: number;
      status: 'success' | 'fallback';
    };

    try {
      const visionResult = await callVisionModel(imageDataUrl);
      response = {
        items: visionResult.items,
        analysis_method: 'ai_vision',
        description:
          'Analyzed from photo. All values are estimates — please review and adjust quantities and macros to match your actual meal.',
      };
      usageEvent = {
        model: visionResult.model,
        input_tokens: visionResult.input_tokens,
        output_tokens: visionResult.output_tokens,
        total_tokens: visionResult.input_tokens + visionResult.output_tokens,
        estimated_cost_usd: estimateCost(
          visionResult.model,
          visionResult.input_tokens,
          visionResult.output_tokens,
        ),
        status: 'success',
      };
    } catch (error) {
      console.warn('Vision model failed, returning placeholder items:', error);
      response = {
        items: getPlaceholderEstimates(),
        analysis_method: 'placeholder',
        description:
          'Photo analysis is temporarily unavailable. The items below are placeholder estimates — please review and adjust to match your actual meal.',
      };
      usageEvent = {
        model: 'photo_placeholder',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
        status: 'fallback',
      };
    }

    const latencyMs = Date.now() - startTime;
    await supabase.from('ai_usage_events').insert({
      user_id,
      model: usageEvent.model,
      input_tokens: usageEvent.input_tokens,
      output_tokens: usageEvent.output_tokens,
      total_tokens: usageEvent.total_tokens,
      estimated_cost_usd: usageEvent.estimated_cost_usd,
      latency_ms: latencyMs,
      status: usageEvent.status,
      tool_calls_count: 0,
      context: 'nutrition',
      created_at: new Date().toISOString(),
    });

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Photo analyze error:', error);
    return errorResponse('Failed to analyze photo. Please try again.', 500);
  }
});

// ── Vision Model Call ───────────────────────────────────────────────

interface VisionResult {
  items: ParsedMealItem[];
  model: string;
  input_tokens: number;
  output_tokens: number;
}

async function callVisionModel(imageDataUrl: string): Promise<VisionResult> {
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured');
  }

  const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1';
  const model = Deno.env.get('AI_VISION_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this meal photo and identify all food items with their nutritional estimates.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Vision API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty vision response');
  }

  const parsed = JSON.parse(content);
  const rawItems: Array<Record<string, unknown>> = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.items)
      ? parsed.items
      : [];

  const items: ParsedMealItem[] = rawItems.map((item) => ({
    name: String(item.name ?? 'Unknown item'),
    calories: Number(item.calories ?? 0),
    protein_g: Number(item.protein_g ?? 0),
    carbs_g: Number(item.carbs_g ?? 0),
    fat_g: Number(item.fat_g ?? 0),
    fiber_g: Number(item.fiber_g ?? 0),
    quantity: Number(item.quantity ?? 1),
    unit: String(item.unit ?? 'serving'),
    is_estimate: true,
    confidence: Number(item.confidence ?? 0.6),
  }));

  const usage = data.usage ?? {};
  return {
    items,
    model: data.model ?? model,
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
  };
}

// ── Placeholder Estimates (fallback) ────────────────────────────────

function getPlaceholderEstimates(): ParsedMealItem[] {
  return [
    {
      name: 'Main protein (detected)',
      calories: 250,
      protein_g: 35,
      carbs_g: 2,
      fat_g: 10,
      fiber_g: 0,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
      confidence: 0.4,
    },
    {
      name: 'Carb/grain side (detected)',
      calories: 200,
      protein_g: 5,
      carbs_g: 40,
      fat_g: 2,
      fiber_g: 2,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
      confidence: 0.4,
    },
    {
      name: 'Vegetables (detected)',
      calories: 50,
      protein_g: 3,
      carbs_g: 8,
      fat_g: 1,
      fiber_g: 3,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
      confidence: 0.4,
    },
  ];
}
