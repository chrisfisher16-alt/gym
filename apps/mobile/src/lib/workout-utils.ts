import type {
  ActiveWorkoutSession,
  ActiveSet,
  CompletedSession,
  CompletedExercise,
  PersonalRecord,
  DayVolume,
} from '../types/workout';

// ── ID Generation ───────────────────────────────────────────────────

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// ── Time Formatting ─────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimerDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Volume Calculations ─────────────────────────────────────────────

export function calculateSetVolume(weight?: number, reps?: number): number {
  return (weight ?? 0) * (reps ?? 0);
}

export function calculateSessionVolume(session: ActiveWorkoutSession): number {
  let total = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.isCompleted && set.setType !== 'warmup') {
        total += calculateSetVolume(set.weight, set.reps);
      }
    }
  }
  return total;
}

export function calculateCompletedSessionVolume(session: CompletedSession): number {
  return session.totalVolume;
}

export function getCompletedSetsCount(session: ActiveWorkoutSession): number {
  let count = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.isCompleted) count++;
    }
  }
  return count;
}

// ── PR Detection ────────────────────────────────────────────────────

export function checkForPR(
  exerciseId: string,
  weight: number,
  reps: number,
  currentRecords: Record<string, PersonalRecord>,
): { isPR: boolean; prTypes: ('weight' | 'reps' | 'volume')[] } {
  const record = currentRecords[exerciseId];
  const volume = weight * reps;
  const prTypes: ('weight' | 'reps' | 'volume')[] = [];

  if (!record) {
    // First time doing this exercise - it's a PR for everything
    return { isPR: true, prTypes: ['weight', 'reps', 'volume'] };
  }

  if (record.heaviestWeight === null || weight > record.heaviestWeight.weight) {
    prTypes.push('weight');
  }

  if (
    record.mostReps === null ||
    (weight >= (record.mostReps.weight ?? 0) && reps > record.mostReps.reps)
  ) {
    prTypes.push('reps');
  }

  if (record.highestVolume === null || volume > record.highestVolume.volume) {
    prTypes.push('volume');
  }

  return { isPR: prTypes.length > 0, prTypes };
}

export function updatePersonalRecord(
  exerciseId: string,
  weight: number,
  reps: number,
  date: string,
  currentRecords: Record<string, PersonalRecord>,
): PersonalRecord {
  const existing = currentRecords[exerciseId];
  const volume = weight * reps;

  const record: PersonalRecord = existing
    ? { ...existing }
    : {
        exerciseId,
        heaviestWeight: null,
        mostReps: null,
        highestVolume: null,
      };

  if (!record.heaviestWeight || weight > record.heaviestWeight.weight) {
    record.heaviestWeight = { weight, reps, date };
  }

  if (!record.mostReps || (weight >= (record.mostReps.weight ?? 0) && reps > record.mostReps.reps)) {
    record.mostReps = { weight, reps, date };
  }

  if (!record.highestVolume || volume > record.highestVolume.volume) {
    record.highestVolume = { weight, reps, volume, date };
  }

  return record;
}

// ── Session Conversion ──────────────────────────────────────────────

export function activeToCompleted(
  session: ActiveWorkoutSession,
  userId: string,
  personalRecords: Record<string, PersonalRecord>,
): CompletedSession {
  const now = new Date().toISOString();
  const startTime = new Date(session.startedAt).getTime();
  const endTime = Date.now();
  const durationSeconds = Math.floor((endTime - startTime) / 1000);

  let totalVolume = 0;
  let totalSets = 0;
  let prCount = 0;

  const exercises: CompletedExercise[] = session.exercises
    .filter((e) => !e.isSkipped)
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets
        .filter((s) => s.isCompleted)
        .map((set) => {
          const vol = calculateSetVolume(set.weight, set.reps);
          if (set.setType !== 'warmup') {
            totalVolume += vol;
          }
          totalSets++;
          if (set.isPR) prCount++;

          return {
            id: set.id,
            setNumber: set.setNumber,
            setType: set.setType,
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
            isPR: set.isPR,
            completedAt: set.completedAt ?? now,
          };
        }),
    }));

  return {
    id: session.id,
    userId,
    programId: session.programId,
    dayId: session.dayId,
    name: session.name,
    startedAt: session.startedAt,
    completedAt: now,
    durationSeconds,
    exercises,
    totalVolume,
    totalSets,
    prCount,
    notes: session.notes,
    mood: session.mood,
  };
}

// ── History Helpers ──────────────────────────────────────────────────

export function getWeeklyVolume(history: CompletedSession[], weeksBack: number = 1): DayVolume[] {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - weeksBack * 7);

  const volumes: DayVolume[] = [];
  const dayMap = new Map<string, DayVolume>();

  // Initialize all days in range
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dayMap.set(dateStr, { date: dateStr, volume: 0, sets: 0 });
  }

  for (const session of history) {
    const dateStr = new Date(session.completedAt).toISOString().split('T')[0];
    const existing = dayMap.get(dateStr);
    if (existing) {
      existing.volume += session.totalVolume;
      existing.sets += session.totalSets;
    }
  }

  dayMap.forEach((v) => volumes.push(v));
  return volumes.sort((a, b) => a.date.localeCompare(b.date));
}

export function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toLocaleString();
}

export function formatWeight(weight: number, unit: string): string {
  if (weight % 1 === 0) return `${weight}${unit}`;
  return `${weight.toFixed(1)}${unit}`;
}

// ── Date Helpers ────────────────────────────────────────────────────

export function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
