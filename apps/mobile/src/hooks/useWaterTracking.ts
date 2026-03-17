import { useMemo, useCallback } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';

let Haptics: typeof import('expo-haptics') | null = null;
try { Haptics = require('expo-haptics'); } catch {}

const GLASS_ML = 250;
const OZ_8_ML = 237;
const OZ_16_ML = 473;

export function useWaterTracking() {
  const logWater = useNutritionStore((s) => s.logWater);
  const setWater = useNutritionStore((s) => s.setWater);
  const targets = useNutritionStore((s) => s.targets);
  const selectedDate = useNutritionStore((s) => s.selectedDate);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const waterIntake = dailyLogs[selectedDate]?.waterIntake_ml ?? 0;
  const waterTarget = targets.water_ml;

  const glasses = useMemo(
    () => Math.floor(waterIntake / GLASS_ML),
    [waterIntake],
  );

  const targetGlasses = useMemo(
    () => Math.ceil(waterTarget / GLASS_ML),
    [waterTarget],
  );

  const progress = waterTarget > 0 ? waterIntake / waterTarget : 0;

  const hapticFeedback = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const addGlass = useCallback(() => {
    logWater(GLASS_ML);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const add8oz = useCallback(() => {
    logWater(OZ_8_ML);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const add16oz = useCallback(() => {
    logWater(OZ_16_ML);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const addCustom = useCallback((ml: number) => {
    logWater(ml);
    hapticFeedback();
  }, [logWater, hapticFeedback]);

  const removeGlass = useCallback(() => {
    setWater(Math.max(0, waterIntake - GLASS_ML));
    hapticFeedback();
  }, [setWater, waterIntake, hapticFeedback]);

  return {
    waterIntake,
    waterTarget,
    glasses,
    targetGlasses,
    progress,
    addGlass,
    add8oz,
    add16oz,
    removeGlass,
    addCustom,
    GLASS_ML,
    OZ_8_ML,
    OZ_16_ML,
  };
}
