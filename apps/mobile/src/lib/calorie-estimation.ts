/**
 * Estimated calories burned during resistance training.
 *
 * Uses MET (Metabolic Equivalent of Task) values for weight training:
 * - Light effort (bodyweight, machines, light load): MET 3.5
 * - Moderate effort (typical hypertrophy training): MET 5.0
 * - Vigorous effort (heavy compounds, supersets, circuits): MET 6.0
 *
 * Formula: Calories = MET x bodyWeightKg x durationHours
 *
 * Note: This is an estimate. Heart-rate-based calculations (Apple Watch)
 * are significantly more accurate.
 */

import type { CompletedSession } from '../types/workout';

interface CalorieEstimationInput {
  session: CompletedSession;
  bodyWeightKg: number;
  gender?: string;
}

interface CalorieEstimationResult {
  estimated: number;
  low: number;
  high: number;
  method: 'met_estimation';
}

/**
 * Determine workout intensity based on volume, duration, and set count.
 * Higher volume per minute = higher intensity.
 */
function estimateIntensityMET(session: CompletedSession): number {
  const durationMinutes = session.durationSeconds / 60;
  if (durationMinutes <= 0) return 3.5;

  const volumePerMinute = session.totalVolume / durationMinutes;
  const setsPerMinute = session.totalSets / durationMinutes;

  // High intensity: heavy volume + fast pace (supersets, circuits)
  if (volumePerMinute > 150 || setsPerMinute > 0.5) return 6.0;

  // Moderate intensity: typical hypertrophy/strength training
  if (volumePerMinute > 50 || setsPerMinute > 0.25) return 5.0;

  // Light intensity: low volume, long rest, bodyweight, cardio warm-up
  return 3.5;
}

/**
 * Estimate calories burned for a completed workout session.
 * Returns estimated value plus a low/high range.
 */
export function estimateCaloriesBurned(input: CalorieEstimationInput): CalorieEstimationResult {
  const { session, bodyWeightKg } = input;
  const durationHours = session.durationSeconds / 3600;

  if (durationHours <= 0 || bodyWeightKg <= 0) {
    return { estimated: 0, low: 0, high: 0, method: 'met_estimation' };
  }

  const met = estimateIntensityMET(session);
  const estimated = Math.round(met * bodyWeightKg * durationHours);

  // Range: +/- 25% to communicate uncertainty
  const low = Math.round(estimated * 0.75);
  const high = Math.round(estimated * 1.25);

  return { estimated, low, high, method: 'met_estimation' };
}

/**
 * Format calorie estimate for display.
 * Shows range to communicate estimation uncertainty.
 */
export function formatCalorieEstimate(result: CalorieEstimationResult): string {
  if (result.estimated === 0) return '0 cal';
  return `~${result.estimated} cal`;
}

/**
 * Format calorie estimate as a range string.
 */
export function formatCalorieRange(result: CalorieEstimationResult): string {
  if (result.estimated === 0) return '0 cal';
  return `${result.low}-${result.high} cal`;
}
