import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  NutritionTargets,
  DailyNutritionLog,
  MealEntry,
  MealItemEntry,
  SavedMealEntry,
  SupplementEntry,
  UserSupplementEntry,
  RecipeEntry,
  MealType,
  MealSource,
  MacroTotals,
} from '../types/nutrition';
import { calculateDailyTotals, generateNutritionId, getDateString } from '../lib/nutrition-utils';

// ── Storage Keys ──────────────────────────────────────────────────

const STORAGE_KEYS = {
  DAILY_LOGS: '@nutrition/daily_logs',
  SAVED_MEALS: '@nutrition/saved_meals',
  SUPPLEMENTS: '@nutrition/user_supplements',
  TARGETS: '@nutrition/targets',
  RECIPES: '@nutrition/recipes',
} as const;

// ── Default Targets ───────────────────────────────────────────────

const DEFAULT_TARGETS: NutritionTargets = {
  calories: 2200,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 70,
  fiber_g: 30,
  water_ml: 2500,
};

// ── Supplement Catalog ────────────────────────────────────────────

const SUPPLEMENT_CATALOG: SupplementEntry[] = [
  { id: 'sup_vitd', name: 'Vitamin D3', category: 'vitamin', defaultDose: '2000', defaultUnit: 'IU', description: 'Supports bone health and immune function', benefits: ['Bone health', 'Immune support', 'Mood regulation'] },
  { id: 'sup_omega3', name: 'Omega-3 Fish Oil', category: 'essential fatty acid', defaultDose: '1000', defaultUnit: 'mg', description: 'Supports heart and brain health', benefits: ['Heart health', 'Brain function', 'Anti-inflammatory'] },
  { id: 'sup_mag', name: 'Magnesium', category: 'mineral', defaultDose: '400', defaultUnit: 'mg', description: 'Supports muscle and nerve function', benefits: ['Muscle recovery', 'Sleep quality', 'Stress reduction'] },
  { id: 'sup_creatine', name: 'Creatine Monohydrate', category: 'performance', defaultDose: '5', defaultUnit: 'g', description: 'Enhances strength and muscle mass', benefits: ['Strength gains', 'Muscle growth', 'Recovery'] },
  { id: 'sup_whey', name: 'Whey Protein', category: 'protein', defaultDose: '30', defaultUnit: 'g', description: 'Fast-absorbing protein for muscle recovery', benefits: ['Muscle recovery', 'Protein intake', 'Convenience'] },
  { id: 'sup_multi', name: 'Multivitamin', category: 'vitamin', defaultDose: '1', defaultUnit: 'tablet', description: 'Comprehensive vitamin and mineral support', benefits: ['Nutritional gaps', 'General health', 'Energy'] },
  { id: 'sup_zinc', name: 'Zinc', category: 'mineral', defaultDose: '15', defaultUnit: 'mg', description: 'Supports immune function and recovery', benefits: ['Immune support', 'Testosterone', 'Wound healing'] },
  { id: 'sup_probiotic', name: 'Probiotic', category: 'gut health', defaultDose: '1', defaultUnit: 'capsule', description: 'Supports digestive health', benefits: ['Gut health', 'Digestion', 'Immune support'] },
];

// ── Seed Data ─────────────────────────────────────────────────────

