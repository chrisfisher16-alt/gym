import { useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { PersonalRecord } from '../types/workout';

export function usePersonalRecords() {
  const personalRecords = useWorkoutStore((s) => s.personalRecords);
  const history = useWorkoutStore((s) => s.history);

  const getRecordForExercise = (exerciseId: string): PersonalRecord | null => {
    return personalRecords[exerciseId] ?? null;
  };

  const allRecords = useMemo(() => {
    return Object.values(personalRecords);
  }, [personalRecords]);

  const recentPRs = useMemo(() => {
    const prs: Array<{
      exerciseId: string;
      type: 'weight' | 'reps' | 'volume';
      value: number;
      date: string;
    }> = [];

    for (const record of allRecords) {
      if (record.heaviestWeight) {
        prs.push({
          exerciseId: record.exerciseId,
          type: 'weight',
          value: record.heaviestWeight.weight,
          date: record.heaviestWeight.date,
        });
      }
    }

    return prs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [allRecords]);

  // PR history for a specific exercise over time
  const getExercisePRHistory = (exerciseId: string) => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );

    const dataPoints: Array<{
      date: string;
      maxWeight: number;
      maxVolume: number;
    }> = [];

    for (const session of sorted) {
      const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
      if (!exercise) continue;

      let maxWeight = 0;
      let maxVolume = 0;
      for (const set of exercise.sets) {
        if (set.setType === 'warmup') continue;
        if (set.weight && set.weight > maxWeight) maxWeight = set.weight;
        const vol = (set.weight ?? 0) * (set.reps ?? 0);
        if (vol > maxVolume) maxVolume = vol;
      }

      if (maxWeight > 0) {
        dataPoints.push({
          date: session.completedAt,
          maxWeight,
          maxVolume,
        });
      }
    }

    return dataPoints;
  };

  return {
    personalRecords,
    allRecords,
    recentPRs,
    getRecordForExercise,
    getExercisePRHistory,
  };
}
