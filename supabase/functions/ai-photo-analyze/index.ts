// ── AI Photo Analyze Edge Function ──────────────────────────────────
// Dedicated photo analysis endpoint for food items.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import type { PhotoAnalyzeRequest, PhotoAnalyzeResponse, ParsedMealItem } from '../_shared/types.ts';

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: PhotoAnalyzeRequest = await req.json();
    const { image_base64, image_url } = body;

    if (!image_base64 && !image_url) {
      return errorResponse('No image provided (need image_base64 or image_url)', 400);
    }

    // Placeholder implementation — real vision API integration would go here.
    // For now, return reasonable estimates with clear labeling.
    const response: PhotoAnalyzeResponse = {
      items: getPlaceholderEstimates(),
      analysis_method: 'placeholder',
      description:
        'Photo analysis is currently in preview mode. The items below are placeholder estimates. Please review and adjust quantities and macros to match your actual meal.',
    };

    // Log usage event
    await supabase.from('ai_usage_events').insert({
      user_id,
      model: 'photo_placeholder',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: 0,
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
    console.error('Photo analyze error:', error);
    return errorResponse('Failed to analyze photo. Please try again.', 500);
  }
});

// ── Placeholder Estimates ───────────────────────────────────────────

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
