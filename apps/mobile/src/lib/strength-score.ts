// ── Strength Scoring System ──────────────────────────────────────
// Calculates an overall strength score (0-100) from workout history
// using the Epley formula for estimated 1RM and body-weight-relative standards.

import type { CompletedSession } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────

export interface StrengthScore {
  overall: number;           // 0-100
  push: number;              // 0-100
  pull: number;              // 0-100
  legs: number;              // 0-100
  pushTrend: 'up' | 'down' | 'stable';
  pullTrend: 'up' | 'down' | 'stable';
  legsTrend: 'up' | 'down' | 'stable';
  benchmarkLifts: BenchmarkLift[];
}

export interface BenchmarkLift {
  exerciseId: string;
  exerciseName: string;
  category: 'push' | 'pull' | 'legs';
  estimated1RM: number;      // in lbs
  bestWeight: number;
  bestReps: number;
  lastWeight: number;
  lastReps: number;
  trend: 'up' | 'down' | 'stable';
}

// ── Benchmark Exercise Definitions ───────────────────────────────

type Category = 'push' | 'pull' | 'legs';

interface BenchmarkDef {
  id: string;
  names: string[];           // lowercase name fragments to match
  category: Category;
}

const BENCHMARK_EXERCISES: BenchmarkDef[] = [
  // Push
  { id: 'ex_bench_press',       names: ['bench press', 'barbell bench'],            category: 'push' },
  { id: 'ex_incline_bench_press', names: ['incline bench', 'incline barbell bench'], category: 'push' },
  { id: 'ex_overhead_press',    names: ['overhead press', 'ohp', 'military press', 'shoulder press'], category: 'push' },
  { id: 'ex_incline_db_press',  names: ['incline db press', 'incline dumbbell'],     category: 'push' },
  // Pull
  { id: 'ex_barbell_row',       names: ['barbell row', 'bent over row'],             category: 'pull' },
  { id: 'ex_pendlay_row',       names: ['pendlay row'],                              category: 'pull' },
  { id: 'ex_deadlift',          names: ['deadlift', 'conventional deadlift'],        category: 'pull' },
  { id: 'ex_rdl',               names: ['rdl', 'romanian deadlift'],                 category: 'pull' },
  { id: 'ex_pullup',            names: ['pull-up', 'pullup', 'chin-up', 'chinup'],   category: 'pull' },
  // Legs
  { id: 'ex_squat',             names: ['squat', 'back squat', 'barbell squat'],     category: 'legs' },
  { id: 'ex_front_squat',       names: ['front squat'],                              category: 'legs' },
  { id: 'ex_leg_press',         names: ['leg press'],                                category: 'legs' },
];

// ── Epley Formula ────────────────────────────────────────────────

function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// ── Exercise Matching ────────────────────────────────────────────

function matchBenchmark(exerciseId: string, exerciseName: string): BenchmarkDef | null {
  // Try exact ID match first
  const byId = BENCHMARK_EXERCISES.find((b) => b.id === exerciseId);
  if (byId) return byId;

  // Fuzzy name match
  const lower = exerciseName.toLowerCase();
  return BENCHMARK_EXERCISES.find((b) =>
    b.names.some((name) => lower.includes(name))
  ) ?? null;
}

// ── Score Normalization ──────────────────────────────────────────
// Maps e1RM to 0-100 using bodyweight-relative strength standards.
// Standards (male): BW×0.5 = 20, BW×1.0 = 50, BW×1.5 = 75, BW×2.0 = 100
// Female standards scaled to ~60% of male.

