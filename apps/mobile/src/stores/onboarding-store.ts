import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gender, UnitPreference, ProductMode, CoachTone, Weekday } from '@health-coach/shared';
import type {
  FitnessGoal,
  ExperienceLevel,
  ConsistencyLevel,
  GymType,
  SessionDuration,
  ScheduleMode,
  AttributionSource,
  OnboardingStep,
} from '../types/onboarding';
import { ONBOARDING_STEPS } from '../types/onboarding';

// ── Total steps for progress calculation ────────────────────────────
const TOTAL_STEPS = ONBOARDING_STEPS.length; // 9

// ── Default weekdays for "days_per_week" mode ───────────────────────
const DEFAULT_WEEKDAY_SPREAD: Record<number, Weekday[]> = {
  1: ['monday'],
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};

// ── Interface ───────────────────────────────────────────────────────

interface OnboardingState {
  // Step tracking
  currentStep: OnboardingStep | null;

  // Health sync (health-sync.tsx)
  unitPreference: UnitPreference;
  dateOfBirth: string;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  healthSyncEnabled: boolean;

  // Goals (goals.tsx)
  fitnessGoal: FitnessGoal | null;
  experienceLevel: ExperienceLevel | null;

  // Schedule (schedule.tsx)
  scheduleMode: ScheduleMode;
  trainingDaysPerWeek: number | null;
  specificTrainingDays: Weekday[];
  consistencyLevel: ConsistencyLevel | null;
  sessionDuration: SessionDuration | null;

  // Gym (gym-type.tsx, gym-search.tsx)
  gymType: GymType | null;
  gymName: string;

  // Equipment (equipment.tsx)
  selectedEquipment: string[];
  equipmentWeights: Record<string, number[]>;

  // Notifications (notifications.tsx)
  notificationsEnabled: boolean;
  notificationTime: string;

  // Attribution (attribution.tsx)
  attributionSource: AttributionSource | null;

  // Submission state
  isSubmitting: boolean;

  // Legacy V1 fields (kept for compatibility)
  displayName: string;
  selectedGoals: string[];
  productMode: ProductMode | null;
  coachTone: CoachTone;

  // ── Actions ─────────────────────────────────────────────────────

  // Step tracking
  setCurrentStep: (step: OnboardingStep) => void;

  // Health sync
  setUnitPreference: (pref: UnitPreference) => void;
  setDateOfBirth: (dob: string) => void;
  setGender: (gender: Gender) => void;
  setHeightCm: (cm: number | null) => void;
  setWeightKg: (kg: number | null) => void;
  setHealthSyncEnabled: (enabled: boolean) => void;

  // Goals
  setFitnessGoal: (goal: FitnessGoal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;

  // Schedule
  setScheduleMode: (mode: ScheduleMode) => void;
  setTrainingDaysPerWeek: (days: number) => void;
  toggleTrainingDay: (day: Weekday) => void;
  setConsistencyLevel: (level: ConsistencyLevel) => void;
  setSessionDuration: (duration: SessionDuration) => void;

  // Gym
  setGymType: (type: GymType) => void;
  setGymName: (name: string) => void;

  // Equipment
  toggleEquipment: (equipmentId: string) => void;
  setSelectedEquipment: (ids: string[]) => void;
  setEquipmentWeights: (equipmentId: string, weights: number[]) => void;
  toggleEquipmentWeight: (equipmentId: string, weight: number) => void;

  // Notifications
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotificationTime: (time: string) => void;

  // Attribution
  setAttributionSource: (source: AttributionSource) => void;

  // Legacy V1 actions
  setDisplayName: (name: string) => void;
  setSelectedGoals: (goals: string[]) => void;
  setProductMode: (mode: ProductMode) => void;
  setCoachTone: (tone: CoachTone) => void;

  // Computed
  getProgress: () => number;
  getEffectiveTrainingDays: () => Weekday[];

  // Submission
  submitOnboarding: () => Promise<void>;

  // Reset
  reset: () => void;
}

// ── Initial state (data fields only) ────────────────────────────────

const initialState = {
  currentStep: null as OnboardingStep | null,

  // Health sync
  unitPreference: 'imperial' as UnitPreference,
  dateOfBirth: '',
  gender: null as Gender | null,
  heightCm: null as number | null,
  weightKg: null as number | null,
  healthSyncEnabled: false,

  // Goals
  fitnessGoal: null as FitnessGoal | null,
  experienceLevel: null as ExperienceLevel | null,

  // Schedule
  scheduleMode: 'days_per_week' as ScheduleMode,
  trainingDaysPerWeek: null as number | null,
  specificTrainingDays: [] as Weekday[],
  consistencyLevel: null as ConsistencyLevel | null,
  sessionDuration: null as SessionDuration | null,

  // Gym
  gymType: null as GymType | null,
  gymName: '',

  // Equipment
  selectedEquipment: [] as string[],
  equipmentWeights: {} as Record<string, number[]>,

  // Notifications
  notificationsEnabled: false,
  notificationTime: '09:00',

  // Attribution
  attributionSource: null as AttributionSource | null,

  // Submission
  isSubmitting: false,

  // Legacy V1
  displayName: '',
  selectedGoals: [] as string[],
  productMode: null as ProductMode | null,
  coachTone: 'balanced' as CoachTone,
};

// ── Store ───────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Step tracking ──────────────────────────────────────────
      setCurrentStep: (currentStep) => set({ currentStep }),

