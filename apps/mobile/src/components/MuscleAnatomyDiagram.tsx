import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import type { MuscleId } from '../types/workout';
import { FRONT_BODY_OUTLINE, FRONT_MUSCLES } from '../data/anatomy-paths-front';
import { BACK_BODY_OUTLINE, BACK_MUSCLES } from '../data/anatomy-paths-back';
import type { MusclePath } from '../data/anatomy-paths-front';

// ── Public Types ────────────────────────────────────────────────────

export type MuscleState = 'fresh' | 'targeted' | 'recovering' | 'inactive';

export interface MuscleHighlight {
  muscleId: MuscleId;
  state: MuscleState;
  opacity?: number;
}

export interface MuscleAnatomyDiagramProps {
  view: 'front' | 'back';
  highlights?: MuscleHighlight[];
  width?: number;
  height?: number;
  interactive?: boolean;
  onMusclePress?: (muscleId: MuscleId) => void;
  showLabels?: boolean;
  style?: StyleProp<ViewStyle>;
  colorMode?: 'brand' | 'recovery';
  variant?: 'full' | 'mini';
  /** Animate a subtle opacity pulse on muscles with state 'recovering'. */
  pulseRecovering?: boolean;
}

// ── Color Helpers ───────────────────────────────────────────────────

function getMuscleColor(
  state: MuscleState,
  colorMode: 'brand' | 'recovery',
  brandColor: string,
  successColor: string,
  warningColor: string,
): string {
  if (colorMode === 'brand') {
    switch (state) {
      case 'fresh':
        return brandColor;
      case 'targeted':
        return brandColor;
      case 'recovering':
        return warningColor;
      case 'inactive':
      default:
        return 'transparent';
    }
  }
  // recovery mode
  switch (state) {
    case 'fresh':
      return successColor;
    case 'targeted':
      return brandColor;
    case 'recovering':
      return warningColor;
    case 'inactive':
    default:
      return 'transparent';
  }
}

function getMuscleOpacity(state: MuscleState, customOpacity?: number): number {
  if (customOpacity !== undefined) return customOpacity;
  switch (state) {
    case 'fresh':
      return 1.0;
    case 'targeted':
      return 1.0;
    case 'recovering':
      return 0.4;
    case 'inactive':
      return 0.2;
    default:
      return 0.2;
  }
}

// ── Main Component ──────────────────────────────────────────────────

// ── Pulse Hook ──────────────────────────────────────────────────────

const PULSE_MIN = 0.25;
const PULSE_MAX = 0.55;
const PULSE_DURATION = 2000; // 2 seconds full cycle

function usePulseOpacity(enabled: boolean): number {
  const [opacity, setOpacity] = useState(PULSE_MIN);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setOpacity(PULSE_MIN);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) % PULSE_DURATION;
      const t = elapsed / PULSE_DURATION;
      // Sine wave: 0→1→0 over the cycle
      const sine = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      setOpacity(PULSE_MIN + sine * (PULSE_MAX - PULSE_MIN));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  return opacity;
}

function MuscleAnatomyDiagramInner({
  view,
  highlights = [],
  width,
  height,
  interactive = false,
  onMusclePress,
  showLabels = false,
  style,
  colorMode = 'brand',
  variant = 'full',
  pulseRecovering = false,
}: MuscleAnatomyDiagramProps) {
  const { colors } = useTheme();
  const pulseOpacity = usePulseOpacity(pulseRecovering);

  const isMini = variant === 'mini';
  const svgWidth = width ?? (isMini ? 100 : 200);
  const svgHeight = height ?? (isMini ? 200 : 400);
  const effectiveShowLabels = isMini ? false : showLabels;

  const outlineColor = colors.anatomyOutline;

  const muscles = view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;
  const bodyOutline = view === 'front' ? FRONT_BODY_OUTLINE : BACK_BODY_OUTLINE;

  // Build a quick lookup from the highlights array
  const highlightMap = useMemo(() => {
    const map = new Map<MuscleId, MuscleHighlight>();
    for (const h of highlights) {
      map.set(h.muscleId, h);
    }
    return map;
  }, [highlights]);

  const handlePress = useCallback(
    (muscleId: MuscleId) => {
      if (interactive && onMusclePress) {
        onMusclePress(muscleId);
      }
    },
    [interactive, onMusclePress],
  );

  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      viewBox="0 0 200 400"
      style={[styles.svg, style] as any}
    >
      {/* Layer 1: Body silhouette fill + outline */}
      <Path
        d={bodyOutline}
        fill={colors.anatomyDefault}
        fillOpacity={0.35}
        stroke={outlineColor}
        strokeWidth={1.2}
        strokeOpacity={0.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Layer 2: Muscle fills */}
      {muscles.map((muscle: MusclePath) => {
        const highlight = highlightMap.get(muscle.id as MuscleId);
        const state: MuscleState = highlight?.state ?? 'inactive';

        const isHighlighted = state !== 'inactive';

        const fillColor = isHighlighted
          ? getMuscleColor(state, colorMode, colors.primary, colors.success, colors.warning)
          : colors.anatomyDefault;

        const fillOpacity = isHighlighted
          ? (pulseRecovering && state === 'recovering'
              ? pulseOpacity
              : getMuscleOpacity(state, highlight?.opacity))
          : 0.2;

        return (
          <G key={muscle.id}>
            <Path
              d={muscle.d}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={outlineColor}
              strokeWidth={isHighlighted ? 0.6 : 0.3}
              strokeLinejoin="round"
              strokeOpacity={isHighlighted ? 0.7 : 0.15}
              onPress={
                interactive ? () => handlePress(muscle.id as MuscleId) : undefined
              }
            />
            {effectiveShowLabels && muscle.label && muscle.labelX != null && muscle.labelY != null && (
              <SvgText
                x={muscle.labelX}
                y={muscle.labelY}
                fontSize={6}
                fill={colors.textSecondary}
                textAnchor="middle"
                fontWeight="500"
                opacity={0.7}
              >
                {muscle.label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

export const MuscleAnatomyDiagram = React.memo(MuscleAnatomyDiagramInner);

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  svg: {
    alignSelf: 'center',
  },
});
