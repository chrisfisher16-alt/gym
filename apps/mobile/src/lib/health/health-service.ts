// ── Health Service ────────────────────────────────────────────────────
//
// Platform-agnostic entry point. Automatically selects the correct
// health provider based on the current platform (Apple Health on iOS,
// Health Connect on Android, unavailable on web).

import { Platform } from 'react-native';
import type {
  IHealthService,
  HealthDataPoint,
  HealthDataType,
  HealthPermission,
  HealthProvider,
  SyncResult,
} from './types';

// ── Null implementation for unsupported platforms ────────────────────

class UnavailableHealthService implements IHealthService {
  getProvider(): HealthProvider {
    return null;
  }
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async requestPermissions(): Promise<HealthPermission[]> {
    return [];
  }
  async checkPermissions(): Promise<HealthPermission[]> {
    return [];
  }
  async getSteps(): Promise<HealthDataPoint[]> {
    return [];
  }
  async getActiveEnergy(): Promise<HealthDataPoint[]> {
    return [];
  }
  async getWorkouts(): Promise<HealthDataPoint[]> {
    return [];
  }
  async getBodyWeight(): Promise<HealthDataPoint[]> {
    return [];
  }
  async getSleep(): Promise<HealthDataPoint[]> {
    return [];
  }
  async syncAll(): Promise<SyncResult> {
    return { success: false, recordsImported: 0, errors: ['Health APIs not available on this platform'], durationMs: 0 };
  }
}

// ── Factory ──────────────────────────────────────────────────────────

function createHealthService(): IHealthService {
  if (Platform.OS === 'ios') {
    try {
      const { AppleHealthService } = require('./apple-health');
      return new AppleHealthService();
    } catch {
      return new UnavailableHealthService();
    }
  }

  if (Platform.OS === 'android') {
    try {
      const { HealthConnectService } = require('./health-connect');
      return new HealthConnectService();
    } catch {
      return new UnavailableHealthService();
    }
  }

  return new UnavailableHealthService();
}

/** Singleton health service instance */
export const healthService: IHealthService = createHealthService();

/**
 * Returns the user-facing name for the current health provider.
 * "Apple Health" on iOS, "Health Connect" on Android, null otherwise.
 */
export function getHealthProviderName(): string | null {
  switch (Platform.OS) {
    case 'ios':
      return 'Apple Health';
    case 'android':
      return 'Health Connect';
    default:
      return null;
  }
}

/**
 * Whether the current platform supports health integrations.
 * Web always returns false.
 */
export function isHealthPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
