import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';
import { calculateMealTotals } from '../lib/nutrition-utils';
import type { SavedMealEntry, MacroTotals } from '../types/nutrition';

export function useSavedMeals() {
  const savedMeals = useNutritionStore((s) => s.savedMeals);
  const saveMealAsTemplate = useNutritionStore((s) => s.saveMealAsTemplate);
  const deleteSavedMeal = useNutritionStore((s) => s.deleteSavedMeal);
  const logSavedMeal = useNutritionStore((s) => s.logSavedMeal);

  const sortedByUse = useMemo(
    () => [...savedMeals].sort((a, b) => b.useCount - a.useCount),
    [savedMeals],
  );

  const getSavedMealTotals = (meal: SavedMealEntry): MacroTotals => {
    return calculateMealTotals(meal.items);
  };

  return {
    savedMeals,
    sortedByUse,
    saveMealAsTemplate,
    deleteSavedMeal,
    logSavedMeal,
    getSavedMealTotals,
  };
}
