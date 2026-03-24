import React, { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { CompletedSession } from '../../types/workout';
import { generateFingerprint } from '../../lib/workout-fingerprint';
import type { FingerprintSegment } from '../../lib/workout-fingerprint';

interface WorkoutFingerprintProps {
  session: CompletedSession;
  size?: number;
  style?: ViewStyle | undefined;
}

// ── SVG Arc Helpers ───────────────────────────────────────────────────

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = degreesToRadians(angleDeg - 90); // -90 so 0° is top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  // Clamp sweep to prevent full-circle edge case with arc flags
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);

  // Draw: outer arc clockwise, line to inner end, inner arc counter-clockwise, close
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

// ── Segment Path Builder ──────────────────────────────────────────────

function buildSegmentPath(
  segment: FingerprintSegment,
  cx: number,
  cy: number,
  maxRadius: number,
  minInnerRadius: number,
): string {
  const gap = 1.5; // degrees gap between segments for visual separation
  const startAngle = segment.angle + gap / 2;
  const endAngle = segment.angle + segment.sweep - gap / 2;

  if (endAngle <= startAngle) return '';

  // Outer radius scales with intensity (radius field)
  const outerR = minInnerRadius + (maxRadius - minInnerRadius) * segment.radius;
  // Inner radius: fixed small ring, thickness controls how thick the band is
  const bandMax = outerR - minInnerRadius;
  const bandWidth = Math.max(bandMax * 0.3, bandMax * segment.thickness);
  const innerR = Math.max(minInnerRadius, outerR - bandWidth);

  return describeArc(cx, cy, innerR, outerR, startAngle, endAngle);
}

// ── Component ─────────────────────────────────────────────────────────

export function WorkoutFingerprint({ session, size = 40, style }: WorkoutFingerprintProps) {
  const fingerprint = useMemo(() => generateFingerprint(session), [session]);

  const cx = size / 2;
  const cy = size / 2;
  const padding = size * 0.05;
  const maxRadius = cx - padding;
  const minInnerRadius = size * 0.18;
  const centerDotRadius = size * 0.1;
  const bgRingRadius = maxRadius;
  const bgRingStroke = size * 0.02;

  // For single-exercise workouts, render a full ring instead of a tiny arc
  const isSingleExercise = fingerprint.segments.length === 1;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style as any}>
      {/* Background ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={bgRingRadius}
        fill="none"
        stroke="#3A3A3C"
        strokeWidth={bgRingStroke}
        opacity={0.3}
      />

      {/* Exercise segments */}
      {isSingleExercise ? (
        // Single exercise → draw a full donut
        <>
          <Circle
            cx={cx}
            cy={cy}
            r={minInnerRadius + (maxRadius - minInnerRadius) * fingerprint.segments[0].radius * 0.7}
            fill="none"
            stroke={fingerprint.segments[0].color}
            strokeWidth={
              (maxRadius - minInnerRadius) * fingerprint.segments[0].thickness * 0.6
            }
            opacity={0.7}
          />
        </>
      ) : (
        fingerprint.segments.map((segment, i) => {
          const d = buildSegmentPath(segment, cx, cy, maxRadius, minInnerRadius);
          if (!d) return null;
          return (
            <Path
              key={i}
              d={d}
              fill={segment.color}
              opacity={0.7}
              stroke={segment.color}
              strokeWidth={size * 0.01}
              strokeOpacity={0.9}
            />
          );
        })
      )}

      {/* Center dot */}
      <Circle cx={cx} cy={cy} r={centerDotRadius} fill={fingerprint.centerColor} opacity={0.9} />
    </Svg>
  );
}
