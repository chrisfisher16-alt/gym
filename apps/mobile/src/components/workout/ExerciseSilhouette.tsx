import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { MuscleGroup } from '../../types/workout';
import type { SilhouetteType } from '../../lib/exercise-silhouettes';
import { useTheme } from '../../theme';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseSilhouetteProps {
  movementType: SilhouetteType;
  category?: MuscleGroup;
  width: number;
  height: number;
  variant?: 'default' | 'gold';
  style?: StyleProp<ViewStyle>;
}

// ── SVG path data for each movement silhouette ───────────────────────
// Designed in a 100×100 viewBox. Simplified human figures.

const SILHOUETTE_PATHS: Record<SilhouetteType, string> = {
  // Bench press / push-up — person lying back, arms pressing up
  push:
    // Head
    'M50 18 a6 6 0 1 0 0.01 0 Z ' +
    // Torso lying on bench (angled back)
    'M44 28 L26 62 L30 66 L48 34 L52 34 L70 66 L74 62 L56 28 Z ' +
    // Left arm pressing upward
    'M30 38 L18 22 L22 18 L34 34 Z ' +
    // Right arm pressing upward
    'M70 38 L82 22 L78 18 L66 34 Z ' +
    // Left leg (bent at bench)
    'M32 66 L28 84 L34 86 L38 68 Z ' +
    // Right leg
    'M68 66 L72 84 L66 86 L62 68 Z',

  // Pull-up / row — person pulling, arms toward body
  pull:
    // Head
    'M50 14 a6 6 0 1 0 0.01 0 Z ' +
    // Torso upright, slightly arched
    'M44 24 L42 58 L46 60 L50 28 L54 60 L58 58 L56 24 Z ' +
    // Left arm — pulling down from above
    'M42 30 L24 16 L20 20 L38 36 Z ' +
    // Right arm — pulling down from above
    'M58 30 L76 16 L80 20 L62 36 Z ' +
    // Left leg hanging
    'M43 60 L40 86 L46 88 L48 62 Z ' +
    // Right leg hanging
    'M57 60 L60 86 L54 88 L52 62 Z',

  // Squat — person in deep squat, knees bent
  squat:
    // Head
    'M50 12 a6 6 0 1 0 0.01 0 Z ' +
    // Torso upright
    'M44 22 L43 48 L48 50 L50 26 L52 50 L57 48 L56 22 Z ' +
    // Left arm at sides / front rack
    'M43 28 L32 44 L36 46 L44 34 Z ' +
    // Right arm
    'M57 28 L68 44 L64 46 L56 34 Z ' +
    // Left thigh (bent)
    'M43 50 L28 62 L32 66 L46 54 Z ' +
    // Left shin
    'M28 62 L30 86 L36 86 L34 66 Z ' +
    // Right thigh (bent)
    'M57 50 L72 62 L68 66 L54 54 Z ' +
    // Right shin
    'M72 62 L70 86 L64 86 L66 66 Z',

  // Deadlift / RDL — hip hinge, bent forward
  hinge:
    // Head (forward and down)
    'M34 22 a6 6 0 1 0 0.01 0 Z ' +
    // Torso bent forward ~45 degrees
    'M38 28 L52 58 L56 56 L44 26 L40 26 Z ' +
    // Left arm hanging down
    'M40 32 L32 52 L36 54 L42 36 Z ' +
    // Right arm hanging down
    'M42 32 L34 52 L38 54 L44 36 Z ' +
    // Left leg — mostly straight
    'M52 58 L44 88 L50 88 L56 60 Z ' +
    // Right leg — slightly behind
    'M56 56 L64 86 L58 88 L54 58 Z',

  // Carry — person standing upright holding weights at sides
  carry:
    // Head
    'M50 10 a6 6 0 1 0 0.01 0 Z ' +
    // Torso standing tall
    'M44 20 L43 54 L48 56 L50 24 L52 56 L57 54 L56 20 Z ' +
    // Left arm down at side, holding weight
    'M43 24 L38 54 L34 54 L34 58 L42 58 L44 30 Z ' +
    // Right arm down at side, holding weight
    'M57 24 L62 54 L66 54 L66 58 L58 58 L56 30 Z ' +
    // Left leg
    'M44 56 L42 88 L48 88 L49 58 Z ' +
    // Right leg
    'M56 56 L58 88 L52 88 L51 58 Z',

  // Rotation / twist — person in rotational stance
  rotation:
    // Head
    'M50 12 a6 6 0 1 0 0.01 0 Z ' +
    // Torso with twist
    'M46 22 L40 54 L46 56 L50 26 L54 56 L60 54 L54 22 Z ' +
    // Left arm extended across body
    'M46 28 L24 38 L26 42 L46 34 Z ' +
    // Right arm pulled back
    'M54 28 L72 22 L70 26 L54 34 Z ' +
    // Left leg (athletic stance)
    'M42 56 L38 86 L44 88 L47 58 Z ' +
    // Right leg
    'M58 56 L62 86 L56 88 L53 58 Z',

  // Isometric / plank / hold — person in plank position
  isometric:
    // Head (looking down, left side)
    'M18 36 a5 5 0 1 0 0.01 0 Z ' +
    // Torso horizontal (plank)
    'M24 38 L70 44 L70 50 L24 44 Z ' +
    // Left arm (support)
    'M24 40 L20 58 L26 60 L28 44 Z ' +
    // Right arm implied in body line
    // Left leg extended back
    'M70 44 L88 56 L86 62 L68 50 Z ' +
    // Right leg extended back
    'M68 48 L86 62 L84 66 L66 52 Z',

  // Cardio / running — person in mid-stride
  cardio:
    // Head
    'M48 10 a6 6 0 1 0 0.01 0 Z ' +
    // Torso — slight forward lean
    'M44 20 L40 52 L46 54 L50 24 L54 54 L60 52 L56 20 Z ' +
    // Left arm forward
    'M44 26 L28 38 L32 42 L46 32 Z ' +
    // Right arm back
    'M56 26 L72 40 L68 44 L54 32 Z ' +
    // Left leg forward (stride)
    'M42 54 L26 80 L32 84 L46 58 Z ' +
    // Left foot
    'M26 80 L20 84 L24 88 L32 84 Z ' +
    // Right leg back (stride)
    'M58 54 L74 78 L68 82 L54 58 Z ' +
    // Right foot
    'M74 78 L80 82 L76 86 L68 82 Z',
};

// ── Component ────────────────────────────────────────────────────────

export function ExerciseSilhouette({
  movementType,
  width,
  height,
  variant = 'default',
  style,
}: ExerciseSilhouetteProps) {
  const { dark, colors } = useTheme();

  const gradientColors = useMemo(() => {
    if (variant === 'gold') {
      return {
        top: colors.primaryLight,
        bottom: colors.primaryDark,
      };
    }
    // Default / neutral
    return {
      top: colors.surfaceTertiary,
      bottom: colors.surfaceSecondary,
    };
  }, [variant, dark]);

  const pathData = SILHOUETTE_PATHS[movementType] ?? SILHOUETTE_PATHS.push;
  const gradientId = `silhouette-grad-${movementType}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      style={style as any}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gradientColors.top} stopOpacity="1" />
          <Stop offset="1" stopColor={gradientColors.bottom} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <G>
        <Path
          d={pathData}
          fill={`url(#${gradientId})`}
          fillRule="evenodd"
        />
      </G>
    </Svg>
  );
}
