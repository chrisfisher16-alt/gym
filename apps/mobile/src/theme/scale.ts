import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design baseline: iPhone 14 (390 logical points)
const DESIGN_WIDTH = 390;

/**
 * Scale a pixel value relative to screen width.
 * On an iPhone 14 (390pt), returns the original value.
 * On smaller phones (375pt SE), returns slightly smaller.
 * On larger phones (428pt Pro Max), returns slightly larger.
 */
export function scale(size: number): number {
  const ratio = SCREEN_WIDTH / DESIGN_WIDTH;
  // Clamp scaling to prevent extreme sizes (0.85x to 1.15x)
  const clampedRatio = Math.min(1.15, Math.max(0.85, ratio));
  return PixelRatio.roundToNearestPixel(size * clampedRatio);
}

/**
 * Moderate scale — for font sizes where you want less dramatic scaling.
 * Uses a 0.5 factor so fonts don't get too large on big screens.
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  const ratio = SCREEN_WIDTH / DESIGN_WIDTH;
  return PixelRatio.roundToNearestPixel(size + (size * (ratio - 1) * factor));
}
