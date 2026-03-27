// Client-side AI output safety filter
// Mirrors server-side validateOutput() from supabase/functions/_shared/safety.ts

export interface SafetyCheckResult {
  safe: boolean;
  flagged: boolean;
  reason?: string;
  category?: string;
}

// ── Blocked Patterns (ported from server-side safety.ts) ─────────────

const MEDICAL_DIAGNOSIS_PATTERNS = [
  /you (have|likely have|probably have|might have|are suffering from) (\w+ ){0,3}(disease|syndrome|disorder|condition|cancer|diabetes|infection)/i,
  /i (can )?diagnos/i,
  /based on (?:your )?symptoms,? (?:you have|it(?:'s| is))/i,
];

const DANGEROUS_CALORIE_PATTERNS = [
  /eat (?:only |just )?([\d,]+)\s*(?:cal|kcal|calories)/i,
  /(?:restrict|limit) (?:yourself )?to ([\d,]+)\s*(?:cal|kcal|calories)/i,
  /(\d{2,4})\s*(?:cal|kcal|calories)\s*(?:per |a )?day/i,
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

// CLAUDE.md non-negotiable: never use these terms in coach output
const PROHIBITED_TERMINOLOGY = [
  /\bdietitian\b/i,
  /\bnutritionist\b/i,
  /\bprescribe\b/i,
  /\bdiagnose[sd]?\b/i,
];

// ── Validation ───────────────────────────────────────────────────────

/**
 * Check AI output for dangerous or inappropriate content.
 * Mirrors the server-side validateOutput() logic exactly.
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
      const minCalories = userGender === 'male' ? 1500 : 1200;
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

  // Check for prohibited terminology
  for (const pattern of PROHIBITED_TERMINOLOGY) {
    if (pattern.test(content)) {
      return {
        safe: false,
        flagged: true,
        reason: 'Response contains prohibited health terminology',
        category: 'prohibited_terminology',
      };
    }
  }

  return { safe: true, flagged: false };
}

// ── Sanitization ─────────────────────────────────────────────────────

/**
 * Sanitize an AI response by appending a disclaimer if unsafe content is detected.
 * Does not block content — adds a visible warning instead.
 */
export function sanitizeAIResponse(content: string, userGender?: string): string {
  const check = validateOutput(content, userGender);
  if (check.safe) return content;

  return content + '\n\n⚠️ *This response may contain inaccurate health information. Always consult a qualified healthcare provider for medical advice.*';
}
