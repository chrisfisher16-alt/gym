import type {
  MealEntry,
  MealItemEntry,
  MacroTotals,
  NutritionTargets,
  MacroSplit,
} from '../types/nutrition';

// ── ID Generation ──────────────────────────────────────────────────

export function generateNutritionId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// ── Date Helpers ───────────────────────────────────────────────────

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const todayStr = getDateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDateString(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ── Macro Calculations ─────────────────────────────────────────────

const EMPTY_TOTALS: MacroTotals = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
};

export function calculateMealTotals(items: MealItemEntry[]): MacroTotals {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      protein_g: totals.protein_g + item.protein_g,
      carbs_g: totals.carbs_g + item.carbs_g,
      fat_g: totals.fat_g + item.fat_g,
      fiber_g: totals.fiber_g + item.fiber_g,
    }),
    { ...EMPTY_TOTALS },
  );
}

export function calculateDailyTotals(meals: MealEntry[]): MacroTotals {
  return meals.reduce(
    (totals, meal) => {
      const mealTotals = calculateMealTotals(meal.items);
      return {
        calories: totals.calories + mealTotals.calories,
        protein_g: totals.protein_g + mealTotals.protein_g,
        carbs_g: totals.carbs_g + mealTotals.carbs_g,
        fat_g: totals.fat_g + mealTotals.fat_g,
        fiber_g: totals.fiber_g + mealTotals.fiber_g,
      };
    },
    { ...EMPTY_TOTALS },
  );
}

export function calculateRemainingMacros(
  target: NutritionTargets,
  consumed: MacroTotals,
): MacroTotals {
  return {
    calories: Math.max(0, target.calories - consumed.calories),
    protein_g: Math.max(0, target.protein_g - consumed.protein_g),
    carbs_g: Math.max(0, target.carbs_g - consumed.carbs_g),
    fat_g: Math.max(0, target.fat_g - consumed.fat_g),
    fiber_g: Math.max(0, target.fiber_g - consumed.fiber_g),
  };
}

// ── Formatting ─────────────────────────────────────────────────────

export function formatMacros(value: number, unit: string = 'g'): string {
  return `${Math.round(value)}${unit}`;
}

export function formatCalories(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Macro Colors ───────────────────────────────────────────────────
// Returns color key from theme.colors

export function getMacroColorKey(macro: string): 'protein' | 'carbs' | 'fat' | 'fiber' | 'calories' {
  switch (macro.toLowerCase()) {
    case 'protein':
    case 'protein_g':
      return 'protein';
    case 'carbs':
    case 'carbs_g':
      return 'carbs';
    case 'fat':
    case 'fat_g':
      return 'fat';
    case 'fiber':
    case 'fiber_g':
      return 'fiber';
    case 'calories':
    default:
      return 'calories';
  }
}

// ── Target Generation (BMR/TDEE) ───────────────────────────────────

interface ProfileInput {
  sex?: 'male' | 'female';
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal?: 'lose' | 'maintain' | 'gain';
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<string, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export function calculateBMR(profile: ProfileInput): number {
  const { sex = 'male', age = 30, weight_kg = 75, height_cm = 175 } = profile;
  // Mifflin-St Jeor
  if (sex === 'male') {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  }
  return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
}

export function generateDefaultTargets(
  profile: ProfileInput = {},
  macroSplit: MacroSplit = { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
): NutritionTargets {
  const bmr = calculateBMR(profile);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel ?? 'moderate'];
  const tdee = bmr * activityMultiplier;
  const goalAdjustment = GOAL_ADJUSTMENTS[profile.goal ?? 'maintain'];
  const calories = Math.round(tdee + goalAdjustment);

  // Calculate grams from percentage (protein/carbs = 4cal/g, fat = 9cal/g)
  const protein_g = Math.round((calories * macroSplit.protein_pct) / 100 / 4);
  const carbs_g = Math.round((calories * macroSplit.carbs_pct) / 100 / 4);
  const fat_g = Math.round((calories * macroSplit.fat_pct) / 100 / 9);

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g: profile.sex === 'female' ? 25 : 30,
    water_ml: 2500,
  };
}

// ── Meal Type Helpers ──────────────────────────────────────────────

export function getMealTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  return labels[type] ?? type;
}

export function getMealTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    breakfast: 'sunny-outline',
    lunch: 'restaurant-outline',
    dinner: 'moon-outline',
    snack: 'cafe-outline',
  };
  return icons[type] ?? 'restaurant-outline';
}

export function suggestMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

// ── Time Formatting ────────────────────────────────────────────────

export function formatMealTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
