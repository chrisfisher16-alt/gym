// ── Profile Store ────────────────────────────────────────────────────
// Zustand store persisted with AsyncStorage for user profile and questionnaire data.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────────────────

export type HealthGoal =
  | 'lose_weight'
  | 'gain_muscle'
  | 'build_lean_muscle'
  | 'improve_endurance'
  | 'maintain_weight'
  | 'improve_general_health';

export type CookingSkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type CookingEquipment =
  | 'microwave'
  | 'oven'
  | 'stove'
  | 'air_fryer'
  | 'blender'
  | 'slow_cooker'
  | 'instant_pot'
  | 'grill'
  | 'no_kitchen';

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'keto'
  | 'paleo'
  | 'gluten_free'
  | 'dairy_free'
  | 'halal'
  | 'kosher'
  | 'low_carb'
  | 'low_fat'
  | 'mediterranean'
  | 'whole30'
  | 'no_preference';

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface UserProfile {
  // Basic
  displayName: string;
  dateOfBirth?: string;
  gender?: string;
  // Body
  heightCm?: number;
  weightKg?: number;
  unitPreference: 'metric' | 'imperial';
  // Health Goals
  healthGoals: HealthGoal[];
  healthGoalDescription?: string;
  // Fitness
  primaryGoal?: string;
  targetWeightKg?: number;
  activityLevel?: number; // 1-5
  trainingDaysPerWeek?: number;
  trainingExperience?: 'beginner' | 'intermediate' | 'advanced';
  injuriesOrLimitations?: string;
  fitnessEquipment: string[];
  preferredTrainingTime?: string;
  preferredWorkoutDays: Weekday[];
  // Nutrition & Cooking
  allergies: string[];
  dietaryPreferences: DietaryPreference[];
  cookingSkillLevel?: CookingSkillLevel;
  cookingEquipment: CookingEquipment[];
  // Legacy (kept for backward compat during migration)
  dietaryRestrictions?: string;
  availableEquipment?: string[];
}

const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  unitPreference: 'imperial',
  healthGoals: [],
  allergies: [],
  dietaryPreferences: [],
  cookingEquipment: [],
  fitnessEquipment: [],
  preferredWorkoutDays: [],
};

interface ProfileState {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  initialize: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: { ...DEFAULT_PROFILE },

      updateProfile: (updates) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }));
      },

      initialize: () => {
        // Hydration is handled by zustand/persist automatically.
        // This is a no-op hook for explicit initialization if needed.
      },
    }),
    {
      name: '@profile/data',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profile: state.profile }),
      // Migrate old store shape to new defaults
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as { profile?: Partial<UserProfile> };
        if (state?.profile) {
          const p = state.profile;
          // Ensure new array fields have defaults
          if (!Array.isArray(p.healthGoals)) p.healthGoals = [];
          if (!Array.isArray(p.allergies)) p.allergies = p.allergies ? [String(p.allergies)] : [];
          if (!Array.isArray(p.dietaryPreferences)) p.dietaryPreferences = [];
          if (!Array.isArray(p.cookingEquipment)) p.cookingEquipment = [];
          if (!Array.isArray(p.fitnessEquipment)) {
            // Migrate from old availableEquipment
            p.fitnessEquipment = Array.isArray(p.availableEquipment) ? p.availableEquipment : [];
          }
          if (!Array.isArray(p.preferredWorkoutDays)) p.preferredWorkoutDays = [];
        }
        return state as { profile: UserProfile };
      },
      version: 2,
    },
  ),
);
