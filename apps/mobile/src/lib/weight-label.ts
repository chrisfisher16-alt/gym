import type { WeightContext } from '../types/workout';

/**
 * Returns a display label for the weight input based on the exercise's weight context
 * and the user's preferred unit system.
 */
export function getWeightLabel(
  weightContext: WeightContext | undefined,
  unit: 'kg' | 'lbs',
): string {
  if (!weightContext) return `Weight (${unit})`;

  const labels: Record<WeightContext, string> = {
    barbell: `Bar + Plates (${unit})`,
    dumbbell_single: `Weight (${unit})`,
    dumbbell_pair: `Per Arm (${unit})`,
    dumbbell_each: `Each (${unit})`,
    cable_stack: `Stack (${unit})`,
    machine_stack: `Stack (${unit})`,
    machine_plates: `Plates (${unit})`,
    kettlebell: `KB (${unit})`,
    band: 'Band Level',
    bodyweight_added: `Added (${unit})`,
    sled: `On Sled (${unit})`,
    vest: `Vest (${unit})`,
    body_only: '',
    custom: `Weight (${unit})`,
  };

  return labels[weightContext] ?? `Weight (${unit})`;
}

/**
 * Returns a short version of the weight label for compact displays (e.g. set chips).
 */
export function getWeightLabelShort(
  weightContext: WeightContext | undefined,
  unit: 'kg' | 'lbs',
): string {
  if (!weightContext) return unit;

  const labels: Record<WeightContext, string> = {
    barbell: unit,
    dumbbell_single: unit,
    dumbbell_pair: `ea ${unit}`,
    dumbbell_each: `ea ${unit}`,
    cable_stack: unit,
    machine_stack: unit,
    machine_plates: unit,
    kettlebell: unit,
    band: '',
    bodyweight_added: `+${unit}`,
    sled: unit,
    vest: unit,
    body_only: '',
    custom: unit,
  };

  return labels[weightContext] ?? unit;
}
