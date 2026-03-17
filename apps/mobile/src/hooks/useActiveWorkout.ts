import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type {
  ActiveWorkoutSession,
  ActiveExercise,
  ExerciseLibraryEntry,
} from '../types/workout';
import { calculateSessionVolume, getCompletedSetsCount, formatDuration } from '../lib/workout-utils';

export function useActiveWorkout() {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const startEmptyWorkout = useWorkoutStore((s) => s.startEmptyWorkout);
  const logSet = useWorkoutStore((s) => s.logSet);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const updateSetRPE = useWorkoutStore((s) => s.updateSetRPE);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const addSet = useWorkoutStore((s) => s.addSet);
  const addExerciseToSession = useWorkoutStore((s) => s.addExerciseToSession);
  const removeExerciseFromSession = useWorkoutStore((s) => s.removeExerciseFromSession);
  const skipExercise = useWorkoutStore((s) => s.skipExercise);
  const reorderExercises = useWorkoutStore((s) => s.reorderExercises);
  const setCurrentExerciseIndex = useWorkoutStore((s) => s.setCurrentExerciseIndex);
  const completeWorkout = useWorkoutStore((s) => s.completeWorkout);
  const cancelWorkout = useWorkoutStore((s) => s.cancelWorkout);
  const createSuperset = useWorkoutStore((s) => s.createSuperset);
  const removeSuperset = useWorkoutStore((s) => s.removeSuperset);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const clearRestTimer = useWorkoutStore((s) => s.clearRestTimer);
  const updateSessionNotes = useWorkoutStore((s) => s.updateSessionNotes);
  const updateSessionMood = useWorkoutStore((s) => s.updateSessionMood);
  const updateSessionName = useWorkoutStore((s) => s.updateSessionName);

  // Elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeSession) {
      const updateElapsed = () => {
        const start = new Date(activeSession.startedAt).getTime();
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      };
      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsedSeconds(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [activeSession?.startedAt, !!activeSession]);

  // Rest timer
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeSession?.restTimerEndAt) {
      const update = () => {
        const endTime = new Date(activeSession.restTimerEndAt!).getTime();
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setRestSecondsLeft(remaining);
        if (remaining <= 0) {
          clearRestTimer();
          if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        }
      };
      update();
      restIntervalRef.current = setInterval(update, 1000);
      return () => {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      };
    } else {
      setRestSecondsLeft(0);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    }
  }, [activeSession?.restTimerEndAt, clearRestTimer]);

  const isActive = !!activeSession;
  const isRestTimerActive = restSecondsLeft > 0;

  const totalVolume = useMemo(
    () => (activeSession ? calculateSessionVolume(activeSession) : 0),
    [activeSession],
  );

  const completedSets = useMemo(
    () => (activeSession ? getCompletedSetsCount(activeSession) : 0),
    [activeSession],
  );

  const currentExercise: ActiveExercise | null = useMemo(() => {
    if (!activeSession) return null;
    return activeSession.exercises[activeSession.currentExerciseIndex] ?? null;
  }, [activeSession]);

  const elapsedDisplay = formatDuration(elapsedSeconds);

  const goToNextExercise = useCallback(() => {
    if (!activeSession) return;
    const nextIndex = Math.min(
      activeSession.currentExerciseIndex + 1,
      activeSession.exercises.length - 1,
    );
    setCurrentExerciseIndex(nextIndex);
  }, [activeSession, setCurrentExerciseIndex]);

  const goToPreviousExercise = useCallback(() => {
    if (!activeSession) return;
    const prevIndex = Math.max(activeSession.currentExerciseIndex - 1, 0);
    setCurrentExerciseIndex(prevIndex);
  }, [activeSession, setCurrentExerciseIndex]);

  return {
    // State
    activeSession,
    isActive,
    elapsedSeconds,
    elapsedDisplay,
    totalVolume,
    completedSets,
    currentExercise,
    isRestTimerActive,
    restSecondsLeft,

    // Session actions
    startWorkout,
    startEmptyWorkout,
    completeWorkout,
    cancelWorkout,
    updateSessionNotes,
    updateSessionMood,
    updateSessionName,

    // Set actions
    logSet,
    completeSet,
    updateSetRPE,
    removeSet,
    addSet,

    // Exercise actions
    addExerciseToSession,
    removeExerciseFromSession,
    skipExercise,
    reorderExercises,
    goToNextExercise,
    goToPreviousExercise,
    setCurrentExerciseIndex,

    // Superset
    createSuperset,
    removeSuperset,

    // Rest timer
    startRestTimer,
    clearRestTimer,
  };
}
