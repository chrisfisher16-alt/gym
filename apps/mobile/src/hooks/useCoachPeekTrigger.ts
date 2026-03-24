import { useEffect, useRef } from 'react';
import { useCoachPeek } from '../providers/CoachPeekProvider';
import { generateInsights, type InsightContext } from '../lib/insight-engine';
import { useNutritionDashboard } from './useNutritionDashboard';
import { useWorkoutHistory } from './useWorkoutHistory';
import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { calculateStreak } from '../lib/achievements';
import { isDemoMode, DEMO_STREAK, getDemoTodayNutrition, DEMO_NUTRITION_TARGETS } from '../lib/demo-mode';

const PEEK_DELAY_MS = 3_000;
const MIN_PRIORITY = 7;

/**
 * Triggers a CoachPeek notification on the Today tab when a high-priority
 * insight is available. Max 1 per app session, shown after a 3-second delay.
 */
export function useCoachPeekTrigger(): void {
  const { showPeek, hasShownPeek } = useCoachPeek();
  const firedRef = useRef(false);

  const { targets, consumed, waterIntake } = useNutritionDashboard();
  const { history } = useWorkoutHistory();
  const personalRecords = useWorkoutStore((s) => s.personalRecords);

  const demo = isDemoMode();

  useEffect(() => {
    // Only fire once per mount & session
    if (firedRef.current || hasShownPeek) return;
    firedRef.current = true;

    const hour = new Date().getHours();
    const demoNutrition = demo ? getDemoTodayNutrition() : null;
    const dC = demo && demoNutrition ? demoNutrition.consumed : consumed;
    const dT = demo ? DEMO_NUTRITION_TARGETS : targets;
    const dW = demo ? 60 : waterIntake;
    const streak = demo ? DEMO_STREAK.currentStreak : calculateStreak(history);

    const weekStart = new Date();
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
    weekStart.setHours(0, 0, 0, 0);
    const workoutsThisWeek = demo
      ? 5
      : history.filter((w) => new Date(w.completedAt) >= weekStart).length;

    const recentPRs = Object.entries(personalRecords).map(([exercise, pr]) => ({
      exercise,
      weight: typeof pr === 'object' && pr !== null && 'weight' in pr ? (pr as { weight: number }).weight : 0,
      date: typeof pr === 'object' && pr !== null && 'date' in pr ? (pr as { date: string }).date : '',
    }));

    const ctx: InsightContext = {
      caloriesConsumed: dC.calories,
      caloriesTarget: dT.calories,
      proteinConsumed: dC.protein_g,
      proteinTarget: dT.protein_g,
      waterConsumed: dW,
      waterTarget: dT.water_oz,
      timeOfDay: hour,
      workoutsThisWeek,
      currentStreak: streak,
      lastWorkoutDate: history[0]?.completedAt?.split('T')[0],
      recentPRs,
    };

    const insights = generateInsights(ctx);
    const top = insights[0];
    if (!top || top.priority < MIN_PRIORITY) return;

    const timer = setTimeout(() => {
      showPeek(top.message, top.coachPrompt);
    }, PEEK_DELAY_MS);

    return () => clearTimeout(timer);
    // Run once on mount — intentionally not re-running on data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
