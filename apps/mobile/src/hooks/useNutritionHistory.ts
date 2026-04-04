import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';
import { getDateString, calculateDailyTotals } from '../lib/nutrition-utils';

export interface NutritionHistoryData {
  calories: number[];
  protein: number[];
  carbs: number[];
  fat: number[];
  fiber: number[];
  water: number[];
  /** The date strings (YYYY-MM-DD) for each data point */
  dates: string[];
}

/**
 * Returns the last `days` of nutrition data from dailyLogs,
 * suitable for feeding into `<Sparkline data={...} />`.
 * Each array is ordered oldest → newest.
 */
export function useNutritionHistory(days = 7): NutritionHistoryData {
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  return useMemo(() => {
    const dates: string[] = [];
    const calories: number[] = [];
    const protein: number[] = [];
    const carbs: number[] = [];
    const fat: number[] = [];
    const fiber: number[] = [];
    const water: number[] = [];

    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = getDateString(d);
      dates.push(dateStr);

      const log = dailyLogs[dateStr];
      if (log) {
        const consumed = log.consumed ?? calculateDailyTotals(log.meals ?? []);
        calories.push(consumed.calories);
        protein.push(consumed.protein_g);
        carbs.push(consumed.carbs_g);
        fat.push(consumed.fat_g);
        fiber.push(consumed.fiber_g);
        water.push(log.waterIntake_oz ?? 0);
      } else {
        calories.push(0);
        protein.push(0);
        carbs.push(0);
        fat.push(0);
        fiber.push(0);
        water.push(0);
      }
    }

    return { calories, protein, carbs, fat, fiber, water, dates };
  }, [dailyLogs, days]);
}
