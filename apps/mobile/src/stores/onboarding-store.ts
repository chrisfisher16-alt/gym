import { create } from 'zustand';
import type { Gender, UnitPreference, ProductMode, CoachTone } from '@health-coach/shared';

interface OnboardingState {
  // Profile step
  displayName: string;
  dateOfBirth: string;
  gender: Gender | null;

  // Body step
  heightCm: number | null;
  weightKg: number | null;
  unitPreference: UnitPreference;

  // Goals step
  selectedGoals: string[];

  // Mode step
  productMode: ProductMode | null;

  // Coach tone step
  coachTone: CoachTone;

  // Actions
  setDisplayName: (name: string) => void;
  setDateOfBirth: (dob: string) => void;
  setGender: (gender: Gender) => void;
  setHeightCm: (height: number) => void;
  setWeightKg: (weight: number) => void;
  setUnitPreference: (pref: UnitPreference) => void;
  setSelectedGoals: (goals: string[]) => void;
  setProductMode: (mode: ProductMode) => void;
  setCoachTone: (tone: CoachTone) => void;
  reset: () => void;
}

const initialState = {
  displayName: '',
  dateOfBirth: '',
  gender: null as Gender | null,
  heightCm: null as number | null,
  weightKg: null as number | null,
  unitPreference: 'imperial' as UnitPreference,
  selectedGoals: [] as string[],
  productMode: null as ProductMode | null,
  coachTone: 'balanced' as CoachTone,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setDisplayName: (displayName) => set({ displayName }),
  setDateOfBirth: (dateOfBirth) => set({ dateOfBirth }),
  setGender: (gender) => set({ gender }),
  setHeightCm: (heightCm) => set({ heightCm }),
  setWeightKg: (weightKg) => set({ weightKg }),
  setUnitPreference: (unitPreference) => set({ unitPreference }),
  setSelectedGoals: (selectedGoals) => set({ selectedGoals }),
  setProductMode: (productMode) => set({ productMode }),
  setCoachTone: (coachTone) => set({ coachTone }),
  reset: () => set(initialState),
}));
