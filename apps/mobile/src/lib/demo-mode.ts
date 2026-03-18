/**
 * Demo Mode — Pre-populated data for App Store review and investor demos.
 * Activate by signing in with demo@healthcoach.app / demo1234
 */

import type { CompletedSession, PersonalRecord, DayVolume } from '../types/workout';
import type {
  MealEntry,
  NutritionTargets,
  MacroTotals,
  UserSupplementEntry,
} from '../types/nutrition';

// ── Demo Credentials ─────────────────────────────────────────────────
export const DEMO_EMAIL = 'demo@healthcoach.app';
export const DEMO_PASSWORD = 'demo1234';

let _demoMode = false;

export function isDemoMode(): boolean {
  return _demoMode;
}

export function enableDemoMode(): void {
  _demoMode = true;
}

export function disableDemoMode(): void {
  _demoMode = false;
}

export function checkDemoCredentials(email: string, password: string): boolean {
  return email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

// ── Helper Dates ─────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ── Demo User Profile ───────────────────────────────────────────────

export const DEMO_PROFILE = {
  user_id: 'demo-user-001',
  display_name: 'Alex',
  date_of_birth: '1992-06-15',
  gender: 'male' as const,
  height_cm: 178,
  weight_kg: 82,
  unit_preference: 'metric' as const,
  fitness_goal: 'build_muscle' as const,
  experience_level: 'intermediate' as const,
  activity_level: 'moderately_active' as const,
  created_at: daysAgo(90),
  updated_at: daysAgo(0),
};

export const DEMO_COACH_PREFERENCES = {
  user_id: 'demo-user-001',
  coach_tone: 'balanced' as const,
  focus_areas: ['gain_muscle', 'build_lean_muscle'],
  dietary_restrictions: [] as string[],
  coaching_style: 'data_driven' as const,
};

// ── Demo Workout History (2 weeks, progressive overload) ─────────────

const workoutTemplates = [
  {
    name: 'Push Day — Chest & Shoulders',
    exercises: [
      { id: 'bench-press', name: 'Bench Press' },
      { id: 'overhead-press', name: 'Overhead Press' },
      { id: 'incline-db-press', name: 'Incline Dumbbell Press' },
      { id: 'lateral-raise', name: 'Lateral Raise' },
      { id: 'tricep-pushdown', name: 'Tricep Pushdown' },
    ],
  },
  {
    name: 'Pull Day — Back & Biceps',
    exercises: [
      { id: 'deadlift', name: 'Deadlift' },
      { id: 'barbell-row', name: 'Barbell Row' },
      { id: 'lat-pulldown', name: 'Lat Pulldown' },
      { id: 'face-pull', name: 'Face Pull' },
      { id: 'barbell-curl', name: 'Barbell Curl' },
    ],
  },
  {
    name: 'Legs — Quads & Hamstrings',
    exercises: [
      { id: 'squat', name: 'Barbell Squat' },
      { id: 'romanian-dl', name: 'Romanian Deadlift' },
      { id: 'leg-press', name: 'Leg Press' },
      { id: 'leg-curl', name: 'Leg Curl' },
      { id: 'calf-raise', name: 'Calf Raise' },
    ],
  },
];

function generateWorkoutSession(
  templateIndex: number,
  dayOffset: number,
  weekMultiplier: number,
): CompletedSession {
  const template = workoutTemplates[templateIndex % workoutTemplates.length];
  const baseWeights = [80, 50, 30, 12, 30]; // per exercise
  const baseReps = [8, 8, 10, 12, 12];

  const exercises = template.exercises.map((ex, i) => {
    const weight = baseWeights[i] + weekMultiplier * 2.5;
    const reps = baseReps[i];
    return {
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: Array.from({ length: 4 }, (_, s) => ({
        id: `demo-set-${dayOffset}-${i}-${s}`,
        setNumber: s + 1,
        setType: 'working' as const,
        weight: weight - s * 2.5,
        reps: reps - (s > 2 ? 1 : 0),
        rpe: 7 + s * 0.5,
        isPR: weekMultiplier > 0 && s === 0 && i === 0,
        completedAt: daysAgo(dayOffset),
      })),
    };
  });

  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const prCount = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isPR).length,
    0,
  );

  return {
    id: `demo-session-${dayOffset}`,
    userId: 'demo-user-001',
    name: template.name,
    startedAt: daysAgo(dayOffset),
    completedAt: daysAgo(dayOffset),
    durationSeconds: 3600 + Math.floor(Math.random() * 1200),
    exercises,
    totalVolume: Math.round(totalVolume),
    totalSets,
    prCount,
    notes: '',
    mood: 4,
  };
}

