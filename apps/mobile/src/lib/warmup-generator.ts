// ── Warm-up Generator ──────────────────────────────────────────────
// Generates a personalised warm-up plan based on target muscle groups.

export interface WarmupExercise {
  id: string;
  name: string;
  type: 'foam_roll' | 'dynamic_stretch' | 'static_stretch' | 'light_cardio' | 'activation';
  targetMuscles: string[];
  sets: number;
  reps?: number;
  durationSeconds?: number;
  estimatedTimeSeconds: number;
}

export interface WarmupPlan {
  exercises: WarmupExercise[];
  totalEstimatedMinutes: number;
}

// ── Warm-up Exercise Database ──────────────────────────────────────

const WARMUP_EXERCISES: WarmupExercise[] = [
  // Light Cardio
  { id: 'wu_treadmill', name: 'Walking - Treadmill', type: 'light_cardio', targetMuscles: ['full_body'], sets: 1, durationSeconds: 300, estimatedTimeSeconds: 300 },
  { id: 'wu_rowing', name: 'Rowing Machine', type: 'light_cardio', targetMuscles: ['full_body', 'back'], sets: 1, durationSeconds: 300, estimatedTimeSeconds: 300 },
  { id: 'wu_jump_rope', name: 'Jump Rope', type: 'light_cardio', targetMuscles: ['full_body', 'calves'], sets: 1, durationSeconds: 180, estimatedTimeSeconds: 180 },
  // Foam Rolling
  { id: 'wu_foam_quads', name: 'Foam Roll Quadriceps', type: 'foam_roll', targetMuscles: ['legs', 'quadriceps'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  { id: 'wu_foam_hamstrings', name: 'Foam Roll Hamstrings', type: 'foam_roll', targetMuscles: ['legs', 'hamstrings'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  { id: 'wu_foam_back', name: 'Foam Roll Upper Back', type: 'foam_roll', targetMuscles: ['back'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  { id: 'wu_foam_chest', name: 'Foam Roll Chest', type: 'foam_roll', targetMuscles: ['chest'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  { id: 'wu_foam_calves', name: 'Foam Roll Calves', type: 'foam_roll', targetMuscles: ['legs', 'calves'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  { id: 'wu_foam_glutes', name: 'Foam Roll Glutes', type: 'foam_roll', targetMuscles: ['legs', 'glutes'], sets: 1, reps: 8, estimatedTimeSeconds: 120 },
  // Dynamic Stretches
  { id: 'wu_arm_circles', name: 'Arm Circles', type: 'dynamic_stretch', targetMuscles: ['shoulders'], sets: 2, reps: 10, estimatedTimeSeconds: 60 },
  { id: 'wu_leg_swings', name: 'Leg Swings', type: 'dynamic_stretch', targetMuscles: ['legs', 'hip_flexors'], sets: 2, reps: 10, estimatedTimeSeconds: 60 },
  { id: 'wu_wall_pec_stretch', name: 'Wall Pectoral Stretch', type: 'dynamic_stretch', targetMuscles: ['chest'], sets: 2, durationSeconds: 15, estimatedTimeSeconds: 60 },
  { id: 'wu_cat_cow', name: 'Cat-Cow Stretch', type: 'dynamic_stretch', targetMuscles: ['back', 'core'], sets: 2, reps: 8, estimatedTimeSeconds: 60 },
  { id: 'wu_hip_circles', name: 'Hip Circles', type: 'dynamic_stretch', targetMuscles: ['legs', 'hip_flexors'], sets: 2, reps: 8, estimatedTimeSeconds: 60 },
  { id: 'wu_knee_chest', name: 'Knee to Chest Stretch', type: 'dynamic_stretch', targetMuscles: ['legs', 'back'], sets: 2, durationSeconds: 15, estimatedTimeSeconds: 60 },
  { id: 'wu_butt_kicks', name: 'Butt Kicks', type: 'dynamic_stretch', targetMuscles: ['legs', 'quadriceps'], sets: 2, reps: 8, estimatedTimeSeconds: 60 },
  { id: 'wu_shoulder_pass', name: 'Shoulder Pass-Through', type: 'dynamic_stretch', targetMuscles: ['shoulders'], sets: 2, reps: 10, estimatedTimeSeconds: 60 },
  { id: 'wu_bear_crawl', name: 'Bear Crawl', type: 'dynamic_stretch', targetMuscles: ['full_body', 'core'], sets: 2, reps: 8, estimatedTimeSeconds: 90 },
  // Activation
  { id: 'wu_band_pull_apart', name: 'Band Pull-Apart', type: 'activation', targetMuscles: ['back', 'shoulders'], sets: 2, reps: 12, estimatedTimeSeconds: 90 },
  { id: 'wu_glute_bridge', name: 'Glute Bridge', type: 'activation', targetMuscles: ['legs', 'glutes'], sets: 2, reps: 10, estimatedTimeSeconds: 90 },
  { id: 'wu_dead_bug', name: 'Dead Bug', type: 'activation', targetMuscles: ['core'], sets: 2, reps: 8, estimatedTimeSeconds: 90 },
  { id: 'wu_scap_pushup', name: 'Scapular Push-Up', type: 'activation', targetMuscles: ['chest', 'shoulders'], sets: 2, reps: 10, estimatedTimeSeconds: 90 },
];

// ── Helpers ────────────────────────────────────────────────────────

function byType(type: WarmupExercise['type']): WarmupExercise[] {
  return WARMUP_EXERCISES.filter((e) => e.type === type);
}

/** Score an exercise by how many of the target muscles it matches. */
function relevanceScore(exercise: WarmupExercise, targets: string[]): number {
  return exercise.targetMuscles.reduce(
    (score, m) => score + (targets.includes(m) || m === 'full_body' ? 1 : 0),
    0,
  );
}

/** Fisher-Yates shuffle for unbiased randomization. */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Pick the most relevant exercises for the given targets, with a shuffled tiebreak. */
function pickRelevant(
  pool: WarmupExercise[],
  targets: string[],
  count: number,
): WarmupExercise[] {
  const scored = pool
    .map((e) => ({ exercise: e, score: relevanceScore(e, targets) }))
    .filter((e) => e.score > 0);

  // Group by score, shuffle within each score tier, then flatten
  scored.sort((a, b) => b.score - a.score);
  let i = 0;
  while (i < scored.length) {
    let j = i;
    while (j < scored.length && scored[j].score === scored[i].score) j++;
    const tier = shuffle(scored.slice(i, j));
    for (let k = 0; k < tier.length; k++) scored[i + k] = tier[k];
    i = j;
  }

  return scored.slice(0, count).map((e) => e.exercise);
}

/** Pick one random exercise from a pool. */
function pickOne(pool: WarmupExercise[]): WarmupExercise {
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Generator ──────────────────────────────────────────────────────

export function generateWarmup(targetMuscleGroups: string[]): WarmupPlan {
  const targets = targetMuscleGroups.length > 0 ? targetMuscleGroups : ['full_body'];
  const exercises: WarmupExercise[] = [];

  // 1. Light cardio — always 1
  const cardioPool = byType('light_cardio');
  // Prefer rowing for back days
  const cardio = targets.includes('back')
    ? cardioPool.find((e) => e.id === 'wu_rowing') ?? pickOne(cardioPool)
    : pickOne(cardioPool);
  exercises.push(cardio);

  // 2. Foam rolling — 1-2 exercises matching target muscles
  const foamPicks = pickRelevant(byType('foam_roll'), targets, 2);
  // Ensure at least 1 if we have matches
  if (foamPicks.length > 0) {
    exercises.push(...foamPicks.slice(0, foamPicks.length >= 2 ? 2 : 1));
  }

  // 3. Dynamic stretches — 1-2 exercises matching target muscles
  const stretchPicks = pickRelevant(byType('dynamic_stretch'), targets, 2);
  if (stretchPicks.length > 0) {
    exercises.push(...stretchPicks.slice(0, stretchPicks.length >= 2 ? 2 : 1));
  }

  // 4. Activation — 0-1 exercise if relevant
  const activationPicks = pickRelevant(byType('activation'), targets, 1);
  if (activationPicks.length > 0) {
    exercises.push(activationPicks[0]);
  }

  // Trim to 3-5 exercises total
  const plan = exercises.slice(0, 5);

  const totalSeconds = plan.reduce((sum, e) => sum + e.estimatedTimeSeconds, 0);
  const totalEstimatedMinutes = Math.round(totalSeconds / 60);

  return { exercises: plan, totalEstimatedMinutes };
}