      // ── Health sync ────────────────────────────────────────────
      setUnitPreference: (unitPreference) => set({ unitPreference }),
      setDateOfBirth: (dateOfBirth) => set({ dateOfBirth }),
      setGender: (gender) => set({ gender }),
      setHeightCm: (heightCm) => set({ heightCm }),
      setWeightKg: (weightKg) => set({ weightKg }),
      setHealthSyncEnabled: (healthSyncEnabled) => set({ healthSyncEnabled }),

      // ── Goals ──────────────────────────────────────────────────
      setFitnessGoal: (fitnessGoal) => set({ fitnessGoal }),
      setExperienceLevel: (experienceLevel) => set({ experienceLevel }),

      // ── Schedule ───────────────────────────────────────────────
      setScheduleMode: (scheduleMode) => set({ scheduleMode }),
      setTrainingDaysPerWeek: (trainingDaysPerWeek) => set({ trainingDaysPerWeek }),
      toggleTrainingDay: (day) =>
        set((state) => ({
          specificTrainingDays: state.specificTrainingDays.includes(day)
            ? state.specificTrainingDays.filter((d) => d !== day)
            : [...state.specificTrainingDays, day],
        })),
      setConsistencyLevel: (consistencyLevel) => set({ consistencyLevel }),
      setSessionDuration: (sessionDuration) => set({ sessionDuration }),

      // ── Gym ────────────────────────────────────────────────────
      setGymType: (gymType) => set({ gymType }),
      setGymName: (gymName) => set({ gymName }),

      // ── Equipment ──────────────────────────────────────────────
      toggleEquipment: (equipmentId) =>
        set((state) => ({
          selectedEquipment: state.selectedEquipment.includes(equipmentId)
            ? state.selectedEquipment.filter((id) => id !== equipmentId)
            : [...state.selectedEquipment, equipmentId],
        })),
      setSelectedEquipment: (ids) => set({ selectedEquipment: ids }),
      setEquipmentWeights: (equipmentId, weights) =>
        set((state) => ({
          equipmentWeights: { ...state.equipmentWeights, [equipmentId]: weights },
        })),
      toggleEquipmentWeight: (equipmentId, weight) =>
        set((state) => {
          const current = state.equipmentWeights[equipmentId] ?? [];
          const updated = current.includes(weight)
            ? current.filter((w) => w !== weight)
            : [...current, weight];
          return {
            equipmentWeights: { ...state.equipmentWeights, [equipmentId]: updated },
          };
        }),

      // ── Notifications ──────────────────────────────────────────
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotificationTime: (notificationTime) => set({ notificationTime }),

      // ── Attribution ────────────────────────────────────────────
      setAttributionSource: (attributionSource) => set({ attributionSource }),

      // ── Legacy V1 ─────────────────────────────────────────────
      setDisplayName: (displayName) => set({ displayName }),
      setSelectedGoals: (selectedGoals) => set({ selectedGoals }),
      setProductMode: (productMode) => set({ productMode }),
      setCoachTone: (coachTone) => set({ coachTone }),

      // ── Computed ───────────────────────────────────────────────
      getProgress: () => {
        const { currentStep } = get();
        if (!currentStep) return 0;
        const idx = ONBOARDING_STEPS.indexOf(currentStep);
        return idx < 0 ? 0 : idx / TOTAL_STEPS;
      },

      getEffectiveTrainingDays: () => {
        const { scheduleMode, specificTrainingDays, trainingDaysPerWeek } = get();
        if (scheduleMode === 'specific_days') {
          return specificTrainingDays;
        }
        // days_per_week mode — auto-generate an evenly-spread schedule
        const count = trainingDaysPerWeek ?? 3;
        return DEFAULT_WEEKDAY_SPREAD[count] ?? DEFAULT_WEEKDAY_SPREAD[3];
      },

      // ── Submission ─────────────────────────────────────────────
      submitOnboarding: async () => {
        console.warn('submitOnboarding() is deprecated — use complete.tsx finishOnboarding() instead');
      },

      // ── Reset ──────────────────────────────────────────────────
      reset: () => set(initialState),
    }),
    {
      name: 'onboarding-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        unitPreference: state.unitPreference,
        dateOfBirth: state.dateOfBirth,
        gender: state.gender,
        heightCm: state.heightCm,
        weightKg: state.weightKg,
        healthSyncEnabled: state.healthSyncEnabled,
        fitnessGoal: state.fitnessGoal,
        experienceLevel: state.experienceLevel,
        scheduleMode: state.scheduleMode,
        trainingDaysPerWeek: state.trainingDaysPerWeek,
        specificTrainingDays: state.specificTrainingDays,
        consistencyLevel: state.consistencyLevel,
        sessionDuration: state.sessionDuration,
        gymType: state.gymType,
        gymName: state.gymName,
        selectedEquipment: state.selectedEquipment,
        equipmentWeights: state.equipmentWeights,
        notificationsEnabled: state.notificationsEnabled,
        notificationTime: state.notificationTime,
        attributionSource: state.attributionSource,
        displayName: state.displayName,
        selectedGoals: state.selectedGoals,
        productMode: state.productMode,
        coachTone: state.coachTone,
      }),
    },
  ),
);
