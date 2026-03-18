// ── Safety Guardrails for AI Coach ──────────────────────────────────

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import type { SafetyCheckResult, RateLimitConfig, CoachContext } from './types.ts';

// ── Configuration ───────────────────────────────────────────────────

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: { tier: 'free', max_per_hour: 10, max_per_day: 30 },
  workout_coach: { tier: 'workout_coach', max_per_hour: 30, max_per_day: 150 },
  nutrition_coach: { tier: 'nutrition_coach', max_per_hour: 30, max_per_day: 150 },
  full_health_coach: { tier: 'full_health_coach', max_per_hour: 60, max_per_day: 300 },
};

const MAX_MESSAGE_LENGTH = 4000;
const MIN_MESSAGE_LENGTH = 1;

// ── Blocked Patterns ────────────────────────────────────────────────

const MEDICAL_DIAGNOSIS_PATTERNS = [
  /you (have|likely have|probably have|might have|are suffering from) (\w+ ){0,3}(disease|syndrome|disorder|condition|cancer|diabetes|infection)/i,
  /i (can )?diagnos/i,
  /based on (?:your )?symptoms,? (?:you have|it(?:'s| is))/i,
];

const DANGEROUS_CALORIE_PATTERNS = [
  /eat (?:only |just )?([\d,]+)\s*(?:cal|kcal|calories)/i,
  /(?:restrict|limit) (?:yourself )?to ([\d,]+)\s*(?:cal|kcal|calories)/i,
  /(\d{2,3})\s*(?:cal|kcal|calories)\s*(?:per |a )?day/i,
];

const EATING_DISORDER_PATTERNS = [
  /(?:you should |try |consider )(?:purging|fasting for (?:\d+ )?days|skipping meals? for (?:\d+ )?days)/i,
  /(?:laxative|diuretic)s? (?:for|to) (?:weight|fat) loss/i,
  /(?:extreme|very low|severely) restrict/i,
];

const UNSAFE_SUPPLEMENT_PATTERNS = [
  /(?:take|use|try) (\d+(?:\.\d+)?)\s*(?:mg|g|grams?) of (ephedra|dnp|clenbuterol|sarms|prohormone|anabolic steroid)/i,
  /(?:inject|pin|cycle) (?:testosterone|trenbolone|nandrolone|hgh|growth hormone)/i,
];

// ── System Prompt Safety Rules ──────────────────────────────────────

export const SAFETY_SYSTEM_PROMPT = `## Safety Guidelines — You MUST follow these rules:
- You are a health and fitness coach, NOT a medical professional.
- Never diagnose medical conditions or diseases.
- Never recommend calorie intake below 1200 for women or 1500 for men.
- Never encourage extreme restriction, fasting for multiple days, or purging behaviors.
- Always recommend consulting a healthcare provider for medical concerns or persistent symptoms.
- Label all nutritional estimates clearly as estimates.
- Do not make specific supplement dosage claims beyond general guidelines from reputable sources.
- Do not recommend prescription medications or controlled substances.
- If a user expresses concerning health symptoms, disordered eating patterns, or suicidal thoughts, recommend professional help immediately.
- When suggesting supplements, include standard disclaimers and recommend consulting a doctor.
- Be honest when you don't know something rather than making up information.`;

// ── Input Validation ────────────────────────────────────────────────

/**
 * Validate user input before processing.
 */
export function validateInput(message: string): SafetyCheckResult {
  if (!message || message.trim().length < MIN_MESSAGE_LENGTH) {
    return { safe: false, flagged: false, reason: 'Message is empty', category: 'content_length' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      safe: false,
      flagged: false,
      reason: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      category: 'content_length',
    };
  }

  return { safe: true, flagged: false };
}

// ── Output Filtering ────────────────────────────────────────────────

/**
 * Check AI output for dangerous or inappropriate content.
 */
export function validateOutput(content: string, userGender?: string): SafetyCheckResult {
  // Check for medical diagnosis language
  for (const pattern of MEDICAL_DIAGNOSIS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        flagged: true,
        reason: 'Response contains medical diagnosis language',
        category: 'medical_diagnosis',
      };
    }
  }

  // Check for dangerous calorie advice
  for (const pattern of DANGEROUS_CALORIE_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const calories = parseInt(match[1].replace(',', ''), 10);
      const minCalories = userGender === 'female' ? 1200 : 1500;
      if (calories > 0 && calories < minCalories) {
        return {
          safe: false,
          flagged: true,
          reason: `Response suggests dangerously low calorie intake (${calories} cal, minimum is ${minCalories})`,
          category: 'dangerous_calorie_advice',
        };
      }
    }
  }

  // Check for eating disorder encouragement
  for (const pattern of EATING_DISORDER_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        flagged: true,
        reason: 'Response contains eating disorder encouragement',
        category: 'eating_disorder',
      };
    }
  }

  // Check for unsafe supplement recommendations
  for (const pattern of UNSAFE_SUPPLEMENT_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        flagged: true,
        reason: 'Response contains unsafe supplement recommendation',
        category: 'unsafe_supplement',
      };
    }
  }

  return { safe: true, flagged: false };
}

// ── Rate Limiting ───────────────────────────────────────────────────

/**
 * Check if the user has exceeded their rate limit.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  tier = 'free',
): Promise<SafetyCheckResult> {
  const limits = RATE_LIMITS[tier] ?? RATE_LIMITS.free;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Get user's conversation IDs
  const { data: userConvos } = await supabase
    .from('coach_conversations')
    .select('id')
    .eq('user_id', userId);
  const convIds = userConvos?.map((c: { id: string }) => c.id) ?? [];

  // No conversations means no messages — rate limit passes
  if (convIds.length === 0) return { safe: true, flagged: false };

  // Count messages in the last hour
  const { count: hourCount } = await supabase
    .from('coach_messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convIds)
    .eq('role', 'user')
    .gte('created_at', oneHourAgo);

  if ((hourCount ?? 0) >= limits.max_per_hour) {
    return {
      safe: false,
      flagged: false,
      reason: `Rate limit exceeded: ${limits.max_per_hour} messages per hour`,
      category: 'rate_limit',
    };
  }

  // Count messages today
  const { count: dayCount } = await supabase
    .from('coach_messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convIds)
    .eq('role', 'user')
    .gte('created_at', dayStart);

  if ((dayCount ?? 0) >= limits.max_per_day) {
    return {
      safe: false,
      flagged: false,
      reason: `Rate limit exceeded: ${limits.max_per_day} messages per day`,
      category: 'rate_limit',
    };
  }

  return { safe: true, flagged: false };
}

// ── Telemetry Logging ───────────────────────────────────────────────

/**
 * Log a safety event (flagged content) for admin review.
 */
export async function logSafetyEvent(
  supabase: SupabaseClient,
  userId: string,
  event: {
    conversation_id?: string;
    message_id?: string;
    category: string;
    reason: string;
    content_snippet: string;
    direction: 'input' | 'output';
    context?: CoachContext;
  },
): Promise<void> {
  await supabase.from('ai_usage_events').insert({
    user_id: userId,
    conversation_id: event.conversation_id,
    message_id: event.message_id,
    model: 'safety_check',
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    latency_ms: 0,
    status: 'flagged',
    tool_calls_count: 0,
    error: JSON.stringify({
      category: event.category,
      reason: event.reason,
      direction: event.direction,
      content_snippet: event.content_snippet.slice(0, 200),
    }),
    created_at: new Date().toISOString(),
  });
}
