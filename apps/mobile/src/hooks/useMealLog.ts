import { useNutritionStore } from '../stores/nutrition-store';
import type { MealEntry, MealItemEntry, MealType } from '../types/nutrition';
import { calculateMealTotals } from '../lib/nutrition-utils';

export function useMealLog() {
  const logMeal = useNutritionStore((s) => s.logMeal);
  const addMealItem = useNutritionStore((s) => s.addMealItem);
  const editMealItem = useNutritionStore((s) => s.editMealItem);
  const removeMealItem = useNutritionStore((s) => s.removeMealItem);
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);
  const quickAddCalories = useNutritionStore((s) => s.quickAddCalories);
  const selectedDate = useNutritionStore((s) => s.selectedDate);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const meals = dailyLogs[selectedDate]?.meals ?? [];

  const getMealById = (mealId: string): MealEntry | undefined => {
    return meals.find((m) => m.id === mealId);
  };

  const getMealsByType = (type: MealType): MealEntry[] => {
    return meals.filter((m) => m.mealType === type);
  };

  const getMealCalories = (meal: MealEntry): number => {
    return calculateMealTotals(meal.items).calories;
  };

  const recentMeals = meals.slice().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    meals,
    recentMeals,
    logMeal,
    addMealItem,
    editMealItem,
    removeMealItem,
    deleteMeal,
    quickAddCalories,
    getMealById,
    getMealsByType,
    getMealCalories,
  };
}
