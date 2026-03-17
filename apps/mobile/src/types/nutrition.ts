// ── Meal Types ──────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealSource = 'manual' | 'text' | 'photo' | 'quick_add' | 'saved_meal';

// ── Nutrition Targets ──────────────────────────────────────────────

export interface NutritionTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
}

// ── Macro Totals ───────────────────────────────────────────────────

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

// ── Meal Item ──────────────────────────────────────────────────────

export interface MealItemEntry {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity: number;
  unit: string;
  is_estimate: boolean;
}

// ── Meal Entry ─────────────────────────────────────────────────────

export interface MealEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  name: string;
  items: MealItemEntry[];
  source: MealSource;
  photoUri?: string;
  timestamp: string; // ISO string
  notes?: string;
}

// ── Saved Meal Template ────────────────────────────────────────────

export interface SavedMealEntry {
  id: string;
  userId: string;
  name: string;
  items: MealItemEntry[];
  mealType: MealType;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Quick Add ──────────────────────────────────────────────────────

export interface QuickAddEntry {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ── Daily Nutrition Log ────────────────────────────────────────────

export interface DailyNutritionLog {
  date: string; // YYYY-MM-DD
  userId: string;
  targets: NutritionTargets;
  consumed: MacroTotals;
  waterIntake_ml: number;
  meals: MealEntry[];
  supplementsTaken: string[]; // supplement IDs taken today
}

// ── Supplements ────────────────────────────────────────────────────

export interface SupplementEntry {
  id: string;
  name: string;
  category: string;
  defaultDose: string;
  defaultUnit: string;
  description: string;
  benefits: string[];
}

export interface UserSupplementEntry {
  id: string;
  userId: string;
  supplementId: string;
  supplementName: string;
  dose: string;
  unit: string;
  frequency: 'daily' | 'twice_daily' | 'weekly' | 'as_needed';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'with_meals' | 'any';
  isActive: boolean;
  streak: number;
  lastTakenDate?: string; // YYYY-MM-DD
  createdAt: string;
}

// ── Recipe ─────────────────────────────────────────────────────────

export interface RecipeEntry {
  id: string;
  userId: string;
  name: string;
  description: string;
  items: MealItemEntry[];
  servings: number;
  createdAt: string;
  updatedAt: string;
}

// ── Food Database Item ─────────────────────────────────────────────

export interface FoodDatabaseItem {
  id: string;
  name: string;
  category: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  aliases?: string[];
}

// ── Macro Split Presets ────────────────────────────────────────────

export type MacroSplitPreset = 'balanced' | 'high_protein' | 'low_carb' | 'keto' | 'custom';

export interface MacroSplit {
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

export const MACRO_SPLIT_PRESETS: Record<Exclude<MacroSplitPreset, 'custom'>, MacroSplit> = {
  balanced: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
  high_protein: { protein_pct: 40, carbs_pct: 30, fat_pct: 30 },
  low_carb: { protein_pct: 35, carbs_pct: 25, fat_pct: 40 },
  keto: { protein_pct: 35, carbs_pct: 5, fat_pct: 60 },
};

// ── Analytics Payloads ─────────────────────────────────────────────

export interface MealLoggedPayload {
  source: MealSource;
  mealType: MealType;
  itemCount: number;
  totalCalories: number;
}

export interface MealPhotoReviewedPayload {
  items_edited: boolean;
  items_count: number;
}

export interface NutritionTargetsSetPayload {
  calories: number;
  preset: MacroSplitPreset;
}
