import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
  /** Custom content rendered in the center of the ring */
  children?: React.ReactNode;
  /** Gradient colors for the progress arc (accepted but not yet implemented) */
  gradientColors?: string[];
}

export function ProgressRing({
  progress: rawProgress,
  size = 64,
  strokeWidth = 5,
  color,
  label,
  sublabel,
  trackColor: trackColorProp,
  children,
  gradientColors: _gradientColors,
}: ProgressRingProps) {
  const { colors, typography } = useTheme();
  const progress = Math.max(0, Math.min(rawProgress, 1));
  const trackColor = trackColorProp ?? colors.borderLight;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        {progress > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>
      {/* Center content */}
      <View style={[styles.center, StyleSheet.absoluteFill]}>
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
        {children}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
