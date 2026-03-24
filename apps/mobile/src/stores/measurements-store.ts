import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────

export type MeasurementSource = 'manual' | 'health_sync';

export interface BodyMeasurement {
  id: string;
  date: string; // ISO
  weightKg?: number;
  heightCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  leftArmCm?: number;
  rightArmCm?: number;
  leftThighCm?: number;
  rightThighCm?: number;
  notes?: string;
  source?: MeasurementSource;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  uri: string;
  label?: 'front' | 'side' | 'back';
}

// ── Storage Keys ───────────────────────────────────────────────────

const STORAGE_KEYS = {
  DATA: '@measurements/data',
  PHOTOS: '@measurements/photos',
} as const;

// ── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `meas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── State ──────────────────────────────────────────────────────────

interface MeasurementsState {
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  isInitialized: boolean;

  // Computed
  weightHistory: () => BodyMeasurement[];

  // Actions
  initialize: () => Promise<void>;
  addMeasurement: (measurement: Omit<BodyMeasurement, 'id'>) => void;
  addWeightFromHealthSync: (weightKg: number, date: string) => void;
  deleteMeasurement: (id: string) => void;
  addPhoto: (photo: Omit<ProgressPhoto, 'id'>) => void;
  deletePhoto: (id: string) => void;
}

// ── Store ──────────────────────────────────────────────────────────

export const useMeasurementsStore = create<MeasurementsState>((set, get) => ({
  measurements: [],
  photos: [],
  isInitialized: false,

  weightHistory: () => {
    const { measurements } = get();
    return measurements
      .filter((m) => m.weightKg != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  initialize: async () => {
    try {
      const [storedData, storedPhotos] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DATA),
        AsyncStorage.getItem(STORAGE_KEYS.PHOTOS),
      ]);

      const measurements: BodyMeasurement[] = storedData
        ? JSON.parse(storedData)
        : [];

      const photos: ProgressPhoto[] = storedPhotos
        ? JSON.parse(storedPhotos)
        : [];

      set({ measurements, photos, isInitialized: true });
    } catch (error) {
      console.warn('Failed to initialize measurements store:', error);
      set({ measurements: [], photos: [], isInitialized: true });
    }
  },

  addMeasurement: (measurement) => {
    set((state) => {
      const newMeasurement: BodyMeasurement = {
        ...measurement,
        id: generateId(),
      };
      const measurements = [...state.measurements, newMeasurement].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
      return { measurements };
    });
  },

  addWeightFromHealthSync: (weightKg, date) => {
    set((state) => {
      // Deduplicate: skip if a health_sync entry for the same date already exists with the same weight
      const dateStr = date.split('T')[0];
      const exists = state.measurements.some(
        (m) =>
          m.source === 'health_sync' &&
          m.date.split('T')[0] === dateStr &&
          m.weightKg === weightKg,
      );
      if (exists) return state;

      const newMeasurement: BodyMeasurement = {
        id: generateId(),
        date,
        weightKg,
        source: 'health_sync',
      };
      const measurements = [...state.measurements, newMeasurement].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
      return { measurements };
    });
  },

  deleteMeasurement: (id) => {
    set((state) => {
      const measurements = state.measurements.filter((m) => m.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
      return { measurements };
    });
  },

  addPhoto: (photo) => {
    set((state) => {
      const newPhoto: ProgressPhoto = {
        ...photo,
        id: generateId(),
      };
      const photos = [...state.photos, newPhoto].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos));
      return { photos };
    });
  },

  deletePhoto: (id) => {
    set((state) => {
      const photos = state.photos.filter((p) => p.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos));
      return { photos };
    });
  },
}));
