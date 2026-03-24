import { useEffect } from 'react';
import { useSmartWorkoutStore } from '../stores/smart-workout-store';
import { useWorkoutStore } from '../stores/workout-store';

/**
 * Convenience hook for smart workout generation.
 *
 * Auto-generates a workout on mount when in `ai_suggested` mode
 * and no cached workout exists for today.
 */
export function useSmartWorkout() {
  const store = useSmartWorkoutStore();
  const isActive = useWorkoutStore((s) => s.activeSession !== null);

  // Auto-generate on mount if no cached workout for today
  useEffect(() => {
    if (
      store.workoutMode === 'ai_suggested' &&
      !store.cachedWorkout &&
      !store.isGenerating &&
      !store.error &&
      !isActive
    ) {
      store.generateSmartWorkout();
    }
  }, [store.workoutMode, store.cachedWorkout, store.isGenerating, store.error, isActive]);

  return {
    workout: store.cachedWorkout,
    isGenerating: store.isGenerating,
    workoutMode: store.workoutMode,
    error: store.error,
    generate: store.generateSmartWorkout,
    swap: store.swapSmartWorkout,
    customize: store.customizeSmartWorkout,
    start: store.startSmartWorkout,
    setMode: store.setWorkoutMode,
  };
}
