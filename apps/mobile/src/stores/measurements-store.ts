import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

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
  addMeasurement: (measurement: Omit<BodyMeasurement, 'id'>) => Promise<void>;
  addWeightFromHealthSync: (weightKg: number, date: string) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  addPhoto: (photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  reset: () => Promise<void>;
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

  addMeasurement: async (measurement) => {
    const existingIndex = get().measurements.findIndex(
      (m) => m.date.split('T')[0] === measurement.date.split('T')[0],
    );
    let measurements: BodyMeasurement[];
    if (existingIndex >= 0) {
      // Update existing entry for the same date — filter out undefined to avoid overwriting existing values
      measurements = [...get().measurements];
      const definedValues = Object.fromEntries(
        Object.entries(measurement).filter(([_, v]) => v !== undefined),
      );
      measurements[existingIndex] = { ...measurements[existingIndex], ...definedValues };
    } else {
      const newMeasurement: BodyMeasurement = {
        ...measurement,
        id: generateId(),
      };
      measurements = [...get().measurements, newMeasurement];
    }
    measurements.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    set({ measurements });
    await AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
  },

  addWeightFromHealthSync: async (weightKg, date) => {
    const state = get();
    const dateStr = date.split('T')[0];
    const exists = state.measurements.some(
      (m) =>
        m.source === 'health_sync' &&
        m.date.split('T')[0] === dateStr &&
        m.weightKg === weightKg,
    );
    if (exists) return;

    const newMeasurement: BodyMeasurement = {
      id: generateId(),
      date,
      weightKg,
      source: 'health_sync',
    };
    const measurements = [...state.measurements, newMeasurement].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    set({ measurements });
    await AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
  },

  deleteMeasurement: async (id) => {
    const measurements = get().measurements.filter((m) => m.id !== id);
    set({ measurements });
    await AsyncStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(measurements));
  },

  addPhoto: async (photo) => {
    let permanentUri = photo.uri;
    try {
      const PHOTOS_DIR = `${FileSystem.documentDirectory}progress-photos/`;
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true }).catch((e) => console.warn('[MeasurementsStore] mkdir failed:', e));

      const ext = photo.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      permanentUri = `${PHOTOS_DIR}${filename}`;

      await FileSystem.copyAsync({ from: photo.uri, to: permanentUri });
    } catch (error) {
      console.warn('Failed to copy photo to permanent storage, using original URI:', error);
      permanentUri = photo.uri;
    }

    const newPhoto: ProgressPhoto = {
      ...photo,
      uri: permanentUri,
      id: generateId(),
    };
    const photos = [...get().photos, newPhoto].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos));
      set({ photos });
    } catch (error) {
      // Clean up copied file to prevent orphaning
      if (permanentUri !== photo.uri) {
        FileSystem.deleteAsync(permanentUri, { idempotent: true }).catch((e) => console.warn('[MeasurementsStore] cleanup orphan failed:', e));
      }
      throw error;
    }
  },

  deletePhoto: async (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (photo) {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch((e) => console.warn('[MeasurementsStore] delete photo failed:', e));
    }
    const photos = get().photos.filter((p) => p.id !== id);
    set({ photos });
    await AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos));
  },

  reset: async () => {
    set({ measurements: [], photos: [], isInitialized: false });
    await Promise.all([
      ...Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)),
      FileSystem.deleteAsync(`${FileSystem.documentDirectory}progress-photos/`, { idempotent: true }).catch((e) => console.warn('[MeasurementsStore] delete photos dir failed:', e)),
    ]).catch((e) => console.warn('[MeasurementsStore] reset storage failed:', e));
  },
}));
