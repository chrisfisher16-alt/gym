import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  healthService,
  isHealthPlatform,
  type HealthDataType,
  type HealthPermission,
  type HealthProvider,
  type HealthSyncToggles,
} from '../lib/health';

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SYNC_ENABLED: '@health/sync_enabled',
  LAST_SYNC: '@health/last_sync',
  IS_CONNECTED: '@health/is_connected',
  TODAY_STEPS: '@health/today_steps',
  TODAY_ENERGY: '@health/today_energy',
  RECENT_WEIGHT: '@health/recent_weight',
  LAST_SLEEP: '@health/last_sleep',
} as const;

// ── State ───────────────────────────────────────────────────────────

interface HealthState {
  // Connection status
  isConnected: boolean;
  provider: HealthProvider;
  permissions: HealthPermission[];

  // Data
  todaySteps: number;
  todayActiveEnergy: number;
  recentWeight: number | null;
  lastSleepHours: number | null;

  // Sync
  lastSyncAt: Date | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncEnabled: HealthSyncToggles;

  // Initialization
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  requestPermissions: (types?: HealthDataType[]) => Promise<HealthPermission[]>;
  toggleSync: (type: HealthDataType, enabled: boolean) => void;
  syncNow: () => Promise<void>;
  getLatestData: () => Promise<void>;
  setRecentWeight: (weight: number) => void;
  disconnect: () => Promise<void>;
}

// ── Helpers ─────────────────────────────────────────────────────────

const DEFAULT_SYNC_TOGGLES: HealthSyncToggles = {
  steps: true,
  activeEnergy: true,
  workouts: true,
  bodyWeight: true,
  sleep: true,
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYesterday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 1);
  return d;
}

// ── Store ───────────────────────────────────────────────────────────

