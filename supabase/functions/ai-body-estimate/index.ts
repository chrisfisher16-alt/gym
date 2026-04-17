// ── AI Body Measurement Estimate Edge Function ──────────────────────
// Estimates the user's chest/hips/arms/thighs given height, weight,
// gender, and waist. Keeps the AI key server-side.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';

interface BodyEstimateRequest {
  height_cm: number;
  weight_kg: number;
  waist_cm: number;
  gender?: string;
}

interface BodyEstimateResponse {
  chest_cm: number;
  hips_cm: number;
  left_arm_cm: number;
  right_arm_cm: number;
  left_thigh_cm: number;
  right_thigh_cm: number;
}

const SYSTEM_PROMPT = `You are a body measurement estimation AI. Given a person's height, weight, gender, and waist measurement, estimate their other body measurements using known anthropometric proportions.

Return a JSON object with these exact fields (all values in centimeters, rounded to one decimal place):
{
  "chest_cm": number,
  "hips_cm": number,
  "left_arm_cm": number,
  "right_arm_cm": number,
  "left_thigh_cm": number,
  "right_thigh_cm": number
}

For arms, the dominant arm (typically right) is usually 0.5–1cm larger. Return ONLY the JSON object.`;

function round1(n: unknown): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();

  try {
    const { user_id, supabase } = await verifyAuth(req);
    const body: BodyEstimateRequest = await req.json();

    if (!body.height_cm || !body.weight_kg || !body.waist_cm) {
      return errorResponse('Missing required fields: height_cm, weight_kg, waist_cm', 400);
    }

    const heightFt = Math.floor(body.height_cm / 30.48);
    const heightIn = Math.round((body.height_cm / 2.54) % 12);
    const weightLbs = Math.round(body.weight_kg * 2.20462);

    const userMessage = `Estimate body measurements for:
- Height: ${body.height_cm.toFixed(1)} cm (${heightFt}'${heightIn}")
- Weight: ${body.weight_kg.toFixed(1)} kg (${weightLbs} lbs)
- Gender: ${body.gender ?? 'not specified'}
- Waist: ${body.waist_cm.toFixed(1)} cm`;

    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { json_mode: true, temperature: 0.2, max_tokens: 512 },
    );

    const parsed = JSON.parse(aiResponse.content ?? '{}');
    const response: BodyEstimateResponse = {
      chest_cm: round1(parsed.chest_cm ?? parsed.chestCm),
      hips_cm: round1(parsed.hips_cm ?? parsed.hipsCm),
      left_arm_cm: round1(parsed.left_arm_cm ?? parsed.leftArmCm),
      right_arm_cm: round1(parsed.right_arm_cm ?? parsed.rightArmCm),
      left_thigh_cm: round1(parsed.left_thigh_cm ?? parsed.leftThighCm),
      right_thigh_cm: round1(parsed.right_thigh_cm ?? parsed.rightThighCm),
    };

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
      context: 'progress',
      created_at: new Date().toISOString(),
    });

    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Body estimate error:', error);
    return errorResponse('Failed to estimate body measurements. Please try again.', 500);
  }
});
