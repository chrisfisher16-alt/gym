// ── Insight Engine ─────────────────────────────────────────────────
// Rule-based local logic — no API calls, no coach-store interaction.
// Generates contextual one-line insights from user data.

export interface Insight {
  id: string;
  message: string;
  coachPrompt?: string;
  priority: number;
  category: 'nutrition' | 'workout' | 'recovery' | 'streak' | 'general';
}

export interface InsightContext {
  // Nutrition
  caloriesConsumed?: number;
  caloriesTarget?: number;
  proteinConsumed?: number;
  proteinTarget?: number;
  waterConsumed?: number;
  waterTarget?: number;
  timeOfDay: number; // hour 0-23

  // Workout
  workoutsThisWeek?: number;
  weeklyWorkoutTarget?: number;
  currentStreak?: number;
  lastWorkoutDate?: string;
  consecutiveWorkoutDays?: number;

  // Progress
  recentPRs?: { exercise: string; weight: number; date: string }[];
  weightTrend?: 'up' | 'down' | 'stable';
}

// ── Rules ──────────────────────────────────────────────────────────

type Rule = (ctx: InsightContext) => Insight | null;

const rules: Rule[] = [
  // 1. Evening + protein < 70% target
  (ctx) => {
    if (
      ctx.timeOfDay >= 18 &&
      ctx.proteinConsumed != null &&
      ctx.proteinTarget != null &&
      ctx.proteinTarget > 0 &&
      ctx.proteinConsumed / ctx.proteinTarget < 0.7
    ) {
      const remaining = Math.round(ctx.proteinTarget - ctx.proteinConsumed);
      return {
        id: 'protein-evening-low',
        message: `You're ${remaining}g short on protein tonight. Try a shake or Greek yogurt.`,
        coachPrompt: 'What are some quick high-protein evening snacks I can eat to hit my target?',
        priority: 8,
        category: 'nutrition',
      };
    }
    return null;
  },

  // 2. PR in last 7 days
  (ctx) => {
    if (!ctx.recentPRs?.length) return null;
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = ctx.recentPRs.find((pr) => new Date(pr.date).getTime() >= weekAgo);
    if (!recent) return null;
    return {
      id: `pr-recent-${recent.exercise}`,
      message: `Your ${recent.exercise} hit ${recent.weight} lbs — new PR! Keep pushing.`,
      coachPrompt: `How can I keep progressing on ${recent.exercise} after hitting ${recent.weight} lbs?`,
      priority: 7,
      category: 'workout',
    };
  },

  // 3. 3+ consecutive workout days → suggest rest
  (ctx) => {
    if (ctx.consecutiveWorkoutDays != null && ctx.consecutiveWorkoutDays >= 3) {
      return {
        id: 'rest-day-suggestion',
        message: `Nice ${ctx.consecutiveWorkoutDays}-day streak! Consider a rest day for recovery.`,
        coachPrompt: 'Should I take a rest day after working out several days in a row?',
        priority: 6,
        category: 'recovery',
      };
    }
    return null;
  },

  // 4. No workout today + afternoon
  (ctx) => {
    if (
      ctx.timeOfDay >= 12 &&
      ctx.timeOfDay < 20 &&
      ctx.lastWorkoutDate != null
    ) {
      const today = new Date().toISOString().split('T')[0];
      if (ctx.lastWorkoutDate !== today) {
        return {
          id: 'workout-nudge-afternoon',
          message: "You usually work out around this time. Ready to go?",
          coachPrompt: 'Can you suggest a quick workout I can do right now?',
          priority: 4,
          category: 'workout',
        };
      }
    }
    return null;
  },

  // 5. Calories < 50% at 6pm+
  (ctx) => {
    if (
      ctx.timeOfDay >= 18 &&
      ctx.caloriesConsumed != null &&
      ctx.caloriesTarget != null &&
      ctx.caloriesTarget > 0 &&
      ctx.caloriesConsumed / ctx.caloriesTarget < 0.5
    ) {
      const remaining = Math.round(ctx.caloriesTarget - ctx.caloriesConsumed);
      return {
        id: 'calories-evening-low',
        message: `Still ${remaining} cal to go — time for a solid dinner.`,
        coachPrompt: `I have about ${remaining} calories left for today. What should I eat for dinner?`,
        priority: 7,
        category: 'nutrition',
      };
    }
    return null;
  },

  // 6. Current streak >= 7
  (ctx) => {
    if (ctx.currentStreak != null && ctx.currentStreak >= 7) {
      return {
        id: 'streak-strong',
        message: `${ctx.currentStreak}-day streak! You're in the top tier of consistency.`,
        coachPrompt: 'How do I maintain a long workout streak without burning out?',
        priority: 5,
        category: 'streak',
      };
    }
    return null;
  },

  // 7. Rest day (no workout today, but had one yesterday)
  (ctx) => {
    if (ctx.lastWorkoutDate == null) return null;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    if (ctx.lastWorkoutDate === yesterday && ctx.lastWorkoutDate !== today) {
      return {
        id: 'rest-day-hydrate',
        message: "Rest day — great for muscle recovery. Stay hydrated.",
        coachPrompt: 'What should I do on rest days to maximize recovery?',
        priority: 3,
        category: 'recovery',
      };
    }
    return null;
  },

  // 8. Protein > 90% target
  (ctx) => {
    if (
      ctx.proteinConsumed != null &&
      ctx.proteinTarget != null &&
      ctx.proteinTarget > 0 &&
      ctx.proteinConsumed / ctx.proteinTarget >= 0.9
    ) {
      return {
        id: 'protein-strong',
        message: "Protein game is strong today. 💪",
        coachPrompt: "I'm hitting my protein targets. How can I optimize my other macros?",
        priority: 3,
        category: 'nutrition',
      };
    }
    return null;
  },

  // 9. First workout this week
  (ctx) => {
    if (
      ctx.workoutsThisWeek === 1 &&
      ctx.weeklyWorkoutTarget != null &&
      ctx.weeklyWorkoutTarget > 1
    ) {
      const remaining = ctx.weeklyWorkoutTarget - 1;
      return {
        id: 'first-workout-week',
        message: `Great start to the week! ${remaining} more session${remaining !== 1 ? 's' : ''} to hit your target.`,
        coachPrompt: 'Help me plan the rest of my workouts for this week.',
        priority: 5,
        category: 'workout',
      };
    }
    return null;
  },

  // 10. Water < 50% at 2pm+
  (ctx) => {
    if (
      ctx.timeOfDay >= 14 &&
      ctx.waterConsumed != null &&
      ctx.waterTarget != null &&
      ctx.waterTarget > 0 &&
      ctx.waterConsumed / ctx.waterTarget < 0.5
    ) {
      return {
        id: 'hydration-low',
        message: "Hydration check: you're behind on water today.",
        coachPrompt: 'How much water should I be drinking daily based on my activity level?',
        priority: 6,
        category: 'nutrition',
      };
    }
    return null;
  },

  // 11. Weight trending down for 2+ weeks
  (ctx) => {
    if (ctx.weightTrend === 'down') {
      return {
        id: 'weight-trending-down',
        message: "Weight trending down steadily. Consistency is paying off.",
        coachPrompt: 'My weight has been trending down. Is my rate of loss healthy?',
        priority: 4,
        category: 'general',
      };
    }
    return null;
  },

  // 12. No workouts in 3+ days
  (ctx) => {
    if (ctx.lastWorkoutDate == null) return null;
    const daysSince = Math.floor(
      (Date.now() - new Date(ctx.lastWorkoutDate).getTime()) / 86_400_000,
    );
    if (daysSince >= 3) {
      return {
        id: 'workout-gap',
        message: `It's been ${daysSince} days since your last workout. Time to get back?`,
        coachPrompt: 'I took a few days off from working out. What should my comeback session look like?',
        priority: 7,
        category: 'workout',
      };
    }
    return null;
  },
];

// ── Public API ──────────────────────────────────────────────────────

export function generateInsights(context: InsightContext): Insight[] {
  const results: Insight[] = [];
  for (const rule of rules) {
    const insight = rule(context);
    if (insight) results.push(insight);
  }
  // Sort by priority descending (higher = more important)
  results.sort((a, b) => b.priority - a.priority);
  return results;
}
