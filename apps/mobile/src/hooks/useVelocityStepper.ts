// ── Velocity Stepper Hook ──────────────────────────────────────
// Provides accelerating increment/decrement for stepper buttons.
// Hold to accelerate: numbers increment faster the longer you hold,
// with haptic rhythm that speeds up (Linear-style acceleration curve).

import { useCallback, useEffect, useRef, useState } from 'react';
import { weightIncrement as weightIncrementHaptic, selectionFeedback } from '../lib/haptics';

export interface AccelerationStage {
  /** Milliseconds of hold before this stage activates */
  delay: number;
  /** Increment amount at this stage */
  step: number;
  /** Milliseconds between haptic fires at this stage */
  hapticInterval: number;
}

export interface VelocityStepperOptions {
  /** Current value (read on each tick for clamping) */
  initialValue: number;
  /** Base increment per step (e.g. 2.5 for weight, 1 for reps) */
  step: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Called on each increment with the new value */
  onChange: (value: number) => void;
  /** Customizable acceleration stages (defaults provided) */
  accelerationStages?: AccelerationStage[];
}

/** Default acceleration stages for weight steppers */
export const WEIGHT_STAGES: AccelerationStage[] = [
  { delay: 0, step: 2.5, hapticInterval: 400 },
  { delay: 400, step: 5, hapticInterval: 200 },
  { delay: 1200, step: 10, hapticInterval: 100 },
];

/** Default acceleration stages for rep steppers */
export const REP_STAGES: AccelerationStage[] = [
  { delay: 0, step: 1, hapticInterval: 400 },
  { delay: 400, step: 1, hapticInterval: 200 },
  { delay: 1200, step: 2, hapticInterval: 100 },
];

const MIN_HAPTIC_INTERVAL = 80;

interface VelocityStepperReturn {
  /** Call on button pressIn with 'up' or 'down' */
  handlePressIn: (direction: 'up' | 'down') => void;
  /** Call on button pressOut to stop */
  handlePressOut: () => void;
  /** True when past the first acceleration stage */
  isAccelerating: boolean;
  /** Normalized 0–1 speed value for driving visual effects */
  currentSpeed: number;
}

export function useVelocityStepper(options: VelocityStepperOptions): VelocityStepperReturn {
  const {
    initialValue,
    step,
    min = 0,
    max,
    onChange,
    accelerationStages,
  } = options;

  // Build stages: if custom stages provided use them, otherwise use step to
  // build default 3-stage curve
  const stages: AccelerationStage[] = accelerationStages ?? [
    { delay: 0, step, hapticInterval: 400 },
    { delay: 400, step: step * 2, hapticInterval: 200 },
    { delay: 1200, step: step * 4, hapticInterval: 100 },
  ];

  const [isAccelerating, setIsAccelerating] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Refs to manage the hold timer state without re-renders
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const holdStartRef = useRef<number>(0);
  const currentStageRef = useRef(0);
  const directionRef = useRef<'up' | 'down'>('up');
  const valueRef = useRef(initialValue);
  const lastHapticRef = useRef(0);
  const isHoldingRef = useRef(false);
  const hasTickedRef = useRef(false);

  // Keep valueRef in sync with external value
  useEffect(() => {
    valueRef.current = initialValue;
  }, [initialValue]);

  const clamp = useCallback(
    (val: number): number => {
      let clamped = Math.max(min, val);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max],
  );

  const fireHaptic = useCallback((stageIndex: number) => {
    const now = Date.now();
    if (now - lastHapticRef.current < MIN_HAPTIC_INTERVAL) return;
    lastHapticRef.current = now;

    if (stageIndex >= 2) {
      // Stage 3+: lighter selection feedback for rapid fire
      selectionFeedback();
    } else {
      // Stage 1-2: weight increment haptic (light impact)
      weightIncrementHaptic();
    }
  }, []);

  const tick = useCallback(() => {
    const stage = stages[currentStageRef.current];
    if (!stage) return;

    const delta = directionRef.current === 'up' ? stage.step : -stage.step;
    const newVal = clamp(
      // Round to avoid floating point drift (e.g. 2.5 + 2.5 = 5.0 exactly)
      Math.round((valueRef.current + delta) * 100) / 100,
    );
    valueRef.current = newVal;
    onChange(newVal);
    fireHaptic(currentStageRef.current);
    hasTickedRef.current = true;
  }, [stages, clamp, onChange, fireHaptic]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stageTimeoutsRef.current.forEach(clearTimeout);
    stageTimeoutsRef.current = [];
  }, []);

  const startStage = useCallback(
    (stageIndex: number) => {
      if (!isHoldingRef.current) return;
      currentStageRef.current = stageIndex;

      // Update visual state
      const speed = stages.length > 1 ? stageIndex / (stages.length - 1) : 0;
      setCurrentSpeed(speed);
      setIsAccelerating(stageIndex > 0);

      // Clear existing interval and start new one at this stage's rate
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }

      const stage = stages[stageIndex];
      if (!stage) return;

      intervalRef.current = setInterval(() => {
        if (!isHoldingRef.current) {
          clearTimers();
          return;
        }
        tick();
      }, stage.hapticInterval);
    },
    [stages, tick, clearTimers],
  );

  const handlePressIn = useCallback(
    (direction: 'up' | 'down') => {
      directionRef.current = direction;
      isHoldingRef.current = true;
      hasTickedRef.current = false;
      holdStartRef.current = Date.now();

      // Fire one immediate increment on press (the "tap" case)
      const firstStage = stages[0];
      if (!firstStage) return;

      const delta = direction === 'up' ? firstStage.step : -firstStage.step;
      const newVal = clamp(
        Math.round((valueRef.current + delta) * 100) / 100,
      );
      valueRef.current = newVal;
      onChange(newVal);
      fireHaptic(0);
      hasTickedRef.current = true;

      // Schedule stage transitions
      clearTimers();

      // Start repeating at stage 0 rate after initial delay
      const initialDelay = stages[0].hapticInterval;
      const timeout0 = setTimeout(() => {
        if (!isHoldingRef.current) return;
        startStage(0);
      }, initialDelay);
      stageTimeoutsRef.current.push(timeout0);

      // Schedule transitions to higher stages
      for (let i = 1; i < stages.length; i++) {
        const stage = stages[i];
        if (!stage) continue;
        const timeout = setTimeout(() => {
          startStage(i);
        }, stage.delay + initialDelay);
        stageTimeoutsRef.current.push(timeout);
      }
    },
    [stages, clamp, onChange, fireHaptic, clearTimers, startStage],
  );

  const handlePressOut = useCallback(() => {
    isHoldingRef.current = false;
    clearTimers();
    setIsAccelerating(false);
    setCurrentSpeed(0);
    currentStageRef.current = 0;
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isHoldingRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    handlePressIn,
    handlePressOut,
    isAccelerating,
    currentSpeed,
  };
}