function getSeedSavedMeals(): SavedMealEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'sm_chicken_rice',
      userId: 'local_user',
      name: 'Chicken and Rice Bowl',
      mealType: 'lunch',
      useCount: 5,
      createdAt: now,
      updatedAt: now,
      items: [
        { id: 'smi_1', name: 'Chicken Breast', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'smi_2', name: 'White Rice (cooked)', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup', is_estimate: false },
        { id: 'smi_3', name: 'Broccoli', calories: 31, protein_g: 2.6, carbs_g: 6, fat_g: 0.3, fiber_g: 2.4, quantity: 1, unit: 'cup', is_estimate: false },
      ],
    },
    {
      id: 'sm_protein_smoothie',
      userId: 'local_user',
      name: 'Protein Smoothie',
      mealType: 'snack',
      useCount: 8,
      createdAt: now,
      updatedAt: now,
      items: [
        { id: 'smi_4', name: 'Whey Protein Scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0, quantity: 1, unit: 'scoop', is_estimate: false },
        { id: 'smi_5', name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, quantity: 1, unit: 'medium', is_estimate: false },
        { id: 'smi_6', name: 'Almond Milk', calories: 39, protein_g: 1.5, carbs_g: 3.4, fat_g: 2.5, fiber_g: 0.5, quantity: 1, unit: 'cup', is_estimate: false },
        { id: 'smi_7', name: 'Peanut Butter', calories: 94, protein_g: 3.5, carbs_g: 3.5, fat_g: 8, fiber_g: 0.8, quantity: 1, unit: 'tbsp', is_estimate: false },
      ],
    },
    {
      id: 'sm_overnight_oats',
      userId: 'local_user',
      name: 'Overnight Oats',
      mealType: 'breakfast',
      useCount: 3,
      createdAt: now,
      updatedAt: now,
      items: [
        { id: 'smi_8', name: 'Oats (dry)', calories: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.7, fiber_g: 4, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'smi_9', name: 'Greek Yogurt (plain)', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'smi_10', name: 'Blueberries', calories: 42, protein_g: 0.5, carbs_g: 10.5, fat_g: 0.25, fiber_g: 1.8, quantity: 0.5, unit: 'cup', is_estimate: false },
        { id: 'smi_11', name: 'Honey', calories: 64, protein_g: 0.1, carbs_g: 17, fat_g: 0, fiber_g: 0, quantity: 1, unit: 'tbsp', is_estimate: false },
      ],
    },
    {
      id: 'sm_grilled_salmon',
      userId: 'local_user',
      name: 'Grilled Salmon Plate',
      mealType: 'dinner',
      useCount: 2,
      createdAt: now,
      updatedAt: now,
      items: [
        { id: 'smi_12', name: 'Salmon Fillet', calories: 312, protein_g: 34, carbs_g: 0, fat_g: 18.5, fiber_g: 0, quantity: 1, unit: 'fillet', is_estimate: false },
        { id: 'smi_13', name: 'Sweet Potato', calories: 129, protein_g: 2.4, carbs_g: 30, fat_g: 0.1, fiber_g: 4.5, quantity: 1, unit: 'medium', is_estimate: false },
        { id: 'smi_14', name: 'Mixed Salad', calories: 15, protein_g: 1.3, carbs_g: 2.4, fat_g: 0.2, fiber_g: 1.8, quantity: 1, unit: 'bowl', is_estimate: false },
        { id: 'smi_15', name: 'Olive Oil', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5, fiber_g: 0, quantity: 1, unit: 'tbsp', is_estimate: false },
      ],
    },
  ];
}

function getSeedDayMeals(): MealEntry[] {
  const today = getDateString();
  const now = new Date();

  return [
    {
      id: 'seed_meal_1',
      userId: 'local_user',
      date: today,
      mealType: 'breakfast',
      name: 'Overnight Oats',
      source: 'saved_meal',
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30).toISOString(),
      items: [
        { id: 'sd_1', name: 'Oats (dry)', calories: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.7, fiber_g: 4, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'sd_2', name: 'Greek Yogurt (plain)', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'sd_3', name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, quantity: 1, unit: 'medium', is_estimate: false },
        { id: 'sd_4', name: 'Honey', calories: 64, protein_g: 0.1, carbs_g: 17, fat_g: 0, fiber_g: 0, quantity: 1, unit: 'tbsp', is_estimate: false },
      ],
    },
    {
      id: 'seed_meal_2',
      userId: 'local_user',
      date: today,
      mealType: 'lunch',
      name: 'Chicken and Rice Bowl',
      source: 'manual',
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 15).toISOString(),
      items: [
        { id: 'sd_5', name: 'Chicken Breast', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: false },
        { id: 'sd_6', name: 'Brown Rice (cooked)', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 1.8, fiber_g: 3.5, quantity: 1, unit: 'cup', is_estimate: false },
        { id: 'sd_7', name: 'Broccoli', calories: 31, protein_g: 2.6, carbs_g: 6, fat_g: 0.3, fiber_g: 2.4, quantity: 1, unit: 'cup', is_estimate: false },
      ],
    },
    {
      id: 'seed_meal_3',
      userId: 'local_user',
      date: today,
      mealType: 'snack',
      name: 'Protein Smoothie',
      source: 'saved_meal',
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0).toISOString(),
      items: [
        { id: 'sd_8', name: 'Whey Protein Scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0, quantity: 1, unit: 'scoop', is_estimate: false },
        { id: 'sd_9', name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, quantity: 1, unit: 'medium', is_estimate: false },
        { id: 'sd_10', name: 'Almond Milk', calories: 39, protein_g: 1.5, carbs_g: 3.4, fat_g: 2.5, fiber_g: 0.5, quantity: 1, unit: 'cup', is_estimate: false },
      ],
    },
  ];
}

// ── State ─────────────────────────────────────────────────────────

