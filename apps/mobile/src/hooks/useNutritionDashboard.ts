import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';
import { calculateDailyTotals, calculateRemainingMacros } from '../lib/nutrition-utils';

export function useNutritionDashboard() {
  const selectedDate = useNutritionStore((s) => s.selectedDate);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);
  const targets = useNutritionStore((s) => s.targets);
  const setSelectedDate = useNutritionStore((s) => s.setSelectedDate);

  const log = dailyLogs[selectedDate];
  const meals = log?.meals ?? [];

  const consumed = useMemo(() => calculateDailyTotals(meals), [meals]);

  const remaining = useMemo(
    () => calculateRemainingMacros(targets, consumed),
    [targets, consumed],
  );

  const progress = useMemo(
    () => ({
      calories: targets.calories > 0 ? consumed.calories / targets.calories : 0,
      protein: targets.protein_g > 0 ? consumed.protein_g / targets.protein_g : 0,
      carbs: targets.carbs_g > 0 ? consumed.carbs_g / targets.carbs_g : 0,
      fat: targets.fat_g > 0 ? consumed.fat_g / targets.fat_g : 0,
      fiber: targets.fiber_g > 0 ? consumed.fiber_g / targets.fiber_g : 0,
      water: targets.water_ml > 0 ? (log?.waterIntake_ml ?? 0) / targets.water_ml : 0,
    }),
    [targets, consumed, log?.waterIntake_ml],
  );

  const waterIntake = log?.waterIntake_ml ?? 0;
  const supplementsTaken = log?.supplementsTaken ?? [];

  return {
    selectedDate,
    setSelectedDate,
    targets,
    consumed,
    remaining,
    progress,
    meals,
    waterIntake,
    supplementsTaken,
  };
}
