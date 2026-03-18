import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface ProgressRingProps {
  /** 0–1 progress value */
  progress: number;
  /** Outer diameter in px (default 64) */
  size?: number;
  /** Ring thickness in px (default 5) */
  strokeWidth?: number;
  /** Fill color of the progress arc */
  color: string;
  /** Large center text, e.g. "72%" */
  label?: string;
  /** Smaller sub-label below the main label */
  sublabel?: string;
  /** Optional override for the track (background ring) color */
  trackColor?: string;
}

/**
 * Circular progress ring built with pure RN views (no SVG dependency).
 *
 * Technique: four quarter-circle segments clipped by two half-view masks.
 * The progress value (0–1) is converted to degrees (0–360) and each
 * quarter-segment is revealed with a rotate transform.
 */
export function ProgressRing({
  progress: rawProgress,
  size = 64,
  strokeWidth = 5,
  color,
  label,
  sublabel,
  trackColor: trackColorProp,
}: ProgressRingProps) {
  const { colors, typography } = useTheme();
  const progress = Math.max(0, Math.min(rawProgress, 1));
  const degrees = progress * 360;
  const half = size / 2;
  const trackColor = trackColorProp ?? colors.borderLight;

  // Each half renders a semicircle that can rotate 0-180°.
  const renderHalf = (startDeg: number, isRight: boolean) => {
    const rotation = Math.min(Math.max(degrees - startDeg, 0), 180);
    return (
      <View
        style={[
          styles.halfMask,
          {
            width: half,
            height: size,
            left: isRight ? half : 0,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: half,
              left: isRight ? -half : 0,
              transform: [
                { translateX: isRight ? -half : half },
                { rotate: `${isRight ? rotation : rotation}deg` },
                { translateX: isRight ? half : -half },
              ],
            },
            isRight
              ? { borderLeftColor: 'transparent', borderBottomColor: 'transparent' }
              : { borderRightColor: 'transparent', borderTopColor: 'transparent' },
          ]}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background track ring */}
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Progress arcs — right half (0-180°), then left half (180-360°) */}
      {renderHalf(0, true)}
      {renderHalf(180, false)}

      {/* Center content */}
      <View
        style={[
          styles.center,
          {
            width: size - strokeWidth * 2 - 4,
            height: size - strokeWidth * 2 - 4,
            borderRadius: (size - strokeWidth * 2 - 4) / 2,
          },
        ]}
      >
        {label != null && (
          <Text
            style={[
              typography.labelSmall,
              { color: colors.text, fontSize: size > 56 ? 13 : 10, lineHeight: size > 56 ? 16 : 12 },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {sublabel != null && (
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, fontSize: size > 56 ? 9 : 7, lineHeight: size > 56 ? 11 : 9 },
            ]}
            numberOfLines={1}
          >
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
  },
  halfMask: {
    position: 'absolute',
    top: 0,
  },
  halfCircle: {
    position: 'absolute',
    top: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
