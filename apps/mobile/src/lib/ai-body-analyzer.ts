import { Platform } from 'react-native';
import { getAIConfig, getProviderDefaults } from './ai-provider';

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

// ── Helpers ──────────────────────────────────────────────────────────

const CLAUDE_WEB_PROXY_URL = 'http://localhost:3001/api/anthropic';

function getClaudeUrl(configBaseUrl: string, defaultBaseUrl: string): string {
  if (Platform.OS === 'web') {
    return CLAUDE_WEB_PROXY_URL;
  }
  return configBaseUrl || defaultBaseUrl;
}

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
  const defaults = getProviderDefaults('claude');
  const baseUrl = getClaudeUrl(config.baseUrl || '', defaults.baseUrl);
  const model = config.model || defaults.model;

  const heightFt = Math.floor(params.heightCm / 30.48);
  const heightIn = Math.round((params.heightCm / 2.54) % 12);
  const weightLbs = Math.round(params.weightKg * 2.20462);

  const userMessage = `Estimate body measurements for:
- Height: ${params.heightCm.toFixed(1)} cm (${heightFt}'${heightIn}")
- Weight: ${params.weightKg.toFixed(1)} kg (${weightLbs} lbs)
- Gender: ${params.gender || 'not specified'}
- Waist: ${params.waistCm.toFixed(1)} cm`;

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 512,
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

  let cleaned = textBlock.text.trim();
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
