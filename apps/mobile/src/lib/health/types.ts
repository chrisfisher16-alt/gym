// ── Health Data Types ─────────────────────────────────────────────────

export type HealthDataType =
  | 'steps'
  | 'active_energy'
  | 'workout'
  | 'body_weight'
  | 'sleep';

export interface HealthDataPoint {
  type: HealthDataType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source: string;
}

export interface HealthPermission {
  type: HealthDataType;
  read: boolean;
  write: boolean;
}

export type HealthProvider = 'apple_health' | 'health_connect' | null;

export interface HealthSyncStatus {
  lastSyncAt: Date | null;
  isEnabled: boolean;
  permissions: HealthPermission[];
  provider: HealthProvider;
}

export interface SyncResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
  durationMs: number;
}

export interface HealthSyncToggles {
  steps: boolean;
  activeEnergy: boolean;
  workouts: boolean;
  bodyWeight: boolean;
  sleep: boolean;
}

// ── Analytics Events ─────────────────────────────────────────────────

export type HealthAnalyticsEvent =
  | { name: 'HEALTH_PERMISSION_REQUESTED'; data: { types: HealthDataType[] } }
  | { name: 'HEALTH_PERMISSION_GRANTED'; data: { types: HealthDataType[] } }
  | { name: 'HEALTH_PERMISSION_DENIED'; data: Record<string, never> }
  | { name: 'HEALTH_SYNC_ENABLED'; data: { type: HealthDataType } }
  | { name: 'HEALTH_SYNC_DISABLED'; data: { type: HealthDataType } }
  | { name: 'HEALTH_SYNC_COMPLETED'; data: { records_imported: number; duration_ms: number } }
  | { name: 'HEALTH_SYNC_FAILED'; data: { error: string } };

// ── Health Service Interface ─────────────────────────────────────────

export interface IHealthService {
  isAvailable(): Promise<boolean>;
  requestPermissions(types: HealthDataType[]): Promise<HealthPermission[]>;
  checkPermissions(): Promise<HealthPermission[]>;
  getSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]>;
  getActiveEnergy(startDate: Date, endDate: Date): Promise<HealthDataPoint[]>;
  getWorkouts(startDate: Date, endDate: Date): Promise<HealthDataPoint[]>;
  getBodyWeight(startDate: Date, endDate: Date): Promise<HealthDataPoint[]>;
  getSleep(startDate: Date, endDate: Date): Promise<HealthDataPoint[]>;
  syncAll(since: Date): Promise<SyncResult>;
  getProvider(): HealthProvider;
}
