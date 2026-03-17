import type { CompletedSession, LoadSuggestion } from '../types/workout';

/**
 * Progressive overload suggestion engine.
 *
 * Logic:
 * - Looks at the last session's performance for a given exercise
 * - If all target reps were hit → suggest small weight increase (2.5-5 lbs / 1-2.5 kg)
 * - If reps fell short → suggest same weight
 * - If reps significantly exceeded target → suggest bigger increase
 * - Returns human-readable explanation
 */

interface LastPerformance {
  weight: number;
  reps: number;
}

function parseTargetReps(targetReps: string): { min: number; max: number } {
  const parts = targetReps.split('-').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseInt(targetReps, 10);
  if (!isNaN(single)) {
    return { min: single, max: single };
  }
  return { min: 8, max: 12 }; // fallback
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export function getSuggestedLoad(
  exerciseId: string,
  targetReps: string,
  targetSets: number,
  history: CompletedSession[],
  isMetric: boolean,
): LoadSuggestion | null {
  // Find the most recent session containing this exercise
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  let lastSets: LastPerformance[] = [];
  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      lastSets = exerciseEntry.sets
        .filter((s) => s.setType === 'working' && s.weight != null && s.reps != null)
        .map((s) => ({ weight: s.weight!, reps: s.reps! }));
      break;
    }
  }

  if (lastSets.length === 0) {
    return null; // No previous data
  }

  const target = parseTargetReps(targetReps);
  const lastWeight = lastSets[0].weight;
  const avgReps = lastSets.reduce((sum, s) => sum + s.reps, 0) / lastSets.length;
  const allHitTarget = lastSets.every((s) => s.reps >= target.max);
  const allExceeded = lastSets.every((s) => s.reps >= target.max + 2);
  const someShort = lastSets.some((s) => s.reps < target.min);

  const smallIncrement = isMetric ? 2.5 : 5;
  const bigIncrement = isMetric ? 5 : 10;
  const unit = isMetric ? 'kg' : 'lbs';

  const lastSummary = lastSets
    .map((s) => `${s.weight}${unit} × ${s.reps}`)
    .join(', ');

  if (allExceeded) {
    // Significantly exceeded - bigger increase
    const newWeight = roundToNearest(lastWeight + bigIncrement, smallIncrement);
    return {
      suggestedWeight: newWeight,
      suggestedReps: target.min,
      explanation: `You crushed all sets last time (${lastSummary}). Time to go heavier: ${newWeight}${unit} × ${target.min}.`,
      confidence: 'high',
    };
  }

  if (allHitTarget) {
    // Hit all target reps - small increase
    const newWeight = roundToNearest(lastWeight + smallIncrement, smallIncrement);
    return {
      suggestedWeight: newWeight,
      suggestedReps: target.min,
      explanation: `You hit all ${targetSets}×${target.max} at ${lastWeight}${unit} last time. Try ${newWeight}${unit} × ${target.min} today.`,
      confidence: 'high',
    };
  }

  if (someShort) {
    // Fell short - keep same weight
    return {
      suggestedWeight: lastWeight,
      suggestedReps: target.max,
      explanation: `Avg ${Math.round(avgReps)} reps last time at ${lastWeight}${unit}. Stay at ${lastWeight}${unit} and aim for ${target.max} reps.`,
      confidence: 'medium',
    };
  }

  // In between - keep same weight, aim for top of range
  return {
    suggestedWeight: lastWeight,
    suggestedReps: target.max,
    explanation: `Last: ${lastSummary}. Keep at ${lastWeight}${unit} and push for ${target.max} reps per set.`,
    confidence: 'medium',
  };
}

/**
 * Get the last performance for an exercise from history.
 */
export function getLastPerformance(
  exerciseId: string,
  history: CompletedSession[],
  unit: string,
): string | null {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sortedHistory) {
    const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exerciseEntry) {
      const workingSets = exerciseEntry.sets.filter((s) => s.setType === 'working');
      if (workingSets.length === 0) return null;
      return workingSets
        .map((s) => `${s.weight ?? 0}${unit} × ${s.reps ?? 0}`)
        .join(', ');
    }
  }

  return null;
}
