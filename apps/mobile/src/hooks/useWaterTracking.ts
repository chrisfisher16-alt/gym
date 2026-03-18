import { useMemo, useCallback } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';

let Haptics: typeof import('expo-haptics') | null = null;
try { Haptics = require('expo-haptics'); } catch {}

export function useWaterTracking() {
  const logWater = useNutritionStore((s) => s.logWater);
  const setWater = useNutritionStore((s) => s.setWater);
  const targets = useNutritionStore((s) => s.targets);
  const selectedDate = useNutritionStore((s) => s.selectedDate);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const waterIntake = dailyLogs[selectedDate]?.waterIntake_oz ?? 0;
  const waterTarget = targets.water_oz;

  const progress = waterTarget > 0 ? waterIntake / waterTarget : 0;

  const hapticFeedback = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const add8oz = useCallback(() => {
    logWater(8);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const add16oz = useCallback(() => {
    logWater(16);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const addCustom = useCallback((oz: number) => {
    logWater(oz);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const subtract8oz = useCallback(() => {
    setWater(Math.max(0, waterIntake - 8));
    hapticFeedback();
  }, [setWater, waterIntake, hapticFeedback]);

  return {
    waterIntake,
    waterTarget,
    progress,
    add8oz,
    add16oz,
    subtract8oz,
    addCustom,
  };
}
