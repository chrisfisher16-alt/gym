// ── Apple Health (iOS) Implementation ─────────────────────────────────
//
// Uses react-native-health to interface with HealthKit.
// Requires a development build (EAS Build) — will not work in Expo Go.
//
// HealthKit entitlements must be added to app.json and the iOS project
// must include the HealthKit capability.

import type {
  IHealthService,
  HealthDataPoint,
  HealthDataType,
  HealthPermission,
  HealthProvider,
  SyncResult,
} from './types';

// Lazy import to avoid crashes on Android/web
let AppleHealthKit: typeof import('react-native-health').default | null = null;
let HealthKitPermissions: typeof import('react-native-health') | null = null;

try {
  const healthModule = require('react-native-health');
  AppleHealthKit = healthModule.default;
  HealthKitPermissions = healthModule;
} catch {
  // Not available on this platform
}

// Map our types to HealthKit permissions
const PERMISSION_MAP: Record<HealthDataType, { read: string; write?: string }> = {
  steps: { read: 'StepCount' },
  active_energy: { read: 'ActiveEnergyBurned' },
  workout: { read: 'Workout', write: 'Workout' },
  body_weight: { read: 'BodyMass' },
  sleep: { read: 'SleepAnalysis' },
};

function toHealthDataPoint(
  type: HealthDataType,
  value: number,
  unit: string,
  startDate: string,
  endDate: string,
  sourceName?: string,
): HealthDataPoint {
  return {
    type,
    value,
    unit,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    source: sourceName ?? 'Apple Health',
  };
}

export class AppleHealthService implements IHealthService {
  getProvider(): HealthProvider {
    return 'apple_health';
  }

  async isAvailable(): Promise<boolean> {
    if (!AppleHealthKit) return false;

    return new Promise((resolve) => {
      AppleHealthKit!.isAvailable((err: unknown, available: boolean) => {
        resolve(!err && available);
      });
    });
  }

  async requestPermissions(types: HealthDataType[]): Promise<HealthPermission[]> {
    if (!AppleHealthKit) return [];

    const readPermissions = types
      .map((t) => PERMISSION_MAP[t]?.read)
      .filter(Boolean) as string[];

    const writePermissions = types
      .map((t) => PERMISSION_MAP[t]?.write)
      .filter(Boolean) as string[];

    const permissions = {
      permissions: {
        read: readPermissions,
        write: writePermissions,
      },
    };

    return new Promise((resolve) => {
      AppleHealthKit!.initHealthKit(permissions, (err: unknown) => {
        if (err) {
          resolve([]);
          return;
        }

        // HealthKit doesn't tell us which specific permissions were granted,
        // so we assume all requested were granted after successful init.
        // Individual permission status can be checked per-type.
        const granted: HealthPermission[] = types.map((type) => ({
          type,
          read: true,
          write: !!PERMISSION_MAP[type]?.write,
        }));
        resolve(granted);
      });
    });
  }

  async checkPermissions(): Promise<HealthPermission[]> {
    // HealthKit doesn't provide a direct "check all permissions" API.
    // We return the permissions we've requested — actual access is
    // determined at query time.
    const allTypes: HealthDataType[] = ['steps', 'active_energy', 'workout', 'body_weight', 'sleep'];
    return allTypes.map((type) => ({
      type,
      read: true,
      write: !!PERMISSION_MAP[type]?.write,
    }));
  }

  async getSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!AppleHealthKit) return [];

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      period: 1440, // daily aggregation (minutes in a day)
    };

    return new Promise((resolve) => {
      AppleHealthKit!.getDailyStepCountSamples(
        options,
        (err: unknown, results: Array<{ value: number; startDate: string; endDate: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((r) =>
              toHealthDataPoint('steps', r.value, 'count', r.startDate, r.endDate, r.sourceName),
            ),
          );
        },
      );
    });
  }

  async getActiveEnergy(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!AppleHealthKit) return [];

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
    };

    return new Promise((resolve) => {
      AppleHealthKit!.getActiveEnergyBurned(
        options,
        (err: unknown, results: Array<{ value: number; startDate: string; endDate: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((r) =>
              toHealthDataPoint('active_energy', r.value, 'kcal', r.startDate, r.endDate, r.sourceName),
            ),
          );
        },
      );
    });
  }

  async getWorkouts(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!AppleHealthKit) return [];

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: 'Workout',
    };

    return new Promise((resolve) => {
      AppleHealthKit!.getSamples(
        options,
        (err: unknown, results: Array<{ value: number; startDate: string; endDate: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((r) =>
              toHealthDataPoint('workout', r.value ?? 0, 'session', r.startDate, r.endDate, r.sourceName),
            ),
          );
        },
      );
    });
  }

  async getBodyWeight(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!AppleHealthKit) return [];

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
      unit: 'kg',
    };

    return new Promise((resolve) => {
      AppleHealthKit!.getWeightSamples(
        options,
        (err: unknown, results: Array<{ value: number; startDate: string; endDate: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((r) =>
              toHealthDataPoint('body_weight', r.value, 'kg', r.startDate, r.endDate, r.sourceName),
            ),
          );
        },
      );
    });
  }

  async getSleep(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
    if (!AppleHealthKit) return [];

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    return new Promise((resolve) => {
      AppleHealthKit!.getSleepSamples(
        options,
        (err: unknown, results: Array<{ value: string; startDate: string; endDate: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve([]);
            return;
          }

          // Filter only ASLEEP values (exclude INBED)
          const sleepResults = results.filter(
            (r) => r.value === 'ASLEEP' || r.value === 'CORE' || r.value === 'DEEP' || r.value === 'REM',
          );

          resolve(
            sleepResults.map((r) => {
              const start = new Date(r.startDate);
              const end = new Date(r.endDate);
              const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              return toHealthDataPoint('sleep', durationHours, 'hours', r.startDate, r.endDate, r.sourceName);
            }),
          );
        },
      );
    });
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
