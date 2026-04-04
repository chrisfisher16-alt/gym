import { MUSCLE_GROUPS } from '../components/MuscleGroupTile';
import type { MuscleGroupInfo } from '../components/MuscleGroupTile';
import type { CompletedSession } from '../types/workout';
import type { MuscleId } from '../types/workout';
import { EXERCISE_LIBRARY } from './exercise-data';

// ── Recovery Calculation ─────────────────────────────────────────────

/**
 * Base recovery curve: maps hours since last workout to a recovery percentage.
 *
 *   0–24h  → 0–30%
 *   24–48h → 30–60%
 *   48–72h → 60–90%
 *   72h+   → 90–100%  (caps at 100)
 */
function baseRecovery(hoursSince: number): number {
  if (hoursSince <= 0) return 0;
  if (hoursSince <= 24) return lerp(0, 30, hoursSince / 24);
  if (hoursSince <= 48) return lerp(30, 60, (hoursSince - 24) / 24);
  if (hoursSince <= 72) return lerp(60, 90, (hoursSince - 48) / 24);
  // 72h+: asymptotically approach 100
  const extra = hoursSince - 72;
  return Math.min(100, 90 + 10 * (1 - Math.exp(-extra / 24)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Volume penalty — higher-volume sessions slow recovery.
 *
 * We use "total sets targeting this muscle group" as a rough proxy for volume.
 * A typical session might have 9–15 sets per group.
 *   ≤10 sets → no penalty (multiplier 1.0)
 *   15 sets  → moderate penalty (multiplier ~0.85)
 *   20+ sets → heavier penalty (multiplier ~0.75)
 */
function volumeMultiplier(setsForGroup: number): number {
  if (setsForGroup <= 10) return 1;
  // Each additional set above 10 reduces recovery by ~2.5%, floor at 0.7
  return Math.max(0.7, 1 - (setsForGroup - 10) * 0.025);
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build a map of muscle-group-id → recovery % (0–100) based on workout history.
 *
 * @param history  Completed sessions, newest-first or any order.
 * @param groups   Muscle group definitions (defaults to MUSCLE_GROUPS).
 * @param now      Reference time (defaults to Date.now(), injectable for tests).
 */
export function calculateMuscleGroupRecovery(
  history: CompletedSession[],
  groups: MuscleGroupInfo[] = MUSCLE_GROUPS,
  now: number = Date.now(),
): Record<string, number> {
  const result: Record<string, number> = {};

  // Pre-index: exerciseId → primary muscles from exercise names in history.
  // We don't have access to the exercise library directly here, but we can
  // match exercise names in the completed session against the muscle group's
  // muscleIds using the muscle ↔ group mapping.

  // Build reverse map: muscleId → group IDs that contain it
  const muscleToGroups = new Map<MuscleId, string[]>();
  for (const group of groups) {
    for (const mid of group.muscleIds) {
      const existing = muscleToGroups.get(mid) ?? [];
      existing.push(group.id);
      muscleToGroups.set(mid, existing);
    }
  }

  // For each group, find the most recent session that worked those muscles,
  // and count the sets targeting that group.
  for (const group of groups) {
    let mostRecentTs: number | null = null;
    let totalSets = 0;

    // We scan all sessions, find matching exercises by checking if any
    // exercise.exerciseName hints at the group. Since we don't have full
    // muscle mapping on completed exercises, we rely on a simpler heuristic:
    // check if the completed exercise name is associated with this muscle
    // group by scanning all exercises in all sessions and matching via the
    // workout store's exercise data.
    //
    // However, a more reliable approach: the caller can provide enriched
    // history. For now, we use a keyword/muscle-name matching approach on
    // the exercise name → this is a reasonable heuristic.
    //
    // Better approach: we look at the session's exercises and match against
    // a pre-built map. For the MVP, we'll estimate based on session timing
    // only, and use a simple name-based heuristic.

    for (const session of history) {
      const sessionTs = new Date(session.completedAt).getTime();
      let sessionHitsGroup = false;
      let sessionSets = 0;

      for (const exercise of session.exercises) {
        if (exerciseTargetsGroup(exercise.exerciseName, group, exercise.exerciseId)) {
          sessionHitsGroup = true;
          sessionSets += exercise.sets.length;
        }
      }

      if (sessionHitsGroup) {
        if (mostRecentTs === null || sessionTs > mostRecentTs) {
          mostRecentTs = sessionTs;
        }
        // Only count sets from the most recent week to keep volume relevant
        const daysSince = (now - sessionTs) / (1000 * 60 * 60 * 24);
        if (daysSince <= 7) {
          totalSets += sessionSets;
        }
      }
    }

    if (mostRecentTs === null) {
      // Never worked this group → fully recovered
      result[group.id] = 100;
    } else {
      const hoursSince = (now - mostRecentTs) / (1000 * 60 * 60);
      const base = baseRecovery(hoursSince);
      const adjusted = base * volumeMultiplier(totalSets);
      result[group.id] = Math.round(Math.min(100, Math.max(0, adjusted)));
    }
  }

  return result;
}

// ── Exercise → Group Mapping ─────────────────────────────────────────

/** Map exercise category from the library to recovery muscle group IDs. */
const CATEGORY_TO_GROUPS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['back', 'lower_back'],
  shoulders: ['shoulders'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'hip_flexors'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs'],
  full_body: ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes'],
};

/** Build an exerciseId → category lookup from the exercise library. */
const _exerciseCategoryCache = new Map<string, string>();
function getExerciseCategory(exerciseId: string): string | undefined {
  if (_exerciseCategoryCache.size === 0) {
    for (const entry of EXERCISE_LIBRARY) {
      _exerciseCategoryCache.set(entry.id, entry.category);
    }
  }
  return _exerciseCategoryCache.get(exerciseId);
}

/**
 * More specific keyword fallback — only used when the exercise has no
 * exerciseId match in the library. Keywords are intentionally narrow
 * to avoid false positives (e.g. 'bench press' not just 'press').
 */
const GROUP_KEYWORDS: Record<string, string[]> = {
  abs: ['ab', 'crunch', 'sit-up', 'situp', 'plank', 'hollow', 'leg raise', 'v-up', 'woodchop'],
  back: ['row', 'pull-up', 'pullup', 'chin-up', 'chinup', 'lat ', 'pulldown', 'deadlift', 'back extension'],
  biceps: ['curl', 'bicep', 'preacher', 'hammer curl'],
  chest: ['bench', 'chest', 'push-up', 'pushup', 'fly', 'flye', 'bench press', 'pec'],
  glutes: ['glute', 'hip thrust', 'glute bridge', 'squat', 'deadlift', 'lunge'],
  hamstrings: ['hamstring', 'leg curl', 'romanian', 'rdl', 'deadlift', 'good morning', 'nordic'],
  quadriceps: ['squat', 'leg press', 'leg extension', 'lunge', 'quad', 'front squat', 'hack'],
  shoulders: ['shoulder', 'overhead press', 'lateral raise', 'delt', 'military press', 'arnold press', 'shoulder press'],
  triceps: ['tricep', 'pushdown', 'skull', 'dip', 'close grip', 'tricep kickback', 'tricep extension'],
  lower_back: ['back extension', 'hyperextension', 'good morning', 'deadlift', 'superman'],
  calves: ['calf', 'calves', 'calf raise', 'heel raise'],
  forearms: ['forearm', 'wrist curl', 'grip', 'farmer'],
  hip_flexors: ['hip flexor', 'psoas', 'mountain climber', 'adductor', 'abductor'],
};

/** Check if an exercise targets a muscle group, preferring category lookup over keywords. */
function exerciseTargetsGroup(
  exerciseName: string,
  group: MuscleGroupInfo,
  exerciseId?: string,
): boolean {
  // 1. Try category-based matching via exercise library
  if (exerciseId) {
    const category = getExerciseCategory(exerciseId);
    if (category) {
      const mappedGroups = CATEGORY_TO_GROUPS[category];
      if (mappedGroups) {
        return mappedGroups.includes(group.id);
      }
    }
  }

  // 2. Fallback to keyword matching
  const name = exerciseName.toLowerCase();
  const keywords = GROUP_KEYWORDS[group.id];
  if (!keywords) return false;
  return keywords.some((kw) => name.includes(kw));
}

/**
 * Hook-friendly wrapper: call with the store's history and get recovery data.
 *
 * Usage:
 * ```tsx
 * const { history } = useWorkoutStore();
 * const recoveryData = useMemo(() => calculateMuscleGroupRecovery(history), [history]);
 * ```
 */
export function getRecoveryData(history: CompletedSession[]): Record<string, number> {
  return calculateMuscleGroupRecovery(history);
}
