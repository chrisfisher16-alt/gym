/**
 * Match a completed FormIQ workout to HealthKit/Health Connect active energy data.
 *
 * Strategy: Query active energy burned during the workout's time window
 * (with a 5-minute buffer on each side). Sum all samples in that window
 * to get the wearable-verified calorie count.
 */

import { healthService } from './health-service';
import type { HealthDataPoint } from './types';

interface WatchCalorieResult {
  calories: number;
  source: string;
  verified: true;
}

/**
 * Attempt to get wearable-verified calories for a workout time window.
 * Returns null if health data is unavailable or no samples found.
 *
 * @param startedAt ISO string of workout start
 * @param completedAt ISO string of workout end
 */
export async function getWatchCalories(
  startedAt: string,
  completedAt: string,
): Promise<WatchCalorieResult | null> {
  try {
    const available = await healthService.isAvailable();
    if (!available) return null;

    // Add 5-minute buffer on each side for timing mismatches
    const BUFFER_MS = 5 * 60 * 1000;
    const start = new Date(new Date(startedAt).getTime() - BUFFER_MS);
    const end = new Date(new Date(completedAt).getTime() + BUFFER_MS);

    const energySamples = await healthService.getActiveEnergy(start, end);
    if (!energySamples.length) return null;

    // Sum all active energy samples in the window
    const totalCalories = energySamples.reduce((sum, sample) => sum + sample.value, 0);
    if (totalCalories <= 0) return null;

    // Use the source of the first sample (typically "Apple Watch" or device name)
    const source = energySamples[0]?.source ?? 'Wearable';

    return {
      calories: Math.round(totalCalories),
      source,
      verified: true,
    };
  } catch {
    return null;
  }
}
