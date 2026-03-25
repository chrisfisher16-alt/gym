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

export interface SpaceSavedState {
  nutritionTargets?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  activeProgramId?: string | null;
  coachTone?: CoachTone | null;
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
  savedState?: SpaceSavedState;
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

// ── Snapshot ─────────────────────────────────────────────────────────
// Capture current store values so they can be restored when switching back.

function snapshotCurrentState(): SpaceSavedState {
  const snapshot: SpaceSavedState = {};

  try {
    const { useNutritionStore } = require('./nutrition-store');
    const t = useNutritionStore.getState().targets;
    snapshot.nutritionTargets = {
      calories: t.calories,
      protein_g: t.protein_g,
      carbs_g: t.carbs_g,
      fat_g: t.fat_g,
    };
  } catch {
    // nutrition-store not available
  }

  try {
    const { useWorkoutStore } = require('./workout-store');
    const programs = useWorkoutStore.getState().programs;
    const active = programs.find((p: { isActive?: boolean }) => p.isActive);
    snapshot.activeProgramId = active?.id ?? null;
  } catch {
    // workout-store not available
  }

  try {
    const { useAuthStore } = require('./auth-store');
    const prefs = useAuthStore.getState().coachPreferences;
    snapshot.coachTone = prefs?.tone ?? prefs?.coach_tone ?? null;
  } catch {
    // auth-store not available
  }

  return snapshot;
}

// ── Side Effects ────────────────────────────────────────────────────
// Apply space overrides to other stores when switching.
// If the space has a savedState snapshot, restore from that first,
// then overlay any explicit space overrides on top.

function applySpaceSideEffects(space: TrainingSpace): void {
  const saved = space.savedState;

  // 1. Nutrition targets — restore saved snapshot then overlay space overrides
  try {
    const { useNutritionStore } = require('./nutrition-store');
    const currentTargets = useNutritionStore.getState().targets;
    const base = saved?.nutritionTargets
      ? { ...currentTargets, ...saved.nutritionTargets }
      : currentTargets;
    if (space.nutritionTargets) {
      const merged = {
        ...base,
        ...(space.nutritionTargets.calories != null && { calories: space.nutritionTargets.calories }),
        ...(space.nutritionTargets.proteinGrams != null && { protein_g: space.nutritionTargets.proteinGrams }),
        ...(space.nutritionTargets.carbGrams != null && { carbs_g: space.nutritionTargets.carbGrams }),
        ...(space.nutritionTargets.fatGrams != null && { fat_g: space.nutritionTargets.fatGrams }),
      };
      useNutritionStore.getState().setDailyTargets(merged);
    } else if (saved?.nutritionTargets) {
      useNutritionStore.getState().setDailyTargets(base);
    }
  } catch {
    // nutrition-store not available
  }

  // 2. Active program — restore saved or apply space override
  try {
    const { useWorkoutStore } = require('./workout-store');
    if (space.activeProgram) {
      useWorkoutStore.getState().setActiveProgram(space.activeProgram);
    } else if (saved?.activeProgramId) {
      useWorkoutStore.getState().setActiveProgram(saved.activeProgramId);
    }
  } catch {
    // workout-store not available
  }

  // 3. Coach tone — restore saved or apply space override
  try {
    const { useAuthStore } = require('./auth-store');
    const tone = space.coachTone ?? saved?.coachTone;
    if (tone) {
      const currentPrefs = useAuthStore.getState().coachPreferences;
      useAuthStore.getState().setCoachPreferences({
        ...currentPrefs,
        tone,
        coach_tone: tone,
      });
    }
  } catch {
    // auth-store not available
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
    const { spaces, activeSpaceId } = get();
    const space = spaces.find((s) => s.id === id);
    if (!space) return;

    // Snapshot current state onto the outgoing space before switching
    const currentSnapshot = snapshotCurrentState();
    const updatedSpaces = spaces.map((s) =>
      s.id === activeSpaceId ? { ...s, savedState: currentSnapshot } : s,
    );

    set({ spaces: updatedSpaces, activeSpaceId: id });
    AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces)).catch(console.warn);
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SPACE, JSON.stringify(id)).catch(console.warn);

    // Apply side effects to other stores (restores savedState + overrides)
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
