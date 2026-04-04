import type { CompletedSession, CompletedSet } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface SetPrediction {
  weight: number;
  reps: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  delta: number; // Change from last session weight (e.g., +5)
  lastSessionWeight: number;
  lastSessionReps: number;
}

// ── Internal helpers ─────────────────────────────────────────────────

interface SessionSetData {
  weight: number;
  reps: number;
  date: string;
}

/** Common weight increments in lbs */
const STANDARD_INCREMENTS_LBS = [2.5, 5, 10];
/** Common weight increments in kg */
const STANDARD_INCREMENTS_KG = [1, 2.5, 5];

/**
 * Find the nearest standard increment to a raw delta.
 */
function snapToStandardIncrement(rawDelta: number, isMetric: boolean): number {
  const increments = isMetric ? STANDARD_INCREMENTS_KG : STANDARD_INCREMENTS_LBS;
  let best = increments[0];
  let bestDist = Math.abs(rawDelta - best);
  for (const inc of increments) {
    const dist = Math.abs(rawDelta - inc);
    if (dist < bestDist) {
      best = inc;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Extract the working set data for a given exercise + set index from a completed session.
 * Falls back to any working set if the exact index is missing.
 */
function extractSetFromSession(
  session: CompletedSession,
  exerciseId: string,
  setIndex: number,
): SessionSetData | null {
  const exerciseEntry = session.exercises.find((e) => e.exerciseId === exerciseId);
  if (!exerciseEntry) return null;

  const workingSets = exerciseEntry.sets.filter(
    (s: CompletedSet) => s.setType === 'working' && s.weight != null && s.reps != null,
  );
  if (workingSets.length === 0) return null;

  // Prefer the matching set index; fall back to last working set
  const matched = workingSets[setIndex] ?? workingSets[workingSets.length - 1];
  if (matched.weight == null || matched.reps == null) return null;

  return {
    weight: matched.weight,
    reps: matched.reps,
    date: session.completedAt,
  };
}

/**
 * Determine whether the exercise is bodyweight-only across the given data points.
 */
function isBodyweightExercise(dataPoints: SessionSetData[]): boolean {
  return dataPoints.every((d) => d.weight === 0);
}

/**
 * Analyse a series of weights to detect a trend direction.
 * Returns 'increasing' | 'decreasing' | 'stable' | 'variable'.
 */
function detectTrend(
  values: number[],
): 'increasing' | 'decreasing' | 'stable' | 'variable' {
  if (values.length < 2) return 'stable';

  let ups = 0;
  let downs = 0;
  let same = 0;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) ups++;
    else if (diff < 0) downs++;
    else same++;
  }

  const total = values.length - 1;

  // All transitions go the same direction
  if (ups === total) return 'increasing';
  if (downs === total) return 'decreasing';
  if (same === total) return 'stable';

  // Mostly one direction (≥ 60% of transitions)
  if (ups / total >= 0.6) return 'increasing';
  if (downs / total >= 0.6) return 'decreasing';

  return 'variable';
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Predict the next set's weight and reps based on historical session data.
 *
 * Algorithm:
 * 1. Find last 3-5 sessions containing this exercise
 * 2. Extract weight/reps for the equivalent set index
 * 3. Detect trends:
 *    - Consistently increasing (3+ sessions): predict next increment → high confidence
 *    - Variable: suggest last session's value → medium confidence
 *    - First time / only 1 session: suggest last value → low confidence
 *    - Decreasing: suggest last value (never predict lower) → medium confidence
 * 4. For bodyweight exercises: predict reps only
 */
export function predictNextSet(
  exerciseId: string,
  setIndex: number,
  history: CompletedSession[],
  isMetric = false,
): SetPrediction | null {
  // Sort history newest-first
  const sorted = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  // Gather data from the last 5 sessions that contain this exercise
  const dataPoints: SessionSetData[] = [];
  for (const session of sorted) {
    const data = extractSetFromSession(session, exerciseId, setIndex);
    if (data) {
      dataPoints.push(data);
      if (dataPoints.length >= 5) break;
    }
  }

  // No history at all → cannot predict
  if (dataPoints.length === 0) return null;

  // Data is newest-first; reverse to oldest-first for trend analysis
  const chronological = [...dataPoints].reverse();
  const last = dataPoints[0]; // Most recent

  // ── Bodyweight exercise (weight is 0) ──────────────────────────────
  if (isBodyweightExercise(chronological)) {
    const reps = chronological.map((d) => d.reps);
    const repTrend = detectTrend(reps);

    if (dataPoints.length === 1) {
      return {
        weight: 0,
        reps: last.reps,
        confidence: 'low',
        reasoning: 'Only 1 session recorded. Try matching last time.',
        delta: 0,
        lastSessionWeight: 0,
        lastSessionReps: last.reps,
      };
    }

    if (repTrend === 'increasing' && chronological.length >= 3) {
      return {
        weight: 0,
        reps: last.reps + 1,
        confidence: 'high',
        reasoning: `Reps increasing over ${chronological.length} sessions`,
        delta: 0,
        lastSessionWeight: 0,
        lastSessionReps: last.reps,
      };
    }

    return {
      weight: 0,
      reps: last.reps,
      confidence: 'medium',
      reasoning: 'Aim to match or beat last session',
      delta: 0,
      lastSessionWeight: 0,
      lastSessionReps: last.reps,
    };
  }

  // ── Weighted exercise ──────────────────────────────────────────────

  // Only 1 session of data
  if (dataPoints.length === 1) {
    return {
      weight: last.weight,
      reps: last.reps,
      confidence: 'low',
      reasoning: 'Only 1 session recorded. Try matching last time.',
      delta: 0,
      lastSessionWeight: last.weight,
      lastSessionReps: last.reps,
    };
  }

  const weights = chronological.map((d) => d.weight);
  const weightTrend = detectTrend(weights);

  // ── Consistently increasing (high confidence) ──────────────────────
  if (weightTrend === 'increasing' && chronological.length >= 3) {
    // Calculate average increment per session
    let totalInc = 0;
    for (let i = 1; i < weights.length; i++) {
      totalInc += weights[i] - weights[i - 1];
    }
    const avgInc = totalInc / (weights.length - 1);
    const increment = snapToStandardIncrement(avgInc, isMetric);
    const predictedWeight = last.weight + increment;

    return {
      weight: predictedWeight,
      reps: last.reps,
      confidence: 'high',
      reasoning: `Consistent +${increment}${isMetric ? 'kg' : 'lb'}/session over ${chronological.length} sessions`,
      delta: increment,
      lastSessionWeight: last.weight,
      lastSessionReps: last.reps,
    };
  }

  // ── Stable weight but increasing reps ──────────────────────────────
  if (weightTrend === 'stable' && chronological.length >= 2) {
    const reps = chronological.map((d) => d.reps);
    const repTrend = detectTrend(reps);

    if (repTrend === 'increasing' && chronological.length >= 3) {
      return {
        weight: last.weight,
        reps: last.reps + 1,
        confidence: 'high',
        reasoning: `Reps increasing at ${last.weight}${isMetric ? 'kg' : 'lb'} over ${chronological.length} sessions`,
        delta: 0,
        lastSessionWeight: last.weight,
        lastSessionReps: last.reps,
      };
    }

    return {
      weight: last.weight,
      reps: last.reps,
      confidence: 'medium',
      reasoning: 'Same weight recently. Push for more reps.',
      delta: 0,
      lastSessionWeight: last.weight,
      lastSessionReps: last.reps,
    };
  }

  // ── Decreasing — don't predict lower, hold steady ─────────────────
  if (weightTrend === 'decreasing') {
    return {
      weight: last.weight,
      reps: last.reps,
      confidence: 'medium',
      reasoning: 'Weight decreased recently. Match last session to stabilize.',
      delta: 0,
      lastSessionWeight: last.weight,
      lastSessionReps: last.reps,
    };
  }

  // ── Variable / 2 sessions only ─────────────────────────────────────
  return {
    weight: last.weight,
    reps: last.reps,
    confidence: dataPoints.length === 2 ? 'low' : 'medium',
    reasoning:
      dataPoints.length === 2
        ? '2 sessions recorded. Try matching last time.'
        : 'Variable performance. Match last session.',
    delta: 0,
    lastSessionWeight: last.weight,
    lastSessionReps: last.reps,
  };
}
