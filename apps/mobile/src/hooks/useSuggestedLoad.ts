import { useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import { useProfileStore } from '../stores/profile-store';
import { getSuggestedLoad, getLastPerformance } from '../lib/suggested-load';
import type { LoadSuggestion } from '../types/workout';

export function useSuggestedLoad(
  exerciseId: string,
  targetReps: string = '8-12',
  targetSets: number = 3,
) {
  const history = useWorkoutStore((s) => s.history);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);

  const isMetric = unitPref === 'metric';
  const unit = isMetric ? 'kg' : 'lbs';

  const suggestion: LoadSuggestion | null = useMemo(
    () => getSuggestedLoad(exerciseId, targetReps, targetSets, history, isMetric),
    [exerciseId, targetReps, targetSets, history, isMetric],
  );

  const lastPerformance: string | null = useMemo(
    () => getLastPerformance(exerciseId, history, unit),
    [exerciseId, history, unit],
  );

  return {
    suggestion,
    lastPerformance,
    unit,
    isMetric,
  };
}
