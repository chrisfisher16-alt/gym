// ── AI Workout Generator ────────────────────────────────────────────
// Generates workout sessions via the AI provider, using the user's
// profile, equipment, experience, recent workouts, and active program.

import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { useProfileStore } from '../stores/profile-store';
import { useWorkoutStore } from '../stores/workout-store';
import type { ExerciseLibraryEntry } from '../types/workout';

// ── Types ───────────────────────────────────────────────────────────

export interface GenerateWorkoutOptions {
  /** Free-form user prompt, e.g. "chest and triceps hypertrophy" */
  prompt: string;
}

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes?: string;
}

export interface GenerateWorkoutResult {
  name: string;
  exercises: GeneratedExercise[];
  model: string;
}

// ── Raw AI response shape ───────────────────────────────────────────

interface AIWorkoutResponse {
  name: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
  }>;
}

// ── Context builders ────────────────────────────────────────────────

function buildWorkoutContext(): string {
  const profile = useProfileStore.getState().profile;
  const { history, programs, exercises } = useWorkoutStore.getState();

  const lines: string[] = [];

  // Goals
  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight', gain_muscle: 'Gain Muscle',
    build_lean_muscle: 'Build Lean Muscle', improve_endurance: 'Improve Endurance',
    maintain_weight: 'Maintain Weight', improve_general_health: 'Improve General Health',
  };
  if (profile.healthGoals?.length) {
    lines.push(`Goals: ${profile.healthGoals.map((g) => goalLabels[g] ?? g).join(', ')}`);
  }
  if (profile.primaryGoal) {
    lines.push(`Primary goal: ${profile.primaryGoal}`);
  }

  // Physical stats
  if (profile.trainingExperience) {
    lines.push(`Training experience: ${profile.trainingExperience}`);
  }
  if (profile.trainingDaysPerWeek) {
    lines.push(`Training days/week: ${profile.trainingDaysPerWeek}`);
  }
  if (profile.injuriesOrLimitations) {
    lines.push(`Injuries/limitations: ${profile.injuriesOrLimitations}`);
  }

  // Equipment
  const equipment = profile.fitnessEquipment ?? profile.availableEquipment ?? [];
  if (equipment.length > 0) {
    lines.push(`Available equipment: ${equipment.join(', ')}`);
  }

  // Recent workouts (last 5)
  const recent = history.slice(-5);
  if (recent.length > 0) {
    lines.push('\nRecent workouts:');
    for (const session of recent) {
      const exerciseNames = session.exercises.map((e) => e.exerciseName).join(', ');
      lines.push(`- ${session.name} (${new Date(session.startedAt).toLocaleDateString()}): ${exerciseNames}`);
    }
  }

  // Active program context
  const activeProgram = programs.find((p) => p.isActive);
  if (activeProgram) {
    lines.push(`\nActive program: ${activeProgram.name} (${activeProgram.difficulty}, ${activeProgram.daysPerWeek} days/week)`);
  }

  // Available exercises (names only for reference)
  const exerciseNames = exercises
    .filter((e) => e.category !== 'warmup' && e.category !== 'cooldown')
    .map((e) => e.name);
  lines.push(`\nAvailable exercises in the app's library (use ONLY these exact names):\n${exerciseNames.join(', ')}`);

  return lines.join('\n');
}

// ── System prompt ───────────────────────────────────────────────────

function buildWorkoutSystemPrompt(): string {
  const ctx = buildWorkoutContext();

  return `You are a workout programming AI for a health and fitness app. Generate a single workout session based on the user's prompt, goals, equipment, and experience.

## User Context
${ctx}

## Requirements
- ONLY use exercises from the "Available exercises" list above. Use the EXACT exercise names.
- Respect the user's injuries/limitations — avoid movements that aggravate them.
- Match volume and intensity to the user's experience level.
- Consider recent workouts to avoid overtraining the same muscle groups back-to-back.
- Use appropriate equipment based on what the user has.
- Include 4–8 exercises per workout.
- Sets: 2–5 per exercise. Reps: appropriate for the goal (e.g. "6-8" for strength, "8-12" for hypertrophy, "12-15" for endurance).
- Rest seconds: 60–90 for hypertrophy, 120–180 for strength, 30–60 for conditioning.

## Output Format
Respond with ONLY a valid JSON object (no markdown fences, no extra text) in this exact shape:
{
  "name": "Workout Name",
  "exercises": [
    {
      "name": "Barbell Bench Press",
      "sets": 4,
      "reps": "8-10",
      "rest_seconds": 90,
      "notes": "Focus on controlled tempo"
    }
  ]
}`;
}

// ── Generator ───────────────────────────────────────────────────────

export async function generateWorkout(
  options: GenerateWorkoutOptions,
): Promise<GenerateWorkoutResult> {
  const config = await getAIConfig();

  if (config.provider === 'demo') {
    return getDemoWorkout();
  }

  const systemPrompt = buildWorkoutSystemPrompt();
  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: options.prompt },
  ];

  const response = await callAI(messages, config);
  const parsed = parseAIWorkoutResponse(response.content);

  return { ...parsed, model: response.model };
}

// ── Response parsing ────────────────────────────────────────────────

function parseAIWorkoutResponse(raw: string): Omit<GenerateWorkoutResult, 'model'> {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const data: AIWorkoutResponse = JSON.parse(cleaned);

  if (!data.name || !data.exercises || !Array.isArray(data.exercises) || data.exercises.length === 0) {
    throw new Error('AI response missing required workout fields');
  }

  const library = useWorkoutStore.getState().exercises;

  const exercises: GeneratedExercise[] = data.exercises.map((aiEx) => {
    // Match by name (case-insensitive)
    const match = findExerciseMatch(aiEx.name, library);
    return {
      exerciseId: match?.id ?? `custom_${aiEx.name.toLowerCase().replace(/\s+/g, '_')}`,
      exerciseName: match?.name ?? aiEx.name,
      targetSets: aiEx.sets ?? 3,
      targetReps: aiEx.reps ?? '8-12',
      restSeconds: aiEx.rest_seconds ?? 90,
      notes: aiEx.notes,
    };
  });

  return { name: data.name, exercises };
}

function findExerciseMatch(
  aiName: string,
  library: ExerciseLibraryEntry[],
): ExerciseLibraryEntry | undefined {
  const lower = aiName.toLowerCase().trim();
  // Exact match first
  const exact = library.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match — AI name contains library name or vice versa
  return library.find(
    (e) => lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower),
  );
}

// ── Demo fallback ───────────────────────────────────────────────────

function getDemoWorkout(): GenerateWorkoutResult {
  return {
    name: 'Full Body Strength',
    exercises: [
      { exerciseId: 'ex_bench_press', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: '6-10', restSeconds: 120 },
      { exerciseId: 'ex_barbell_row', exerciseName: 'Barbell Row', targetSets: 4, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex_barbell_squat', exerciseName: 'Barbell Back Squat', targetSets: 4, targetReps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex_overhead_press', exerciseName: 'Overhead Press', targetSets: 3, targetReps: '8-12', restSeconds: 90 },
      { exerciseId: 'ex_db_lunges', exerciseName: 'Dumbbell Lunges', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
      { exerciseId: 'ex_plank', exerciseName: 'Plank', targetSets: 3, targetReps: '30-45s', restSeconds: 60 },
    ],
    model: 'Demo Mode',
  };
}
