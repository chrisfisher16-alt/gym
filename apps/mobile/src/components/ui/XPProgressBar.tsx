import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

// ── Types ──────────────────────────────────────────────────────────

export interface XPProgressBarProps {
  currentXP: number;
  level: number;
  xpToNextLevel: number;
  style?: ViewStyle;
}

// ── Component ──────────────────────────────────────────────────────

export function XPProgressBar({
  currentXP,
  level,
  xpToNextLevel,
  style,
}: XPProgressBarProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const xpInLevel = 1000 - xpToNextLevel;
  const progress = Math.min(Math.max(xpInLevel / 1000, 0), 1);

  const barWidth = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const prevXP = useRef(currentXP);

  useEffect(() => {
    barWidth.value = withTiming(progress, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });

    // Glow pulse when XP changes (skip initial mount)
    if (prevXP.current !== currentXP && prevXP.current !== 0) {
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
    }
    prevXP.current = currentXP;
  }, [progress, currentXP]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={[styles.container, style]}>
      {/* Level badge */}
      <View style={[styles.levelBadge, { backgroundColor: colors.gold }]}>
        <Text style={[typography.labelSmall, styles.levelText, { color: colors.textOnPrimary }]}>
          Lv. {level}
        </Text>
      </View>

      {/* Progress track */}
      <View style={[styles.track, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}>
        {/* Gold fill */}
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: colors.gold, borderRadius: radius.sm },
            fillStyle,
          ]}
        />

        {/* Glow overlay */}
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: colors.gold, borderRadius: radius.sm },
            glowStyle,
          ]}
        />
      </View>

      {/* XP text */}
      <Text style={[typography.labelSmall, styles.xpText, { color: colors.textSecondary }]}>
        {xpInLevel} / 1000 XP
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 44,
    alignItems: 'center',
  },
  levelText: {
    fontWeight: '700',
  },
  track: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  xpText: {
    minWidth: 80,
    textAlign: 'right',
  },
});