interface NutritionState {
  // Data
  selectedDate: string;
  dailyLogs: Record<string, DailyNutritionLog>;
  savedMeals: SavedMealEntry[];
  userSupplements: UserSupplementEntry[];
  supplementCatalog: SupplementEntry[];
  recipes: RecipeEntry[];
  targets: NutritionTargets;
  isInitialized: boolean;

  // Computed getters
  todayLog: () => DailyNutritionLog;
  todayMeals: () => MealEntry[];
  todayConsumed: () => MacroTotals;
  todayWater: () => number;

  // Actions - Initialization
  initialize: () => Promise<void>;

  // Actions - Date
  setSelectedDate: (date: string) => void;

  // Actions - Meals
  logMeal: (meal: Omit<MealEntry, 'id' | 'userId' | 'date'>) => void;
  addMealItem: (mealId: string, item: MealItemEntry) => void;
  editMealItem: (mealId: string, itemId: string, updates: Partial<MealItemEntry>) => void;
  removeMealItem: (mealId: string, itemId: string) => void;
  deleteMeal: (mealId: string) => void;
  quickAddCalories: (name: string, calories: number, protein_g: number, carbs_g: number, fat_g: number, mealType: MealType) => void;

  // Actions - Saved Meals
  saveMealAsTemplate: (meal: MealEntry) => void;
  deleteSavedMeal: (savedMealId: string) => void;
  logSavedMeal: (savedMealId: string, mealType: MealType) => void;

  // Actions - Supplements
  addUserSupplement: (supplementId: string, dose: string, unit: string, frequency: UserSupplementEntry['frequency'], timeOfDay: UserSupplementEntry['timeOfDay']) => void;
  removeUserSupplement: (userSupplementId: string) => void;
  logSupplement: (userSupplementId: string) => void;
  unlogSupplement: (userSupplementId: string) => void;

  // Actions - Water
  logWater: (amount_ml: number) => void;
  setWater: (amount_ml: number) => void;

  // Actions - Targets
  setDailyTargets: (targets: NutritionTargets) => void;

