// ── Profile Store ────────────────────────────────────────────────────
// Zustand store persisted with AsyncStorage for user profile and questionnaire data.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  // Basic
  displayName: string;
  dateOfBirth?: string;
  gender?: string;
  // Body
  heightCm?: number;
  weightKg?: number;
  unitPreference: 'metric' | 'imperial';
  // Goals
  primaryGoal?: string;
  targetWeightKg?: number;
  activityLevel?: number; // 1-5
  // Questionnaire
  trainingDaysPerWeek?: number;
  trainingExperience?: 'beginner' | 'intermediate' | 'advanced';
  injuriesOrLimitations?: string;
  availableEquipment?: string[];
  preferredTrainingTime?: string;
  dietaryRestrictions?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  unitPreference: 'imperial',
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
    },
  ),
);
