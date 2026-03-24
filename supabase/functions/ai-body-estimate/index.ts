// ── AI Body Estimate Edge Function ──────────────────────────────────
// Estimates body measurements from height, weight, gender, and waist.
// Uses deterministic anthropometric regression — no AI call needed.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';

// ── Types ────────────────────────────────────────────────────────────

interface BodyEstimateRequest {
  heightCm: number;
  weightKg: number;
  gender?: string;
  waistCm: number;
}

interface BodyEstimateResponse {
  chestCm: number;
  hipsCm: number;
  leftArmCm: number;
  rightArmCm: number;
  leftThighCm: number;
  rightThighCm: number;
}

// ── Rate Limiting (in-memory) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
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

// ── Deterministic Body Measurement Estimation ───────────────────────

function estimateBodyMeasurements(
  heightCm: number,
  weightKg: number,
  waistCm: number,
  gender: string | undefined,
): BodyEstimateResponse {
  const isFemale = gender?.toLowerCase() === 'female';
  const bmi = weightKg / ((heightCm / 100) ** 2);

  // Anthropometric estimation using BMI-correlated proportions
  // Based on NHANES reference data and military anthropometric surveys

  let chestCm: number;
  let hipsCm: number;
  let armCm: number;
  let thighCm: number;

  if (isFemale) {
    // Female proportions
    chestCm = waistCm * 1.08 + bmi * 0.3 - 2;
    hipsCm = waistCm * 1.15 + bmi * 0.25 + 2;
    armCm = 16 + bmi * 0.55 + (heightCm - 165) * 0.06;
    thighCm = 35 + bmi * 0.75 + (heightCm - 165) * 0.12;
  } else {
    // Male proportions
    chestCm = waistCm * 1.12 + bmi * 0.35;
    hipsCm = waistCm * 0.98 + bmi * 0.2 + 4;
    armCm = 20 + bmi * 0.6 + (heightCm - 175) * 0.07;
    thighCm = 38 + bmi * 0.7 + (heightCm - 175) * 0.1;
  }

  // Clamp to realistic ranges
  chestCm = Math.max(70, Math.min(150, chestCm));
  hipsCm = Math.max(70, Math.min(150, hipsCm));
  armCm = Math.max(18, Math.min(55, armCm));
  thighCm = Math.max(35, Math.min(85, thighCm));

  // Dominant arm slightly larger
  const rightArmCm = Math.round((armCm + 0.5) * 10) / 10;
  const leftArmCm = Math.round(armCm * 10) / 10;
  const rightThighCm = Math.round((thighCm + 0.3) * 10) / 10;
  const leftThighCm = Math.round(thighCm * 10) / 10;

  return {
    chestCm: Math.round(chestCm * 10) / 10,
    hipsCm: Math.round(hipsCm * 10) / 10,
    leftArmCm,
    rightArmCm,
    leftThighCm,
    rightThighCm,
  };
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);

    // Rate limit
    if (!checkRateLimit(user_id)) {
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    const body: BodyEstimateRequest = await req.json();
    const { heightCm, weightKg, gender, waistCm } = body;

    // Input validation
    if (!heightCm || heightCm < 50 || heightCm > 300) {
      return errorResponse('Invalid height (must be 50-300 cm)', 400);
    }
    if (!weightKg || weightKg < 20 || weightKg > 500) {
      return errorResponse('Invalid weight (must be 20-500 kg)', 400);
    }
    if (!waistCm || waistCm < 30 || waistCm > 250) {
      return errorResponse('Invalid waist measurement (must be 30-250 cm)', 400);
    }

    const result = estimateBodyMeasurements(heightCm, weightKg, waistCm, gender);

    // Log usage
    const latencyMs = Date.now() - startTime;
    await supabase.from('ai_usage_events').insert({
      user_id,
      model: 'deterministic',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: latencyMs,
      status: 'success',
      tool_calls_count: 0,
      context: 'progress',
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cache_hit: false,
      created_at: new Date().toISOString(),
    });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Body estimate error:', error);
    return errorResponse('Failed to estimate body measurements. Please try again.', 500);
  }
});
