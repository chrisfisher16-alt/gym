// ── Health Data Sync Utilities ────────────────────────────────────────
//
// Processing and deduplication helpers for health-imported data.

import type { HealthDataPoint, HealthDataType } from './types';
import { healthService } from './health-service';

// ── Types ────────────────────────────────────────────────────────────

export interface DailyStepTotal {
  date: string; // YYYY-MM-DD
  steps: number;
  source: string;
}

export interface DailyEnergyTotal {
  date: string;
  calories: number;
  source: string;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
  source: string;
}

export interface SleepEntry {
  date: string; // night of (the day sleep started)
  durationHours: number;
  source: string;
}

// ── Sync Health Data ─────────────────────────────────────────────────

export async function syncHealthData(
  types: HealthDataType[],
  since: Date,
): Promise<Record<HealthDataType, HealthDataPoint[]>> {
  const now = new Date();
  const results: Record<string, HealthDataPoint[]> = {};

  const fetchMap: Record<HealthDataType, () => Promise<HealthDataPoint[]>> = {
    steps: () => healthService.getSteps(since, now),
    active_energy: () => healthService.getActiveEnergy(since, now),
    workout: () => healthService.getWorkouts(since, now),
    body_weight: () => healthService.getBodyWeight(since, now),
    sleep: () => healthService.getSleep(since, now),
  };

  const promises = types.map(async (type) => {
    try {
      results[type] = await fetchMap[type]();
    } catch {
      results[type] = [];
    }
  });

  await Promise.all(promises);
  return results as Record<HealthDataType, HealthDataPoint[]>;
}

// ── Process Steps ────────────────────────────────────────────────────

export function processSteps(data: HealthDataPoint[]): DailyStepTotal[] {
  const dayMap = new Map<string, { steps: number; source: string }>();

  for (const point of data) {
    const dateKey = toDateKey(point.startDate);
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.steps += point.value;
    } else {
      dayMap.set(dateKey, { steps: point.value, source: point.source });
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, { steps, source }]) => ({
      date,
      steps: Math.round(steps),
      source,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Process Energy ───────────────────────────────────────────────────

export function processEnergy(data: HealthDataPoint[]): DailyEnergyTotal[] {
  const dayMap = new Map<string, { calories: number; source: string }>();

  for (const point of data) {
    const dateKey = toDateKey(point.startDate);
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.calories += point.value;
    } else {
      dayMap.set(dateKey, { calories: point.value, source: point.source });
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, { calories, source }]) => ({
      date,
      calories: Math.round(calories),
      source,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Process Weight ───────────────────────────────────────────────────

export function processWeight(data: HealthDataPoint[]): WeightEntry[] {
  // Deduplicate by date, keeping the latest reading per day
  const dayMap = new Map<string, { weightKg: number; source: string; time: number }>();

  for (const point of data) {
    const dateKey = toDateKey(point.startDate);
    const existing = dayMap.get(dateKey);
    const time = point.startDate.getTime();

    if (!existing || time > existing.time) {
      dayMap.set(dateKey, { weightKg: point.value, source: point.source, time });
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, { weightKg, source }]) => ({
      date,
      weightKg: Math.round(weightKg * 10) / 10,
      source,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Process Sleep ────────────────────────────────────────────────────

export function processSleep(data: HealthDataPoint[]): SleepEntry[] {
  // Group sleep segments by the night they started
  const nightMap = new Map<string, { durationHours: number; source: string }>();

  for (const point of data) {
    const dateKey = toDateKey(point.startDate);
    const existing = nightMap.get(dateKey);
    if (existing) {
      existing.durationHours += point.value;
    } else {
      nightMap.set(dateKey, { durationHours: point.value, source: point.source });
    }
  }

  return Array.from(nightMap.entries())
    .map(([date, { durationHours, source }]) => ({
      date,
      durationHours: Math.round(durationHours * 10) / 10,
      source,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Merge Workouts ───────────────────────────────────────────────────

interface AppWorkout {
  id: string;
  startedAt: string;
  name: string;
}

export function mergeWorkouts(
  healthWorkouts: HealthDataPoint[],
  appWorkouts: AppWorkout[],
): HealthDataPoint[] {
  // Filter out health workouts that overlap with app-recorded workouts
  // to avoid duplicates (within a 30-minute window)
  const OVERLAP_THRESHOLD_MS = 30 * 60 * 1000;

  return healthWorkouts.filter((hw) => {
    const hwStart = hw.startDate.getTime();
    return !appWorkouts.some((aw) => {
      const awStart = new Date(aw.startedAt).getTime();
      return Math.abs(hwStart - awStart) < OVERLAP_THRESHOLD_MS;
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}