function normalizeScore(e1RM: number, bodyWeightLbs: number, isFemale: boolean): number {
  if (e1RM <= 0) return 0;

  const bw = bodyWeightLbs > 0 ? bodyWeightLbs : 175;
  const multiplier = isFemale ? 0.6 : 1.0;

  // Adjusted bodyweight thresholds
  const beginner     = bw * 0.5 * multiplier;
  const intermediate = bw * 1.0 * multiplier;
  const advanced     = bw * 1.5 * multiplier;
  const elite        = bw * 2.0 * multiplier;

  let score: number;
  if (e1RM <= beginner) {
    score = (e1RM / beginner) * 20;
  } else if (e1RM <= intermediate) {
    score = 20 + ((e1RM - beginner) / (intermediate - beginner)) * 30;
  } else if (e1RM <= advanced) {
    score = 50 + ((e1RM - intermediate) / (advanced - intermediate)) * 25;
  } else if (e1RM <= elite) {
    score = 75 + ((e1RM - advanced) / (elite - advanced)) * 25;
  } else {
    score = 100;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ── Trend Calculation ────────────────────────────────────────────

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const TREND_THRESHOLD = 0.02; // 2%

interface SetRecord {
  date: number;  // timestamp
  e1RM: number;
}

function computeTrend(records: SetRecord[]): 'up' | 'down' | 'stable' {
  if (records.length === 0) return 'stable';

  const now = Date.now();
  const twoWeeksAgo = now - TWO_WEEKS_MS;
  const fourWeeksAgo = now - TWO_WEEKS_MS * 2;

  const recent = records.filter((r) => r.date >= twoWeeksAgo);
  const previous = records.filter((r) => r.date >= fourWeeksAgo && r.date < twoWeeksAgo);

  if (recent.length === 0 || previous.length === 0) return 'stable';

  const bestRecent = Math.max(...recent.map((r) => r.e1RM));
  const bestPrevious = Math.max(...previous.map((r) => r.e1RM));

  if (bestPrevious === 0) return 'stable';

  const change = (bestRecent - bestPrevious) / bestPrevious;
  if (change > TREND_THRESHOLD) return 'up';
  if (change < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

// ── Main Calculator ──────────────────────────────────────────────

export interface StrengthScoreOptions {
  bodyWeightLbs?: number;
  isFemale?: boolean;
}

export function calculateStrengthScore(
  history: CompletedSession[],
  options: StrengthScoreOptions = {},
): StrengthScore {
  const { bodyWeightLbs = 175, isFemale = false } = options;

  // Collect best sets per exercise across all history
  const exerciseData = new Map<string, {
    def: BenchmarkDef;
    exerciseName: string;
    bestE1RM: number;
    bestWeight: number;
    bestReps: number;
    lastWeight: number;
    lastReps: number;
    records: SetRecord[];
  }>();

  // Process sessions in chronological order (oldest first)
  const sorted = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  for (const session of sorted) {
    const sessionDate = new Date(session.completedAt).getTime();

    for (const exercise of session.exercises) {
      const def = matchBenchmark(exercise.exerciseId, exercise.exerciseName);
      if (!def) continue;

      const key = def.id;
      let data = exerciseData.get(key);
      if (!data) {
        data = {
          def,
          exerciseName: exercise.exerciseName,
          bestE1RM: 0,
          bestWeight: 0,
          bestReps: 0,
          lastWeight: 0,
          lastReps: 0,
          records: [],
        };
        exerciseData.set(key, data);
      }

      // Update exercise name to most recent
      data.exerciseName = exercise.exerciseName;

      for (const set of exercise.sets) {
        if (set.weight == null || set.reps == null) continue;
        if (set.weight <= 0 || set.reps <= 0) continue;

        const e1RM = epley1RM(set.weight, set.reps);
        data.records.push({ date: sessionDate, e1RM });

        // Track last performed set
        data.lastWeight = set.weight;
        data.lastReps = set.reps;

        // Track best e1RM set
        if (e1RM > data.bestE1RM) {
          data.bestE1RM = e1RM;
          data.bestWeight = set.weight;
          data.bestReps = set.reps;
        }
      }
    }
  }

  // Build benchmark lifts
  const benchmarkLifts: BenchmarkLift[] = [];
  const categoryBestE1RM: Record<Category, number> = { push: 0, pull: 0, legs: 0 };
  const categoryRecords: Record<Category, SetRecord[]> = { push: [], pull: [], legs: [] };

  for (const [, data] of exerciseData) {
    const trend = computeTrend(data.records);

    benchmarkLifts.push({
      exerciseId: data.def.id,
      exerciseName: data.exerciseName,
      category: data.def.category,
      estimated1RM: Math.round(data.bestE1RM),
      bestWeight: data.bestWeight,
      bestReps: data.bestReps,
      lastWeight: data.lastWeight,
      lastReps: data.lastReps,
      trend,
    });

    if (data.bestE1RM > categoryBestE1RM[data.def.category]) {
      categoryBestE1RM[data.def.category] = data.bestE1RM;
    }
    categoryRecords[data.def.category].push(...data.records);
  }

  // Sort benchmark lifts by e1RM descending
  benchmarkLifts.sort((a, b) => b.estimated1RM - a.estimated1RM);

  // Calculate category scores
  const push = normalizeScore(categoryBestE1RM.push, bodyWeightLbs, isFemale);
  const pull = normalizeScore(categoryBestE1RM.pull, bodyWeightLbs, isFemale);
  const legs = normalizeScore(categoryBestE1RM.legs, bodyWeightLbs, isFemale);

  // Calculate trends
  const pushTrend = computeTrend(categoryRecords.push);
  const pullTrend = computeTrend(categoryRecords.pull);
  const legsTrend = computeTrend(categoryRecords.legs);

  // Overall = weighted average
  const overall = Math.round(push * 0.33 + pull * 0.33 + legs * 0.34);

  return {
    overall,
    push,
    pull,
    legs,
    pushTrend,
    pullTrend,
    legsTrend,
    benchmarkLifts,
  };
}
