// intent-detector.ts — Keyword-based intent classifier for AI cost optimization
// Determines what context the AI needs for a given user message.
// No AI calls — pure regex/keyword matching.

export type UserIntent =
  | 'workout_question'
  | 'nutrition_question'
  | 'progress_question'
  | 'workout_generation'
  | 'program_modification'
  | 'meal_logging'
  | 'exercise_lookup'
  | 'general_coaching';

export interface ContextRequirements {
  recentWorkouts: boolean;
  recentNutrition: boolean;
  exerciseLibrary: boolean;
  personalRecords: boolean;
  activeProgram: boolean;
  allPrograms: boolean;
  savedMeals: boolean;
  groceryList: boolean;
  supplements: boolean;
  activeSession: boolean;
  nutritionTargets: boolean;
  actionSystem: boolean;
}

export const INTENT_CONTEXT_MAP: Record<UserIntent, ContextRequirements> = {
  workout_question: {
    recentWorkouts: true,
    recentNutrition: false,
    exerciseLibrary: false,
    personalRecords: true,
    activeProgram: true,
    allPrograms: false,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: true,
    nutritionTargets: false,
    actionSystem: false,
  },
  nutrition_question: {
    recentWorkouts: false,
    recentNutrition: true,
    exerciseLibrary: false,
    personalRecords: false,
    activeProgram: false,
    allPrograms: false,
    savedMeals: true,
    groceryList: true,
    supplements: true,
    activeSession: false,
    nutritionTargets: true,
    actionSystem: false,
  },
  progress_question: {
    recentWorkouts: true,
    recentNutrition: true,
    exerciseLibrary: false,
    personalRecords: true,
    activeProgram: true,
    allPrograms: false,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: false,
    nutritionTargets: true,
    actionSystem: false,
  },
  workout_generation: {
    recentWorkouts: true,
    recentNutrition: false,
    exerciseLibrary: true,
    personalRecords: true,
    activeProgram: true,
    allPrograms: true,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: false,
    nutritionTargets: false,
    actionSystem: true,
  },
  program_modification: {
    recentWorkouts: false,
    recentNutrition: false,
    exerciseLibrary: true,
    personalRecords: false,
    activeProgram: true,
    allPrograms: true,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: true,
    nutritionTargets: false,
    actionSystem: true,
  },
  meal_logging: {
    recentWorkouts: false,
    recentNutrition: false,
    exerciseLibrary: false,
    personalRecords: false,
    activeProgram: false,
    allPrograms: false,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: false,
    nutritionTargets: true,
    actionSystem: true,
  },
  exercise_lookup: {
    recentWorkouts: false,
    recentNutrition: false,
    exerciseLibrary: true,
    personalRecords: false,
    activeProgram: true,
    allPrograms: false,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: true,
    nutritionTargets: false,
    actionSystem: false,
  },
  general_coaching: {
    recentWorkouts: false,
    recentNutrition: false,
    exerciseLibrary: false,
    personalRecords: false,
    activeProgram: false,
    allPrograms: false,
    savedMeals: false,
    groceryList: false,
    supplements: false,
    activeSession: false,
    nutritionTargets: false,
    actionSystem: false,
  },
};

// ---------------------------------------------------------------------------
// Pattern definitions — checked in priority order (most specific first)
// ---------------------------------------------------------------------------

interface IntentRule {
  intent: UserIntent;
  patterns: RegExp[];
  /** Base confidence when any pattern matches (0–1) */
  baseConfidence: number;
}

