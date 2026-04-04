import { getAIConfig, callAI, type AIMessage } from './ai-provider';

// ── Types ────────────────────────────────────────────────────────────

export interface BodyEstimationParams {
  heightCm: number;
  weightKg: number;
  gender?: string;
  waistCm: number;
}

export interface BodyEstimationResult {
  chestCm: number;
  hipsCm: number;
  leftArmCm: number;
  rightArmCm: number;
  leftThighCm: number;
  rightThighCm: number;
}

// ── System Prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a body measurement estimation AI. Given a person's height, weight, gender, and waist measurement, estimate their other body measurements using known anthropometric proportions and correlations.

Return ONLY a valid JSON object with these exact fields (all values in centimeters):
{
  "chestCm": number,
  "hipsCm": number,
  "leftArmCm": number,
  "rightArmCm": number,
  "leftThighCm": number,
  "rightThighCm": number
}

Use realistic estimates based on typical body proportions. For arms, the dominant arm (right for most people) is typically 0.5-1cm larger. Round to one decimal place. Return ONLY the JSON object, no other text.`;

// ── Estimation Function ──────────────────────────────────────────────

export async function estimateBodyMeasurements(
  params: BodyEstimationParams,
): Promise<BodyEstimationResult> {
  const config = await getAIConfig();

  const heightFt = Math.floor(params.heightCm / 30.48);
  const heightIn = Math.round((params.heightCm / 2.54) % 12);
  const weightLbs = Math.round(params.weightKg * 2.20462);

  const userMessage = `Estimate body measurements for:
- Height: ${params.heightCm.toFixed(1)} cm (${heightFt}'${heightIn}")
- Weight: ${params.weightKg.toFixed(1)} kg (${weightLbs} lbs)
- Gender: ${params.gender || 'not specified'}
- Waist: ${params.waistCm.toFixed(1)} cm`;

  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const response = await callAI(messages, config);

  let cleaned = response.content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  return {
    chestCm: Math.round((parsed.chestCm ?? 0) * 10) / 10,
    hipsCm: Math.round((parsed.hipsCm ?? 0) * 10) / 10,
    leftArmCm: Math.round((parsed.leftArmCm ?? 0) * 10) / 10,
    rightArmCm: Math.round((parsed.rightArmCm ?? 0) * 10) / 10,
    leftThighCm: Math.round((parsed.leftThighCm ?? 0) * 10) / 10,
    rightThighCm: Math.round((parsed.rightThighCm ?? 0) * 10) / 10,
  };
}
