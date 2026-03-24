import type { CompletedSession, CompletedExercise, MuscleGroup, ExerciseLibraryEntry } from '../types/workout';
import { useWorkoutStore } from '../stores/workout-store';

// ── Muscle Group Colors ───────────────────────────────────────────────

const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  chest: '#E53935',
  back: '#1E88E5',
  shoulders: '#FB8C00',
  legs: '#43A047',
  arms: '#8E24AA',
  core: '#00897B',
  cardio: '#EC407A',
  full_body: '#5C6BC0',
  warmup: '#BDBDBD',
  cooldown: '#90A4AE',
};

const DEFAULT_COLOR = '#757575';

// ── Types ─────────────────────────────────────────────────────────────

export interface FingerprintSegment {
  angle: number; // start angle in degrees (0–360)
  sweep: number; // arc sweep in degrees
  radius: number; // 0–1 normalized (intensity)
  color: string; // muscle group color
  thickness: number; // 0–1 normalized (relative volume)
}

export interface FingerprintData {
  segments: FingerprintSegment[];
  centerColor: string; // dominant muscle group color
  totalIntensity: number; // 0–1 overall workout intensity
}

// ── Helpers ───────────────────────────────────────────────────────────

function getExerciseCategory(exerciseId: string): MuscleGroup | null {
  const exercises: ExerciseLibraryEntry[] = useWorkoutStore.getState().exercises;
  const entry = exercises.find((e) => e.id === exerciseId);
  return entry?.category ?? null;
}

function getExerciseVolume(exercise: CompletedExercise): number {
  return exercise.sets.reduce((total, set) => {
    const weight = set.weight ?? 0;
    const reps = set.reps ?? 0;
    // For bodyweight / time-based exercises, give a baseline volume so they don't disappear
    if (weight === 0 && reps > 0) return total + reps;
    if (weight === 0 && set.durationSeconds) return total + set.durationSeconds;
    return total + weight * reps;
  }, 0);
}

function getExerciseIntensity(exercise: CompletedExercise): number {
  // Use max weight across sets as a proxy for intensity
  // For bodyweight exercises, use RPE if available, else default 0.5
  const maxWeight = Math.max(...exercise.sets.map((s) => s.weight ?? 0));
  if (maxWeight > 0) {
    // Normalize: we'll compute relative intensity across exercises in the session
    return maxWeight;
  }
  // For bodyweight/time-based: use average RPE or a default
  const rpes = exercise.sets.map((s) => s.rpe).filter((r): r is number => r != null);
  if (rpes.length > 0) {
    return (rpes.reduce((a, b) => a + b, 0) / rpes.length) / 10; // RPE 6-10 → 0.6-1.0
  }
  return 0.5;
}

// ── Main Generator ────────────────────────────────────────────────────

export function generateFingerprint(session: CompletedSession): FingerprintData {
  const exercises = session.exercises;

  // Empty session → return a neutral fingerprint
  if (exercises.length === 0) {
    return {
      segments: [],
      centerColor: DEFAULT_COLOR,
      totalIntensity: 0,
    };
  }

  // Calculate volumes and intensities per exercise
  const exerciseData = exercises.map((ex) => {
    const category = getExerciseCategory(ex.exerciseId);
    const color = category ? MUSCLE_GROUP_COLORS[category] : DEFAULT_COLOR;
    const volume = getExerciseVolume(ex);
    const rawIntensity = getExerciseIntensity(ex);
    return { exercise: ex, category, color, volume, rawIntensity };
  });

  // Normalize intensity across session (relative to max in this workout)
  const maxRawIntensity = Math.max(...exerciseData.map((d) => d.rawIntensity), 1);
  // Normalize volume (relative to max in this workout)
  const maxVolume = Math.max(...exerciseData.map((d) => d.volume), 1);

  // Divide 360° evenly among exercises
  const sweepPerExercise = 360 / exercises.length;

  const segments: FingerprintSegment[] = exerciseData.map((data, i) => ({
    angle: i * sweepPerExercise,
    sweep: sweepPerExercise,
    radius: maxRawIntensity > 0 ? Math.max(0.2, data.rawIntensity / maxRawIntensity) : 0.5,
    color: data.color,
    thickness: maxVolume > 0 ? Math.max(0.15, data.volume / maxVolume) : 0.5,
  }));

  // Dominant muscle group = the one with most total volume
  const volumeByColor = new Map<string, number>();
  for (const data of exerciseData) {
    volumeByColor.set(data.color, (volumeByColor.get(data.color) ?? 0) + data.volume);
  }
  let centerColor = DEFAULT_COLOR;
  let maxGroupVolume = 0;
  for (const [color, vol] of volumeByColor) {
    if (vol > maxGroupVolume) {
      maxGroupVolume = vol;
      centerColor = color;
    }
  }

  // Total intensity = session total volume normalized (0–1 capped)
  // Use a heuristic: total volume / (number of exercises * reasonable max per exercise)
  const totalSessionVolume = exerciseData.reduce((sum, d) => sum + d.volume, 0);
  const avgVolumePerExercise = totalSessionVolume / exercises.length;
  // Clamp to 0–1 using a sigmoid-like approach with a soft cap at ~5000 per exercise
  const totalIntensity = Math.min(1, avgVolumePerExercise / 5000);

  return {
    segments,
    centerColor,
    totalIntensity,
  };
}
