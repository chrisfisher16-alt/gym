// ── Training Space Store ──────────────────────────────────────────────
// Arc Browser-style "Spaces" for switching training phases (Cut, Bulk, etc.)
// Each space can override nutrition targets, active program, and coach tone.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachTone } from '@health-coach/shared';

// ── Types ────────────────────────────────────────────────────────────

export interface SpaceNutritionTargets {
  calories?: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
}

export interface TrainingSpace {
  id: string;
  name: string;
  icon: string; // Ionicons name
  accentColor?: string;
  nutritionTargets?: SpaceNutritionTargets;
  activeProgram?: string; // program ID to auto-activate
  coachTone?: CoachTone;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
}

// ── Default Templates ────────────────────────────────────────────────
// Available as starting points when creating a new space.

export const SPACE_TEMPLATES: Omit<TrainingSpace, 'id' | 'createdAt'>[] = [
  {
    name: 'Cutting',
    icon: 'flame-outline',
    accentColor: '#EF4444',
    description: 'Lower calories, higher protein, cardio emphasis',
    nutritionTargets: {
      calories: 1800,
      proteinGrams: 180,
      carbGrams: 150,
      fatGrams: 55,
    },
    coachTone: 'direct',
  },
  {
    name: 'Bulking',
    icon: 'barbell-outline',
    accentColor: '#3B82F6',
    description: 'Higher calories, balanced macros, strength emphasis',
    nutritionTargets: {
      calories: 2800,
      proteinGrams: 170,
      carbGrams: 350,
      fatGrams: 85,
    },
    coachTone: 'encouraging',
  },
  {
    name: 'Maintenance',
    icon: 'fitness-outline',
    accentColor: '#10B981',
    description: 'Maintenance calories, balanced approach',
    nutritionTargets: {
      calories: 2200,
      proteinGrams: 150,
      carbGrams: 250,
      fatGrams: 70,
    },
    coachTone: 'balanced',
  },
];

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SPACES: '@spaces/data',
  ACTIVE_SPACE: '@spaces/active',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function generateSpaceId(): string {
  return `space_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── State ───────────────────────────────────────────────────────────

interface SpaceState {
  spaces: TrainingSpace[];
  activeSpaceId: string | null;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  createSpace: (space: Omit<TrainingSpace, 'id' | 'createdAt'>) => string;
  updateSpace: (id: string, updates: Partial<Omit<TrainingSpace, 'id' | 'createdAt'>>) => void;
  deleteSpace: (id: string) => void;
  switchSpace: (id: string) => void;
  getActiveSpace: () => TrainingSpace | null;
  reset: () => Promise<void>;
}

// ── Side Effects ────────────────────────────────────────────────────
// Apply space overrides to other stores when switching.

function applySpaceSideEffects(space: TrainingSpace): void {
  // 1. Nutrition targets
  if (space.nutritionTargets) {
    try {
      const { useNutritionStore } = require('./nutrition-store');
      const currentTargets = useNutritionStore.getState().targets;
      const merged = {
        ...currentTargets,
        ...(space.nutritionTargets.calories != null && { calories: space.nutritionTargets.calories }),
        ...(space.nutritionTargets.proteinGrams != null && { protein_g: space.nutritionTargets.proteinGrams }),
        ...(space.nutritionTargets.carbGrams != null && { carbs_g: space.nutritionTargets.carbGrams }),
        ...(space.nutritionTargets.fatGrams != null && { fat_g: space.nutritionTargets.fatGrams }),
      };
      useNutritionStore.getState().setDailyTargets(merged);
    } catch {
      // nutrition-store not available
    }
  }

  // 2. Active program
  if (space.activeProgram) {
    try {
      const { useWorkoutStore } = require('./workout-store');
      useWorkoutStore.getState().setActiveProgram(space.activeProgram);
    } catch {
      // workout-store not available
    }
  }

  // 3. Coach tone
  if (space.coachTone) {
    try {
      const { useAuthStore } = require('./auth-store');
      const currentPrefs = useAuthStore.getState().coachPreferences;
      useAuthStore.getState().setCoachPreferences({
        ...currentPrefs,
        tone: space.coachTone,
        coach_tone: space.coachTone,
      });
    } catch {
      // auth-store not available
    }
  }
}

// ── Store ───────────────────────────────────────────────────────────

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  activeSpaceId: null,
  isInitialized: false,

  // ── Initialize ──────────────────────────────────────────────────

  initialize: async () => {
    if (get().isInitialized) return;
    try {
      const [storedSpaces, storedActive] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SPACES),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SPACE),
      ]);

      const spaces: TrainingSpace[] = storedSpaces ? JSON.parse(storedSpaces) : [];
      const activeSpaceId: string | null = storedActive ? JSON.parse(storedActive) : null;

      set({ spaces, activeSpaceId, isInitialized: true });
    } catch {
      set({ isInitialized: true });
    }
  },

  // ── Create ──────────────────────────────────────────────────────

  createSpace: (input) => {
    const id = generateSpaceId();
    const space: TrainingSpace = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };

    const spaces = [...get().spaces, space];
    set({ spaces });
    AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(spaces)).catch(console.warn);
    return id;
  },

  // ── Update ──────────────────────────────────────────────────────

  updateSpace: (id, updates) => {
    const spaces = get().spaces.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );
    set({ spaces });
    AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(spaces)).catch(console.warn);
  },

  // ── Delete ──────────────────────────────────────────────────────

  deleteSpace: (id) => {
    const { spaces, activeSpaceId } = get();
    const filtered = spaces.filter((s) => s.id !== id);
    const newActiveId = activeSpaceId === id ? null : activeSpaceId;
    set({ spaces: filtered, activeSpaceId: newActiveId });
    AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(filtered)).catch(console.warn);
    if (newActiveId !== activeSpaceId) {
      AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SPACE, JSON.stringify(newActiveId)).catch(console.warn);
    }
  },

  // ── Switch ──────────────────────────────────────────────────────

  switchSpace: (id) => {
    const space = get().spaces.find((s) => s.id === id);
    if (!space) return;

    set({ activeSpaceId: id });
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SPACE, JSON.stringify(id)).catch(console.warn);

    // Apply side effects to other stores
    applySpaceSideEffects(space);
  },

  // ── Get Active ──────────────────────────────────────────────────

  getActiveSpace: () => {
    const { spaces, activeSpaceId } = get();
    if (!activeSpaceId) return null;
    return spaces.find((s) => s.id === activeSpaceId) ?? null;
  },

  // ── Reset ──────────────────────────────────────────────────────

  reset: async () => {
    set({ spaces: [], activeSpaceId: null, isInitialized: false });
    await Promise.all(
      Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)),
    ).catch(() => {});
  },
}));
