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
  const prependExercisesToSession = useWorkoutStore((s) => s.prependExercisesToSession);
  const removeExerciseFromSession = useWorkoutStore((s) => s.removeExerciseFromSession);
  const skipExercise = useWorkoutStore((s) => s.skipExercise);
  const reorderExercises = useWorkoutStore((s) => s.reorderExercises);
  const setCurrentExerciseIndex = useWorkoutStore((s) => s.setCurrentExerciseIndex);
  const completeWorkout = useWorkoutStore((s) => s.completeWorkout);
  const cancelWorkout = useWorkoutStore((s) => s.cancelWorkout);
  const createSuperset = useWorkoutStore((s) => s.createSuperset);
  const removeSuperset = useWorkoutStore((s) => s.removeSuperset);
  const createSupersetGroup = useWorkoutStore((s) => s.createSupersetGroup);
  const removeSupersetGroup = useWorkoutStore((s) => s.removeSupersetGroup);
  const replaceExercise = useWorkoutStore((s) => s.replaceExercise);
  const logTimedSet = useWorkoutStore((s) => s.logTimedSet);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const clearRestTimer = useWorkoutStore((s) => s.clearRestTimer);
  const extendRestTimer = useWorkoutStore((s) => s.extendRestTimer);
  const defaultRestSeconds = useWorkoutStore((s) => s.defaultRestSeconds);
  const setDefaultRestSeconds = useWorkoutStore((s) => s.setDefaultRestSeconds);
  const updateSessionNotes = useWorkoutStore((s) => s.updateSessionNotes);
  const updateSessionMood = useWorkoutStore((s) => s.updateSessionMood);
  const updateSessionName = useWorkoutStore((s) => s.updateSessionName);
  const cascadeWeight = useWorkoutStore((s) => s.cascadeWeight);

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
  const originalDurationRef = useRef(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);

  useEffect(() => {
    if (activeSession?.restTimerEndAt) {
      // Capture original duration when a new rest timer starts
      if (!isRestTimerActive) {
        originalDurationRef.current = activeSession.restTimerDuration ?? 0;
      }
      setIsRestTimerActive(true);
      const update = () => {
        const endTime = new Date(activeSession.restTimerEndAt!).getTime();
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setRestSecondsLeft(remaining);
        if (remaining <= 0) {
          // Stop the interval but don't clear timer state —
          // let the overlay detect restSecondsLeft===0 and fire completion effects first
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
      setIsRestTimerActive(false);
      originalDurationRef.current = 0;
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    }
  }, [activeSession?.restTimerEndAt]);

  const isActive = !!activeSession;

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
    prependExercisesToSession,
    removeExerciseFromSession,
    skipExercise,
    reorderExercises,
    goToNextExercise,
    goToPreviousExercise,
    setCurrentExerciseIndex,

    // Superset
    createSuperset,
    removeSuperset,
    createSupersetGroup,
    removeSupersetGroup,

    // Exercise replacement
    replaceExercise,

    // Timed sets
    logTimedSet,

    // Rest timer
    startRestTimer,
    clearRestTimer,
    extendRestTimer,
    defaultRestSeconds,
    setDefaultRestSeconds,
    restTimerDuration: activeSession?.restTimerDuration ?? 0,
    restTimerOriginalDuration: originalDurationRef.current,

    // Weight cascade
    cascadeWeight,
  };
}
