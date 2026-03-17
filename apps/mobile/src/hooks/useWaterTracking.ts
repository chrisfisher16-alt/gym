import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';

const GLASS_ML = 250;

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

  const addGlass = () => logWater(GLASS_ML);
  const removeGlass = () => setWater(Math.max(0, waterIntake - GLASS_ML));
  const addCustom = (ml: number) => logWater(ml);

  return {
    waterIntake,
    waterTarget,
    glasses,
    targetGlasses,
    progress,
    addGlass,
    removeGlass,
    addCustom,
    GLASS_ML,
  };
}