export const useHealthStore = create<HealthState>((set, get) => ({
  isConnected: false,
  provider: null,
  permissions: [],
  todaySteps: 0,
  todayActiveEnergy: 0,
  recentWeight: null,
  lastSleepHours: null,
  lastSyncAt: null,
  isLoading: false,
  isSyncing: false,
  syncEnabled: { ...DEFAULT_SYNC_TOGGLES },
  isInitialized: false,

  // ── Initialize ──────────────────────────────────────────────────

  initialize: async () => {
    if (!isHealthPlatform()) {
      set({ isInitialized: true });
      return;
    }

    try {
      const [
        storedSyncEnabled,
        storedLastSync,
        storedIsConnected,
        storedSteps,
        storedEnergy,
        storedWeight,
        storedSleep,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SYNC_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
        AsyncStorage.getItem(STORAGE_KEYS.IS_CONNECTED),
        AsyncStorage.getItem(STORAGE_KEYS.TODAY_STEPS),
        AsyncStorage.getItem(STORAGE_KEYS.TODAY_ENERGY),
        AsyncStorage.getItem(STORAGE_KEYS.RECENT_WEIGHT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SLEEP),
      ]);

      const syncEnabled: HealthSyncToggles = storedSyncEnabled
        ? JSON.parse(storedSyncEnabled)
        : { ...DEFAULT_SYNC_TOGGLES };

      const isConnected = storedIsConnected === 'true';
      const provider = isConnected ? healthService.getProvider() : null;

      set({
        syncEnabled,
        lastSyncAt: storedLastSync && !isNaN(new Date(storedLastSync).getTime()) ? new Date(storedLastSync) : null,
        isConnected,
        provider,
        todaySteps: storedSteps ? Number(storedSteps) : 0,
        todayActiveEnergy: storedEnergy ? Number(storedEnergy) : 0,
        recentWeight: storedWeight ? Number(storedWeight) : null,
        lastSleepHours: storedSleep ? Number(storedSleep) : null,
        isInitialized: true,
      });

      // If connected, refresh data in background
      if (isConnected) {
        get().getLatestData();
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  // ── Request Permissions ───────────────────────────────────────

  requestPermissions: async (types?: HealthDataType[]) => {
    const requestTypes: HealthDataType[] = types ?? [
      'steps',
      'active_energy',
      'workout',
      'body_weight',
      'sleep',
    ];

    set({ isLoading: true });

    try {
      const available = await healthService.isAvailable();
      if (!available) {
        set({ isLoading: false });
        return [];
      }

      const granted = await healthService.requestPermissions(requestTypes);

      if (granted.length > 0) {
        set({
          isConnected: true,
          provider: healthService.getProvider(),
          permissions: granted,
        });
        await AsyncStorage.setItem(STORAGE_KEYS.IS_CONNECTED, 'true');

        // Fetch initial data
        get().getLatestData();
      }

      set({ isLoading: false });
      return granted;
    } catch {
      set({ isLoading: false });
      return [];
    }
  },

  // ── Toggle Sync ───────────────────────────────────────────────

  toggleSync: (type, enabled) => {
    set((state) => {
      const key = type === 'active_energy' ? 'activeEnergy' : type === 'body_weight' ? 'bodyWeight' : type;
      const syncEnabled = { ...state.syncEnabled, [key]: enabled };
      AsyncStorage.setItem(STORAGE_KEYS.SYNC_ENABLED, JSON.stringify(syncEnabled));
      return { syncEnabled };
    });
  },

  // ── Sync Now ──────────────────────────────────────────────────

  syncNow: async () => {
    const { isConnected, isSyncing } = get();
    if (!isConnected || isSyncing) return;

    set({ isSyncing: true });

    try {
      await get().getLatestData();

      const now = new Date();
      set({ lastSyncAt: now, isSyncing: false });
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toISOString());
    } catch {
      set({ isSyncing: false });
    }
  },

  // ── Get Latest Data ───────────────────────────────────────────

  getLatestData: async () => {
    const { syncEnabled, isConnected } = get();
    if (!isConnected) return;

    const today = startOfToday();
    const now = new Date();
    const yesterday = startOfYesterday();

    try {
      // Fetch enabled data types in parallel
      const promises: Promise<void>[] = [];

      if (syncEnabled.steps) {
        promises.push(
          healthService.getSteps(today, now).then((data) => {
            const total = data.reduce((sum, d) => sum + d.value, 0);
            set({ todaySteps: Math.round(total) });
            AsyncStorage.setItem(STORAGE_KEYS.TODAY_STEPS, String(Math.round(total)));
          }),
        );
      }

      if (syncEnabled.activeEnergy) {
        promises.push(
          healthService.getActiveEnergy(today, now).then((data) => {
            const total = data.reduce((sum, d) => sum + d.value, 0);
            set({ todayActiveEnergy: Math.round(total) });
            AsyncStorage.setItem(STORAGE_KEYS.TODAY_ENERGY, String(Math.round(total)));
          }),
        );
      }

      if (syncEnabled.bodyWeight) {
        promises.push(
          healthService.getBodyWeight(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), now).then((data) => {
            if (data.length > 0) {
              // Most recent weight
              const sorted = [...data].sort(
                (a, b) => b.startDate.getTime() - a.startDate.getTime(),
              );
              const weight = Math.round(sorted[0].value * 10) / 10;
              set({ recentWeight: weight });
              AsyncStorage.setItem(STORAGE_KEYS.RECENT_WEIGHT, String(weight));
            }
          }),
        );
      }

      if (syncEnabled.sleep) {
        promises.push(
          healthService.getSleep(yesterday, today).then((data) => {
            if (data.length > 0) {
              const totalHours = data.reduce((sum, d) => sum + d.value, 0);
              const rounded = Math.round(totalHours * 10) / 10;
              set({ lastSleepHours: rounded });
              AsyncStorage.setItem(STORAGE_KEYS.LAST_SLEEP, String(rounded));
            }
          }),
        );
      }

      await Promise.allSettled(promises);
    } catch {
      // Silently fail — cached data will be shown
    }
  },

  // ── Set Recent Weight ─────────────────────────────────────────

  setRecentWeight: (weight) => {
    const rounded = Math.round(weight * 10) / 10;
    set({ recentWeight: rounded });
    AsyncStorage.setItem(STORAGE_KEYS.RECENT_WEIGHT, String(rounded));
  },

  // ── Disconnect ────────────────────────────────────────────────

  disconnect: async () => {
    set({
      isConnected: false,
      provider: null,
      permissions: [],
      todaySteps: 0,
      todayActiveEnergy: 0,
      recentWeight: null,
      lastSleepHours: null,
      lastSyncAt: null,
      syncEnabled: { ...DEFAULT_SYNC_TOGGLES },
    });

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.IS_CONNECTED),
      AsyncStorage.removeItem(STORAGE_KEYS.SYNC_ENABLED),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
      AsyncStorage.removeItem(STORAGE_KEYS.TODAY_STEPS),
      AsyncStorage.removeItem(STORAGE_KEYS.TODAY_ENERGY),
      AsyncStorage.removeItem(STORAGE_KEYS.RECENT_WEIGHT),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SLEEP),
    ]);
  },
}));