  // Actions - Recipes
  addRecipe: (recipe: Omit<RecipeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  deleteRecipe: (recipeId: string) => void;
  logRecipe: (recipeId: string, mealType: MealType) => void;

  // Actions - Persistence
  persistAll: () => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────

export const useNutritionStore = create<NutritionState>((set, get) => ({
  selectedDate: getDateString(),
  dailyLogs: {},
  savedMeals: [],
  userSupplements: [],
  supplementCatalog: SUPPLEMENT_CATALOG,
  recipes: [],
  targets: DEFAULT_TARGETS,
  isInitialized: false,

  // ── Computed ────────────────────────────────────────────────────

  todayLog: () => {
    const state = get();
    const date = state.selectedDate;
    return state.dailyLogs[date] ?? {
      date,
      userId: 'local_user',
      targets: state.targets,
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      waterIntake_ml: 0,
      meals: [],
      supplementsTaken: [],
    };
  },

  todayMeals: () => {
    const state = get();
    const log = state.dailyLogs[state.selectedDate];
    return log?.meals ?? [];
  },

  todayConsumed: () => {
    const meals = get().todayMeals();
    return calculateDailyTotals(meals);
  },

  todayWater: () => {
    const state = get();
    const log = state.dailyLogs[state.selectedDate];
    return log?.waterIntake_ml ?? 0;
  },

  // ── Initialize ──────────────────────────────────────────────────

  initialize: async () => {
    try {
      const [storedLogs, storedSaved, storedSupplements, storedTargets, storedRecipes] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DAILY_LOGS),
        AsyncStorage.getItem(STORAGE_KEYS.SAVED_MEALS),
        AsyncStorage.getItem(STORAGE_KEYS.SUPPLEMENTS),
        AsyncStorage.getItem(STORAGE_KEYS.TARGETS),
        AsyncStorage.getItem(STORAGE_KEYS.RECIPES),
      ]);

      const dailyLogs: Record<string, DailyNutritionLog> = storedLogs
        ? JSON.parse(storedLogs)
        : {};

      const savedMeals: SavedMealEntry[] = storedSaved
        ? JSON.parse(storedSaved)
        : getSeedSavedMeals();

      const userSupplements: UserSupplementEntry[] = storedSupplements
        ? JSON.parse(storedSupplements)
        : [];

      const targets: NutritionTargets = storedTargets
        ? JSON.parse(storedTargets)
        : DEFAULT_TARGETS;

      const recipes: RecipeEntry[] = storedRecipes
        ? JSON.parse(storedRecipes)
        : [];

      // Seed today's meals if no data exists
      const today = getDateString();
      if (!storedLogs && !dailyLogs[today]) {
        const seedMeals = getSeedDayMeals();
        const consumed = calculateDailyTotals(seedMeals);
        dailyLogs[today] = {
          date: today,
          userId: 'local_user',
          targets,
          consumed,
          waterIntake_ml: 1500,
          meals: seedMeals,
          supplementsTaken: [],
        };
      }

      set({
        dailyLogs,
        savedMeals,
        userSupplements,
        targets,
        recipes,
        isInitialized: true,
      });

      // Persist seed data
      if (!storedSaved) {
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_MEALS, JSON.stringify(savedMeals));
      }
      if (!storedLogs) {
        await AsyncStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(dailyLogs));
      }
    } catch {
      set({
        dailyLogs: {},
        savedMeals: getSeedSavedMeals(),
        userSupplements: [],
        targets: DEFAULT_TARGETS,
        recipes: [],
        isInitialized: true,
      });
    }
  },

  // ── Date ────────────────────────────────────────────────────────

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  // ── Meals ───────────────────────────────────────────────────────

  logMeal: (mealData) => {
    const state = get();
    const date = state.selectedDate;
    const meal: MealEntry = {
      ...mealData,
      id: generateNutritionId('meal'),
      userId: 'local_user',
      date,
    };

    const log = state.dailyLogs[date] ?? {
      date,
      userId: 'local_user',
      targets: state.targets,
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      waterIntake_ml: 0,
      meals: [],
      supplementsTaken: [],
    };

    const meals = [...log.meals, meal];
    const consumed = calculateDailyTotals(meals);

    const dailyLogs = {
      ...state.dailyLogs,
      [date]: { ...log, meals, consumed },
    };

    set({ dailyLogs });
    get().persistAll();
  },

  addMealItem: (mealId, item) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date];
    if (!log) return;

    const meals = log.meals.map((m) =>
      m.id === mealId ? { ...m, items: [...m.items, item] } : m,
    );
    const consumed = calculateDailyTotals(meals);

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, meals, consumed },
      },
    });
    get().persistAll();
  },

  editMealItem: (mealId, itemId, updates) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date];
    if (!log) return;

    const meals = log.meals.map((m) => {
      if (m.id !== mealId) return m;
      return {
        ...m,
        items: m.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item,
        ),
      };
    });
    const consumed = calculateDailyTotals(meals);

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, meals, consumed },
      },
    });
    get().persistAll();
  },

  removeMealItem: (mealId, itemId) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date];
    if (!log) return;

    const meals = log.meals.map((m) => {
      if (m.id !== mealId) return m;
      return { ...m, items: m.items.filter((item) => item.id !== itemId) };
    });
    const consumed = calculateDailyTotals(meals);

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, meals, consumed },
      },
    });
    get().persistAll();
  },

  deleteMeal: (mealId) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date];
    if (!log) return;

    const meals = log.meals.filter((m) => m.id !== mealId);
    const consumed = calculateDailyTotals(meals);

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, meals, consumed },
      },
    });
    get().persistAll();
  },

  quickAddCalories: (name, calories, protein_g, carbs_g, fat_g, mealType) => {
    get().logMeal({
      mealType,
      name: name || 'Quick Add',
      source: 'quick_add',
      timestamp: new Date().toISOString(),
      items: [
        {
          id: generateNutritionId('mi'),
          name: name || 'Quick Add',
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g: 0,
          quantity: 1,
          unit: 'serving',
          is_estimate: true,
        },
      ],
    });
  },

  // ── Saved Meals ─────────────────────────────────────────────────

  saveMealAsTemplate: (meal) => {
    const now = new Date().toISOString();
    const saved: SavedMealEntry = {
      id: generateNutritionId('sm'),
      userId: 'local_user',
      name: meal.name,
      items: meal.items,
      mealType: meal.mealType,
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      savedMeals: [...state.savedMeals, saved],
    }));
    get().persistAll();
  },

  deleteSavedMeal: (savedMealId) => {
    set((state) => ({
      savedMeals: state.savedMeals.filter((m) => m.id !== savedMealId),
    }));
    get().persistAll();
  },

  logSavedMeal: (savedMealId, mealType) => {
    const state = get();
    const saved = state.savedMeals.find((m) => m.id === savedMealId);
    if (!saved) return;

    // Increment use count
    set({
      savedMeals: state.savedMeals.map((m) =>
        m.id === savedMealId
          ? { ...m, useCount: m.useCount + 1, updatedAt: new Date().toISOString() }
          : m,
      ),
    });

    // Log the meal with new item IDs
    get().logMeal({
      mealType,
      name: saved.name,
      source: 'saved_meal',
      timestamp: new Date().toISOString(),
      items: saved.items.map((item) => ({
        ...item,
        id: generateNutritionId('mi'),
      })),
    });
  },

  // ── Supplements ─────────────────────────────────────────────────

  addUserSupplement: (supplementId, dose, unit, frequency, timeOfDay) => {
    const catalog = get().supplementCatalog.find((s) => s.id === supplementId);
    if (!catalog) return;

    const supp: UserSupplementEntry = {
      id: generateNutritionId('us'),
      userId: 'local_user',
      supplementId,
      supplementName: catalog.name,
      dose,
      unit,
      frequency,
      timeOfDay,
      isActive: true,
      streak: 0,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      userSupplements: [...state.userSupplements, supp],
    }));
    get().persistAll();
  },

  removeUserSupplement: (userSupplementId) => {
    set((state) => ({
      userSupplements: state.userSupplements.filter((s) => s.id !== userSupplementId),
    }));
    get().persistAll();
  },

  logSupplement: (userSupplementId) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date] ?? {
      date,
      userId: 'local_user',
      targets: state.targets,
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      waterIntake_ml: 0,
      meals: [],
      supplementsTaken: [],
    };

    if (log.supplementsTaken.includes(userSupplementId)) return;

    const supplementsTaken = [...log.supplementsTaken, userSupplementId];

    // Update streak
    const userSupplements = state.userSupplements.map((s) => {
      if (s.id !== userSupplementId) return s;
      const wasYesterdayTaken = s.lastTakenDate === getDateString(new Date(Date.now() - 86400000));
      return {
        ...s,
        streak: wasYesterdayTaken ? s.streak + 1 : 1,
        lastTakenDate: date,
      };
    });

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, supplementsTaken },
      },
      userSupplements,
    });
    get().persistAll();
  },

  unlogSupplement: (userSupplementId) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date];
    if (!log) return;

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: {
          ...log,
          supplementsTaken: log.supplementsTaken.filter((id) => id !== userSupplementId),
        },
      },
    });
    get().persistAll();
  },

  // ── Water ───────────────────────────────────────────────────────

  logWater: (amount_ml) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date] ?? {
      date,
      userId: 'local_user',
      targets: state.targets,
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      waterIntake_ml: 0,
      meals: [],
      supplementsTaken: [],
    };

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, waterIntake_ml: log.waterIntake_ml + amount_ml },
      },
    });
    get().persistAll();
  },

  setWater: (amount_ml) => {
    const state = get();
    const date = state.selectedDate;
    const log = state.dailyLogs[date] ?? {
      date,
      userId: 'local_user',
      targets: state.targets,
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      waterIntake_ml: 0,
      meals: [],
      supplementsTaken: [],
    };

    set({
      dailyLogs: {
        ...state.dailyLogs,
        [date]: { ...log, waterIntake_ml: Math.max(0, amount_ml) },
      },
    });
    get().persistAll();
  },

  // ── Targets ─────────────────────────────────────────────────────

  setDailyTargets: (targets) => {
    set({ targets });
    AsyncStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(targets));
  },

  // ── Recipes ─────────────────────────────────────────────────────

  addRecipe: (recipeData) => {
    const now = new Date().toISOString();
    const recipe: RecipeEntry = {
      ...recipeData,
      id: generateNutritionId('rcp'),
      userId: 'local_user',
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      recipes: [...state.recipes, recipe],
    }));
    get().persistAll();
  },

  deleteRecipe: (recipeId) => {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== recipeId),
    }));
    get().persistAll();
  },

  logRecipe: (recipeId, mealType) => {
    const state = get();
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    get().logMeal({
      mealType,
      name: recipe.name,
      source: 'manual',
      timestamp: new Date().toISOString(),
      items: recipe.items.map((item) => ({
        ...item,
        id: generateNutritionId('mi'),
      })),
    });
  },

  // ── Persistence ─────────────────────────────────────────────────

  persistAll: async () => {
    const state = get();
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(state.dailyLogs)),
      AsyncStorage.setItem(STORAGE_KEYS.SAVED_MEALS, JSON.stringify(state.savedMeals)),
      AsyncStorage.setItem(STORAGE_KEYS.SUPPLEMENTS, JSON.stringify(state.userSupplements)),
      AsyncStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(state.recipes)),
    ]);
  },
}));
