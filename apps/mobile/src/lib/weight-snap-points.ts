// ── Weight Snap Points ──────────────────────────────────────────
// Common barbell plate milestones for magnetic snap feedback.
// When stepping through weights, crossing these values triggers
// a stronger haptic + brief visual enlargement.

export interface SnapPoint {
  weight: number;
  label: string;
  unit: 'lb' | 'kg';
}

const LB_SNAP_POINTS: SnapPoint[] = [
  { weight: 135, label: '1 plate', unit: 'lb' },
  { weight: 185, label: '1.5 plates', unit: 'lb' },
  { weight: 225, label: '2 plates', unit: 'lb' },
  { weight: 275, label: '2.5 plates', unit: 'lb' },
  { weight: 315, label: '3 plates', unit: 'lb' },
  { weight: 365, label: '3.5 plates', unit: 'lb' },
  { weight: 405, label: '4 plates', unit: 'lb' },
];

const KG_SNAP_POINTS: SnapPoint[] = [
  { weight: 60, label: '1 plate', unit: 'kg' },
  { weight: 80, label: '1.5 plates', unit: 'kg' },
  { weight: 100, label: '2 plates', unit: 'kg' },
  { weight: 120, label: '2.5 plates', unit: 'kg' },
  { weight: 140, label: '3 plates', unit: 'kg' },
];

function getSnapPoints(unit: 'lb' | 'kg'): SnapPoint[] {
  return unit === 'lb' ? LB_SNAP_POINTS : KG_SNAP_POINTS;
}

/** Returns the snap point if `weight` exactly matches one, or null. */
export function isSnapPoint(weight: number, unit: 'lb' | 'kg'): SnapPoint | null {
  return getSnapPoints(unit).find((sp) => sp.weight === weight) ?? null;
}

/** Returns the next snap point in the given direction, or null if none. */
export function getNextSnapPoint(
  weight: number,
  direction: 'up' | 'down',
  unit: 'lb' | 'kg',
): SnapPoint | null {
  const points = getSnapPoints(unit);
  if (direction === 'up') {
    return points.find((sp) => sp.weight > weight) ?? null;
  }
  // direction === 'down' — find the highest snap point below current weight
  for (let i = points.length - 1; i >= 0; i--) {
    const sp = points[i];
    if (sp && sp.weight < weight) return sp;
  }
  return null;
}

/**
 * Checks if a weight transition crossed a snap point.
 * Returns the crossed snap point, or null if none was crossed.
 */
export function getCrossedSnapPoint(
  oldWeight: number,
  newWeight: number,
  unit: 'lb' | 'kg',
): SnapPoint | null {
  if (oldWeight === newWeight) return null;

  const points = getSnapPoints(unit);
  const lo = Math.min(oldWeight, newWeight);
  const hi = Math.max(oldWeight, newWeight);

  // Find a snap point that sits between the old and new values (inclusive of new).
  // When incrementing up past 225: old=220, new=225 → 220 < 225 <= 225 ✓
  // When decrementing down past 225: old=230, new=225 → 225 <= 225 < 230 ✓
  // Landing exactly on the snap point counts as crossing it.
  for (const sp of points) {
    if (sp.weight > lo && sp.weight <= hi) {
      return sp;
    }
  }
  return null;
}