export function getDemoWorkoutHistory(): CompletedSession[] {
  const sessions: CompletedSession[] = [];
  // Week 1: days 13, 12, 10, 9, 7
  sessions.push(generateWorkoutSession(0, 13, 0));
  sessions.push(generateWorkoutSession(1, 12, 0));
  sessions.push(generateWorkoutSession(2, 10, 0));
  sessions.push(generateWorkoutSession(0, 9, 0));
  sessions.push(generateWorkoutSession(1, 7, 0));
  // Week 2 (more recent, progressive overload): days 6, 5, 3, 2, 1
  sessions.push(generateWorkoutSession(2, 6, 1));
  sessions.push(generateWorkoutSession(0, 5, 1));
  sessions.push(generateWorkoutSession(1, 3, 1));
  sessions.push(generateWorkoutSession(2, 2, 1));
  sessions.push(generateWorkoutSession(0, 1, 1));
  return sessions;
}

export function getDemoWeeklyVolume(): DayVolume[] {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const hasWorkout = [0, 1, 3, 4, 6].includes(i);
    return {
      date: dateStr(offset),
      volume: hasWorkout ? 8000 + Math.floor(Math.random() * 4000) : 0,
      sets: hasWorkout ? 16 + Math.floor(Math.random() * 8) : 0,
    };
  });
}

export function getDemoPersonalRecords(): PersonalRecord[] {
  return [
    {
      exerciseId: 'bench-press',
      heaviestWeight: { weight: 82.5, reps: 8, date: dateStr(1) },
      mostReps: { weight: 70, reps: 12, date: dateStr(5) },
      highestVolume: { weight: 75, reps: 10, volume: 750, date: dateStr(3) },
    },
    {
      exerciseId: 'squat',
      heaviestWeight: { weight: 120, reps: 6, date: dateStr(2) },
      mostReps: { weight: 100, reps: 10, date: dateStr(6) },
      highestVolume: { weight: 100, reps: 10, volume: 1000, date: dateStr(6) },
    },
    {
      exerciseId: 'deadlift',
      heaviestWeight: { weight: 140, reps: 5, date: dateStr(3) },
      mostReps: { weight: 110, reps: 8, date: dateStr(7) },
      highestVolume: { weight: 120, reps: 6, volume: 720, date: dateStr(3) },
    },
    {
      exerciseId: 'overhead-press',
      heaviestWeight: { weight: 52.5, reps: 8, date: dateStr(1) },
      mostReps: { weight: 40, reps: 12, date: dateStr(5) },
      highestVolume: { weight: 45, reps: 10, volume: 450, date: dateStr(5) },
    },
  ];
}

// ── Demo Nutrition Data (1 week) ─────────────────────────────────────

export const DEMO_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2600,
  protein_g: 180,
  carbs_g: 280,
  fat_g: 80,
  fiber_g: 35,
  water_oz: 100,
};