const INTENT_RULES: IntentRule[] = [
  // 1. meal_logging — very specific phrases about food consumption
  {
    intent: 'meal_logging',
    baseConfidence: 0.85,
    patterns: [
      /\bi\s+just\s+ate\b/i,
      /\bhad\s+.+?\s+for\s+(breakfast|lunch|dinner|brunch|snack)\b/i,
      /\blog\s+my\s+(meal|food|lunch|dinner|breakfast|snack)\b/i,
      /\bi\s+ate\b/i,
      /\bfor\s+(breakfast|lunch|dinner|brunch)\b/i,
      /\bi\s+had\s+a\b/i,
      /\blog\s+(this|that|it)\b/i,
      /\bjust\s+(had|finished\s+eating)\b/i,
    ],
  },

  // 2. program_modification — editing an existing plan
  {
    intent: 'program_modification',
    baseConfidence: 0.85,
    patterns: [
      /\bswap\s+.+?\s+(for|with|to)\b/i,
      /\breplace\s+(an?\s+)?exercise\b/i,
      /\bchange\s+my\s+(program|plan|routine|split|schedule)\b/i,
      /\badd\s+(an?\s+)?exercise\s+to\b/i,
      /\bremove\s+.+?\s+from\b/i,
      /\bmodify\s+my\b/i,
      /\bswitch\s+.+?\s+to\b/i,
      /\breplace\s+.+?\s+with\b/i,
      /\badd\s+.+?\s+to\s+my\s+(program|plan|routine|split|day)\b/i,
      /\bremove\s+(an?\s+)?exercise\b/i,
      /\bdrop\s+.+?\s+from\b/i,
    ],
  },

  // 3. workout_generation — building new programs
  {
    intent: 'workout_generation',
    baseConfidence: 0.85,
    patterns: [
      /\bbuild\s+me\s+a\b/i,
      /\bcreate\s+(me\s+)?a\s+(workout|program|routine|plan|split)\b/i,
      /\bplan\s+my\s+(week|training|workouts)\b/i,
      /\bmake\s+me\s+a\s+(program|routine|plan|workout|split)\b/i,
      /\bdesign\s+(me\s+)?a\s+(routine|program|workout|plan|split)\b/i,
      /\bi\s+can\s+train\s+\d+\s+days?\b/i,
      /\bnew\s+(workout|program|routine|plan|split)\b/i,
      /\bgenerate\s+(me\s+)?a\s+(workout|program|routine|plan)\b/i,
      /\bi\s+need\s+a\s+new\s+.+?(workout|program|routine|plan|split)\b/i,
      /\bgive\s+me\s+a\s+(workout|program|routine|plan|split)\b/i,
      /\bwrite\s+me\s+a\s+(program|routine|plan|workout)\b/i,
    ],
  },

  // 4. exercise_lookup — info about specific exercises
  {
    intent: 'exercise_lookup',
    baseConfidence: 0.8,
    patterns: [
      /\bwhat\s+muscles?\s+does\b/i,
      /\balternative\s+to\b/i,
      /\bhow\s+(do\s+you|to)\s+do\s+(a\s+|an\s+)?/i,
      /\bproper\s+form\s+for\b/i,
      /\bsubstitute\s+for\b/i,
      /\bwhat\s+is\s+a\s+\w+\s*(press|curl|row|fly|raise|extension|pulldown|squat|lunge|deadlift)\b/i,
      /\bwhat\s+does\s+.+?\s+work\b/i,
      /\bwhat\s+is\s+a\b/i,
      /\bshow\s+me\s+how\s+to\b/i,
      /\balternatives?\s+(for|to)\b/i,
    ],
  },

  // 5. progress_question — tracking & trends
  {
    intent: 'progress_question',
    baseConfidence: 0.8,
    patterns: [
      /\bprogress\b/i,
      /\bPRs?\b/,
      /\bP\.R\.s?\b/i,
      /\bpersonal\s+records?\b/i,
      /\bhow\s+am\s+i\s+doing\b/i,
      /\bimprovement\b/i,
      /\bgained\b/i,
      /\blost\s+weight\b/i,
      /\bbody\s+comp(osition)?\b/i,
      /\bstronger\b/i,
      /\bresults\b/i,
      /\btrend(s|ing)?\b/i,
      /\bhow\s+(much|many)\s+(have\s+i|did\s+i)\b/i,
      /\bam\s+i\s+(getting|making)\b/i,
      /\btrack(ing)?\s+my\b/i,
    ],
  },

  // 6. workout_question — training topics
  {
    intent: 'workout_question',
    baseConfidence: 0.7,
    patterns: [
      /\bworkout\b/i,
      /\bexercise\b/i,
      /\bsets?\b/i,
      /\breps?\b/i,
      /\bbench(\s+press)?\b/i,
      /\bsquat(s|ting)?\b/i,
      /\bdeadlift(s|ing)?\b/i,
      /\bweight\s+should\s+i\b/i,
      /\bform\b/i,
      /\btechnique\b/i,
      /\bsplit\b/i,
      /\brest\s+time\b/i,
      /\brecovery\b/i,
      /\bovertraining\b/i,
      /\bdeload\b/i,
      /\bmuscle\b/i,
      /\bsoreness\b/i,
      /\bvolume\b/i,
      /\bintensity\b/i,
      /\bwarm\s*up\b/i,
      /\bcool\s*down\b/i,
    ],
  },

  // 7. nutrition_question — diet / food topics
  {
    intent: 'nutrition_question',
    baseConfidence: 0.7,
    patterns: [
      /\beat\b/i,
      /\bmeal\b/i,
      /\bprotein\b/i,
      /\bcarb(s|ohydrate)?\b/i,
      /\bcalorie(s)?\b/i,
      /\bmacro(s|nutrient)?\b/i,
      /\bdiet\b/i,
      /\bfood\b/i,
      /\brecipe\b/i,
      /\bcook(ing)?\b/i,
      /\bnutrition\b/i,
      /\bhungry\b/i,
      /\bsnack(s|ing)?\b/i,
      /\bsupplement(s|ation)?\b/i,
      /\bvitamin(s)?\b/i,
      /\bcreatine\b/i,
      /\bfasting\b/i,
      /\bhydration\b/i,
      /\bwater\s+intake\b/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function countMatches(message: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    if (p.test(message)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the user's intent from a message using keyword/regex matching.
 *
 * Checks intents in priority order (most specific first). Returns the first
 * matching intent, or `'general_coaching'` as the fallback.
 *
 * @param message - The raw user message text
 * @returns The detected `UserIntent`
 */
export function detectIntent(message: string): UserIntent {
  const { intent } = detectIntentWithConfidence(message);
  return intent;
}

/**
 * Detect the user's intent along with a confidence score.
 *
 * Confidence is computed from:
 * - The base confidence of the matched rule
 * - The number of keyword matches within the rule (more matches → higher confidence)
 *
 * If no rule matches or confidence is below 0.4, returns `'general_coaching'`.
 *
 * @param message - The raw user message text
 * @returns An object with `intent` and `confidence` (0–1)
 */
export function detectIntentWithConfidence(message: string): {
  intent: UserIntent;
  confidence: number;
} {
  const normalized = message.trim();
  if (!normalized) {
    return { intent: 'general_coaching', confidence: 1.0 };
  }

  // --- Disambiguation overrides for known multi-intent phrases ---
  // "What should I eat after my workout" → nutrition (food keyword dominates)
  // "How's my bench press progress" → progress (progress keyword dominates)
  // These run before the general scan to resolve ambiguity deterministically.
  if (/\bwhat\s+should\s+i\s+eat\b/i.test(normalized) || /\bwhat\s+to\s+eat\b/i.test(normalized)) {
    return { intent: 'nutrition_question', confidence: 0.85 };
  }

  let bestIntent: UserIntent = 'general_coaching';
  let bestScore = 0;

  // Collect all matching intents with their scores
  const scored: { intent: UserIntent; score: number; priority: number }[] = [];

  for (let i = 0; i < INTENT_RULES.length; i++) {
    const rule = INTENT_RULES[i];
    const matches = countMatches(normalized, rule.patterns);
    if (matches === 0) continue;

    // Score = base confidence + bonus for multiple keyword hits (capped at 1.0)
    const multiMatchBonus = Math.min((matches - 1) * 0.05, 0.15);
    const score = Math.min(rule.baseConfidence + multiMatchBonus, 1.0);
    scored.push({ intent: rule.intent, score, priority: i });
  }

  // When multiple intents match, higher-priority rules (lower index) win at
  // the same score tier, but a higher score always wins regardless of priority.
  // Special tie-breaking: for messages that match both a broad category
  // (workout_question/nutrition_question) and a more specific one at the same
  // tier, prefer the higher-priority (more specific) intent.
  for (const entry of scored) {
    if (
      entry.score > bestScore ||
      (entry.score === bestScore && entry.priority < (scored.find(e => e.score === bestScore)?.priority ?? Infinity))
    ) {
      bestScore = entry.score;
      bestIntent = entry.intent;
    }
  }

  if (bestScore < 0.4) {
    return { intent: 'general_coaching', confidence: 1.0 };
  }

  return { intent: bestIntent, confidence: bestScore };
}

/**
 * Get the context requirements for a detected intent.
 *
 * Convenience wrapper that runs detection and maps to context requirements
 * in one call.
 *
 * @param message - The raw user message text
 * @returns The `ContextRequirements` for the detected intent
 */
export function getContextRequirements(message: string): ContextRequirements {
  const intent = detectIntent(message);
  return INTENT_CONTEXT_MAP[intent];
}
