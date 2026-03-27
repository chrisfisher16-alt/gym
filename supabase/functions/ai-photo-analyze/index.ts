// ── AI Photo Analyze Edge Function ──────────────────────────────────
// Dedicated photo analysis endpoint for food items.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import type { PhotoAnalyzeRequest, PhotoAnalyzeResponse } from '../_shared/types.ts';

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    await verifyAuth(req);
    const body: PhotoAnalyzeRequest = await req.json();
    const { image_base64, image_url } = body;

    if (!image_base64 && !image_url) {
      return errorResponse('No image provided (need image_base64 or image_url)', 400);
    }

    // Server-side photo analysis is not yet implemented.
    // The mobile app uses client-side AI vision (see ai-meal-analyzer.ts) instead.
    const response: PhotoAnalyzeResponse = {
      items: [],
      analysis_method: 'not_implemented',
      description:
        'Server-side photo analysis is not yet available. The mobile app uses client-side AI vision instead.',
    };

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Photo analyze error:', error);
    return errorResponse('Failed to analyze photo. Please try again.', 500);
  }
});