function generateDemoMeals(dayOffset: number): MealEntry[] {
  const date = dateStr(dayOffset);
  return [
    {
      id: `demo-meal-${dayOffset}-breakfast`,
      userId: 'demo-user-001',
      date,
      mealType: 'breakfast',
      name: 'Oatmeal & Eggs',
      items: [
        {
          id: `item-${dayOffset}-b1`,
          name: 'Oatmeal',
          calories: 300,
          protein_g: 10,
          carbs_g: 54,
          fat_g: 5,
          fiber_g: 8,
          quantity: 1,
          unit: 'cup',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-b2`,
          name: 'Scrambled Eggs',
          calories: 280,
          protein_g: 20,
          carbs_g: 2,
          fat_g: 21,
          fiber_g: 0,
          quantity: 3,
          unit: 'large',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-b3`,
          name: 'Banana',
          calories: 105,
          protein_g: 1.3,
          carbs_g: 27,
          fat_g: 0.4,
          fiber_g: 3.1,
          quantity: 1,
          unit: 'medium',
          is_estimate: false,
        },
      ],
      source: 'manual',
      timestamp: `${date}T08:30:00Z`,
    },
    {
      id: `demo-meal-${dayOffset}-lunch`,
      userId: 'demo-user-001',
      date,
      mealType: 'lunch',
      name: 'Chicken Rice Bowl',
      items: [
        {
          id: `item-${dayOffset}-l1`,
          name: 'Grilled Chicken Breast',
          calories: 330,
          protein_g: 62,
          carbs_g: 0,
          fat_g: 7,
          fiber_g: 0,
          quantity: 250,
          unit: 'g',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-l2`,
          name: 'Brown Rice',
          calories: 340,
          protein_g: 8,
          carbs_g: 72,
          fat_g: 3,
          fiber_g: 4,
          quantity: 1.5,
          unit: 'cups',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-l3`,
          name: 'Mixed Vegetables',
          calories: 80,
          protein_g: 4,
          carbs_g: 15,
          fat_g: 0.5,
          fiber_g: 5,
          quantity: 1,
          unit: 'cup',
          is_estimate: false,
        },
      ],
      source: 'text',
      timestamp: `${date}T12:30:00Z`,
    },
    {
      id: `demo-meal-${dayOffset}-snack`,
      userId: 'demo-user-001',
      date,
      mealType: 'snack',
      name: 'Protein Shake',
      items: [
        {
          id: `item-${dayOffset}-s1`,
          name: 'Whey Protein Shake',
          calories: 200,
          protein_g: 40,
          carbs_g: 8,
          fat_g: 2,
          fiber_g: 0,
          quantity: 2,
          unit: 'scoops',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-s2`,
          name: 'Almonds',
          calories: 160,
          protein_g: 6,
          carbs_g: 6,
          fat_g: 14,
          fiber_g: 3.5,
          quantity: 28,
          unit: 'g',
          is_estimate: false,
        },
      ],
      source: 'manual',
      timestamp: `${date}T15:30:00Z`,
    },
    {
      id: `demo-meal-${dayOffset}-dinner`,
      userId: 'demo-user-001',
      date,
      mealType: 'dinner',
      name: 'Salmon & Sweet Potato',
      items: [
        {
          id: `item-${dayOffset}-d1`,
          name: 'Grilled Salmon',
          calories: 350,
          protein_g: 38,
          carbs_g: 0,
          fat_g: 20,
          fiber_g: 0,
          quantity: 200,
          unit: 'g',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-d2`,
          name: 'Sweet Potato',
          calories: 180,
          protein_g: 4,
          carbs_g: 41,
          fat_g: 0.3,
          fiber_g: 6,
          quantity: 1,
          unit: 'large',
          is_estimate: false,
        },
        {
          id: `item-${dayOffset}-d3`,
          name: 'Broccoli',
          calories: 55,
          protein_g: 3.7,
          carbs_g: 11,
          fat_g: 0.6,
          fiber_g: 5.1,
          quantity: 1,
          unit: 'cup',
          is_estimate: false,
        },
      ],
      source: 'photo',
      timestamp: `${date}T19:00:00Z`,
    },
  ];
}

export function getDemoNutritionWeek(): { date: string; meals: MealEntry[]; consumed: MacroTotals }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const meals = generateDemoMeals(6 - i);
    const consumed = meals.reduce(
      (acc, meal) => {
        meal.items.forEach((item) => {
          acc.calories += item.calories;
          acc.protein_g += item.protein_g;
          acc.carbs_g += item.carbs_g;
          acc.fat_g += item.fat_g;
          acc.fiber_g += item.fiber_g;
        });
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    );
    return { date: dateStr(6 - i), meals, consumed };
  });
}

