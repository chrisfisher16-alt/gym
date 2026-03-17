// ── Health Connect (Android) Implementation ──────────────────────────
//
// Uses react-native-health-connect to interface with Android Health Connect.
// Requires a development build (EAS Build) — will not work in Expo Go.
//
// Health Connect permissions must be declared in AndroidManifest.xml.

import type {
  IHealthService,
  HealthDataPoint,
  HealthDataType,
  HealthPermission,
  HealthProvider,
  SyncResult,
} from './types';

// Lazy import to avoid crashes on iOS/web
let HealthConnect: typeof import('react-native-health-connect') | null = null;

try {
  HealthConnect = require('react-native-health-connect');
} catch {
  // Not available on this platform
}

// Map our types to Health Connect record types
const RECORD_TYPE_MAP: Record<HealthDataType, string> = {
  steps: 'Steps',
  active_energy: 'ActiveCaloriesBurned',
  workout: 'ExerciseSession',
  body_weight: 'Weight',
  sleep: 'SleepSession',
};

function toHealthDataPoint(
  type: HealthDataType,
  value: number,
  unit: string,
  startDate: string,
  endDate: string,
): HealthDataPoint {
  return {
    type,
    value,
    unit,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    source: 'Health Connect',
  };
}

export class HealthConnectService implements IHealthService {
  private initialized = false;

  getProvider(): HealthProvider {
    return 'health_connect';
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized || !HealthConnect) return this.initialized;

    try {
      const isInitialized = await HealthConnect.initialize();
      this.initialized = isInitialized;
      return isInitialized;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!HealthConnect) return false;

    try {
      const status = await HealthConnect.getSdkStatus();
      // SDK_AVAILABLE = 3
      return status === 3;
    } catch {
      return false;
    }
  }

  async requestPermissions(types: HealthDataType[]): Promise<HealthPermission[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const permissions = types.map((type) => ({
        accessType: 'read' as const,
        recordType: RECORD_TYPE_MAP[type],
      }));

      // Also request write for workouts
      if (types.includes('workout')) {
        permissions.push({
          accessType: 'write' as const,
          recordType: RECORD_TYPE_MAP.workout,
        });
      }

      const granted = await HealthConnect.requestPermission(permissions);

      return types.map((type) => {
        const readGranted = granted.some(
          (p: { accessType: string; recordType: string }) =>
            p.recordType === RECORD_TYPE_MAP[type] && p.accessType === 'read',
        );
        const writeGranted = granted.some(
          (p: { accessType: string; recordType: string }) =>
            p.recordType === RECORD_TYPE_MAP[type] && p.accessType === 'write',
        );

        return {
          type,
          read: readGranted,
          write: writeGranted,
        };
      });
    } catch {
      return [];
    }
  }

  async checkPermissions(): Promise<HealthPermission[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const allTypes: HealthDataType[] = ['steps', 'active_energy', 'workout', 'body_weight', 'sleep'];
      const permissions = allTypes.map((type) => ({
        accessType: 'read' as const,
        recordType: RECORD_TYPE_MAP[type],
      }));

      const granted = await HealthConnect.getGrantedPermissions();

      return allTypes.map((type) => ({
        type,
        read: (granted as Array<{ accessType: string; recordType: string }>).some(
          (p) => p.recordType === RECORD_TYPE_MAP[type] && p.accessType === 'read',
        ),
        write: (granted as Array<{ accessType: string; recordType: string }>).some(
          (p) => p.recordType === RECORD_TYPE_MAP[type] && p.accessType === 'write',
        ),
      }));
    } catch {
      return [];
    }
  }

  async getSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const result = await HealthConnect.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return (result.records as Array<{ count: number; startTime: string; endTime: string }>).map((r) =>
        toHealthDataPoint('steps', r.count, 'count', r.startTime, r.endTime),
      );
    } catch {
      return [];
    }
  }

  async getActiveEnergy(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const result = await HealthConnect.readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return (result.records as Array<{ energy: { inKilocalories: number }; startTime: string; endTime: string }>).map(
        (r) => toHealthDataPoint('active_energy', r.energy?.inKilocalories ?? 0, 'kcal', r.startTime, r.endTime),
      );
    } catch {
      return [];
    }
  }

  async getWorkouts(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const result = await HealthConnect.readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return (result.records as Array<{ startTime: string; endTime: string }>).map((r) => {
        const start = new Date(r.startTime);
        const end = new Date(r.endTime);
        const durationMin = (end.getTime() - start.getTime()) / (1000 * 60);
        return toHealthDataPoint('workout', durationMin, 'minutes', r.startTime, r.endTime);
      });
    } catch {
      return [];
    }
  }

  async getBodyWeight(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const result = await HealthConnect.readRecords('Weight', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return (result.records as Array<{ weight: { inKilograms: number }; time: string }>).map((r) =>
        toHealthDataPoint('body_weight', r.weight?.inKilograms ?? 0, 'kg', r.time, r.time),
      );
    } catch {
      return [];
    }
  }

  async getSleep(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!HealthConnect) return [];

    const initialized = await this.ensureInitialized();
    if (!initialized) return [];

    try {
      const result = await HealthConnect.readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return (result.records as Array<{ startTime: string; endTime: string }>).map((r) => {
        const start = new Date(r.startTime);
        const end = new Date(r.endTime);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return toHealthDataPoint('sleep', durationHours, 'hours', r.startTime, r.endTime);
      });
    } catch {
      return [];
    }
  }

  async syncAll(since: Date): Promise<SyncResult> {
    const startTime = Date.now();
    const now = new Date();
    let totalRecords = 0;
    const errors: string[] = [];

    const fetchers = [
      { fn: () => this.getSteps(since, now), label: 'steps' },
      { fn: () => this.getActiveEnergy(since, now), label: 'active_energy' },
      { fn: () => this.getWorkouts(since, now), label: 'workouts' },
      { fn: () => this.getBodyWeight(since, now), label: 'body_weight' },
      { fn: () => this.getSleep(since, now), label: 'sleep' },
    ];

    const results = await Promise.allSettled(fetchers.map((f) => f.fn()));

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        totalRecords += result.value.length;
      } else {
        errors.push(`Failed to sync ${fetchers[i].label}: ${result.reason}`);
      }
    });

    return {
      success: errors.length === 0,
      recordsImported: totalRecords,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}
