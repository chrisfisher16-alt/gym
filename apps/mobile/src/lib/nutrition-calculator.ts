import type { NutritionTargets } from '../types/nutrition';

// ── Helpers ──────────────────────────────────────────────────────

/** Round to nearest increment (e.g. nearest 50 for calories, nearest 5 for macros). */
function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/** Convert kg to lbs. */
function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

// ── Core Calculations ────────────────────────────────────────────

/**
 * Calculate BMR using Mifflin-St Jeor equation.
 * Returns kcal/day.
 */
function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: string,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === 'female' ? base - 161 : base + 5;
}

/**
 * Calculate TDEE from BMR and training frequency.
 * Activity multiplier:
 * - 1-2 days/week: 1.375 (lightly active)
 * - 3-4 days/week: 1.55  (moderately active)
 * - 5-6 days/week: 1.725 (very active)
 */
function calculateTDEE(bmr: number, trainingDaysPerWeek: number): number {
  let multiplier: number;
  if (trainingDaysPerWeek <= 2) {
    multiplier = 1.375;
  } else if (trainingDaysPerWeek <= 4) {
    multiplier = 1.55;
  } else {
    multiplier = 1.725;
  }
  return bmr * multiplier;
}

// ── Goal-Specific Macros ─────────────────────────────────────────

/**
 * Calculate personalized nutrition targets based on body stats and fitness goal.
 *
 * Goal adjustments:
 * - build_muscle:          +300 cal surplus, protein 1.0 g/lb, moderate carbs
 * - lose_fat:              -500 cal deficit, protein 1.2 g/lb, lower carbs
 * - get_stronger:          +200 cal surplus, protein 0.9 g/lb, higher carbs
 * - stay_active / default: maintenance,      protein 0.8 g/lb, balanced
 */
export function calculateNutritionTargets(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: string;
  fitnessGoal: string;
  trainingDaysPerWeek: number;
}): NutritionTargets {
  const { weightKg, heightCm, ageYears, gender, fitnessGoal, trainingDaysPerWeek } = params;
  const weightLbs = kgToLbs(weightKg);

  const bmr = calculateBMR(weightKg, heightCm, ageYears, gender);
  const tdee = calculateTDEE(bmr, trainingDaysPerWeek);

  let calories: number;
  let proteinPerLb: number;
  let fatPct: number; // percentage of calories from fat

  switch (fitnessGoal) {
    case 'build_muscle':
      calories = tdee + 300;
      proteinPerLb = 1.0;
      fatPct = 0.25;
      break;
    case 'lose_fat':
      calories = tdee - 500;
      proteinPerLb = 1.2;
      fatPct = 0.25;
      break;
    case 'get_stronger':
      calories = tdee + 200;
      proteinPerLb = 0.9;
      fatPct = 0.25;
      break;
    case 'stay_active':
    case 'athletic_performance':
    default:
      calories = tdee;
      proteinPerLb = 0.8;
      fatPct = 0.30;
      break;
  }

  const protein_g = proteinPerLb * weightLbs;
  const fat_g = (calories * fatPct) / 9; // 9 cal per gram of fat
  // Remaining calories go to carbs (4 cal per gram)
  const carbCalories = calories - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(carbCalories / 4, 50); // floor at 50g

  // Fiber: ~14g per 1000 calories
  const fiber_g = (calories / 1000) * 14;

  // Water: ~0.5 oz per pound of body weight, rounded to nearest 5
  const water_oz = 0.5 * weightLbs;

  return {
    calories: roundTo(calories, 50),
    protein_g: roundTo(protein_g, 5),
    carbs_g: roundTo(carbs_g, 5),
    fat_g: roundTo(fat_g, 5),
    fiber_g: roundTo(fiber_g, 5),
    water_oz: roundTo(water_oz, 5),
  };
}