export function getDemoTodayNutrition(): { meals: MealEntry[]; consumed: MacroTotals } {
  const meals = generateDemoMeals(0);
  const consumed = meals.reduce(
    (acc, meal) => {
      meal.items.forEach((item) => {
        acc.calories += item.calories;
        acc.protein_g += item.protein_g;
        acc.carbs_g += item.carbs_g;
        acc.fat_g += item.fat_g;
        acc.fiber_g += item.fiber_g;
      });
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );
  return { meals, consumed };
}

// ── Demo Coach Conversations ────────────────────────────────────────

export function getDemoCoachMessages() {
  return [
    {
      id: 'demo-msg-1',
      conversation_id: 'demo-conv-1',
      role: 'user' as const,
      content: "I've been doing PPL for 2 weeks. Am I progressing well?",
      created_at: daysAgo(3),
    },
    {
      id: 'demo-msg-2',
      conversation_id: 'demo-conv-1',
      role: 'assistant' as const,
      content:
        "Great progress, Alex! Looking at your workout data:\n\n📈 **Bench Press**: Up 2.5kg from last week (80 → 82.5kg)\n📈 **Squat**: Solid at 120kg for 6 reps\n📈 **Deadlift**: 140kg PR — impressive!\n\nYour volume has been consistent at 5 sessions/week. I'd suggest:\n\n1. **Deload next week** — you've been pushing hard for 2 weeks straight\n2. **Add 1 more set** to lateral raises for shoulder development\n3. **Consider bumping protein** — you're averaging 170g but targeting 180g\n\nOverall, you're on track. Keep it up! 💪",
      created_at: daysAgo(3),
    },
    {
      id: 'demo-msg-3',
      conversation_id: 'demo-conv-1',
      role: 'user' as const,
      content: 'What should I eat pre-workout?',
      created_at: daysAgo(1),
    },
    {
      id: 'demo-msg-4',
      conversation_id: 'demo-conv-1',
      role: 'assistant' as const,
      content:
        "For your goals (muscle building, intermediate level), here's what I recommend 60-90 minutes pre-workout:\n\n🍽️ **Option 1**: Oatmeal + banana + scoop of whey (~400 cal, 30g protein, 55g carbs)\n🍽️ **Option 2**: Rice cakes with peanut butter + protein shake (~350 cal, 35g protein, 40g carbs)\n🍽️ **Option 3**: Chicken + rice (lighter portion) (~400 cal, 35g protein, 45g carbs)\n\n**Key principles:**\n- Aim for 30-40g protein + 40-60g carbs\n- Keep fat moderate (under 15g) for faster digestion\n- Avoid high-fiber foods right before training\n- Hydrate with 500ml water\n\nBased on your logs, your morning oatmeal & eggs is actually a solid pre-workout meal! Just time it 60-90 min before your session.",
      created_at: daysAgo(1),
    },
  ];
}

// ── Demo Supplements ────────────────────────────────────────────────

export function getDemoSupplements(): UserSupplementEntry[] {
  return [
    {
      id: 'demo-supp-1',
      userId: 'demo-user-001',
      supplementId: 'creatine',
      supplementName: 'Creatine Monohydrate',
      dose: '5',
      unit: 'g',
      frequency: 'daily',
      timeOfDay: 'morning',
      isActive: true,
      streak: 14,
      lastTakenDate: dateStr(0),
      createdAt: daysAgo(30),
    },
    {
      id: 'demo-supp-2',
      userId: 'demo-user-001',
      supplementId: 'vitamin-d',
      supplementName: 'Vitamin D3',
      dose: '5000',
      unit: 'IU',
      frequency: 'daily',
      timeOfDay: 'morning',
      isActive: true,
      streak: 10,
      lastTakenDate: dateStr(0),
      createdAt: daysAgo(30),
    },
    {
      id: 'demo-supp-3',
      userId: 'demo-user-001',
      supplementId: 'omega3',
      supplementName: 'Omega-3 Fish Oil',
      dose: '2',
      unit: 'capsules',
      frequency: 'daily',
      timeOfDay: 'with_meals',
      isActive: true,
      streak: 7,
      lastTakenDate: dateStr(0),
      createdAt: daysAgo(30),
    },
  ];
}

// ── Demo Streak & Stats ─────────────────────────────────────────────

export const DEMO_STREAK = {
  currentStreak: 12,
  longestStreak: 12,
  totalWorkouts: 10,
  totalMealsLogged: 28,
  activeDays: 12,
};

// ── Demo Health Data ────────────────────────────────────────────────

export const DEMO_HEALTH_DATA = {
  todaySteps: 8247,
  todayActiveEnergy: 524,
  lastSleepHours: 7.5,
  recentWeight: 82,
};
