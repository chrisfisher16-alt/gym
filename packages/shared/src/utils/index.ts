import type { EntitlementTier, Gender, UnitPreference } from '../types';
import { FREE_TIER_LIMITS } from '../constants';

// ── Weight Conversion ────────────────────────────────────────────────

const KG_TO_LBS = 2.20462;

export function formatWeight(kg: number, preference: UnitPreference): string {
  if (preference === 'imperial') {
    const lbs = Math.round(kg * KG_TO_LBS * 10) / 10;
    return `${lbs} lbs`;
  }
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded} kg`;
}

// ── Calorie Formatting ───────────────────────────────────────────────

export function formatCalories(n: number): string {
  return `${n.toLocaleString('en-US')} cal`;
}

// ── BMR Calculation (Mifflin-St Jeor) ────────────────────────────────

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
): number {
  // Mifflin-St Jeor Equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') {
    return Math.round(base + 5);
  }
  // female, other, prefer_not_to_say use female formula as conservative default
  return Math.round(base - 161);
}

// ── TDEE Calculation ─────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<number, number> = {
  1: 1.2,   // sedentary
  2: 1.375, // lightly active
  3: 1.55,  // moderately active
  4: 1.725, // very active
  5: 1.9,   // extremely active
};

export function calculateTDEE(bmr: number, activityLevel: number): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}

// ── Macro Targets ────────────────────────────────────────────────────

export interface MacroSplit {
  protein: number; // percentage 0-1
  carbs: number;
  fat: number;
}

export interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
}

const DEFAULT_SPLIT: MacroSplit = { protein: 0.3, carbs: 0.4, fat: 0.3 };

export function calculateMacroTargets(
  calories: number,
  split: MacroSplit = DEFAULT_SPLIT,
): MacroTargets {
  return {
    protein_g: Math.round((calories * split.protein) / 4),
    carbs_g: Math.round((calories * split.carbs) / 4),
    fat_g: Math.round((calories * split.fat) / 9),
    calories,
  };
}

// ── Free Tier Limit Checks ───────────────────────────────────────────

export interface UsageCounts {
  workout_logs_this_month: number;
  meal_logs_today: number;
  ai_messages_today: number;
}

export function isWithinFreeTierLimits(
  entitlement: EntitlementTier,
  usage: UsageCounts,
): boolean {
  if (entitlement !== 'free') {
    return true; // paid tiers have no limits
  }
  return (
    usage.workout_logs_this_month < FREE_TIER_LIMITS.workout_logs_per_month &&
    usage.meal_logs_today < FREE_TIER_LIMITS.meal_logs_per_day &&
    usage.ai_messages_today < FREE_TIER_LIMITS.ai_messages_per_day
  );
}
