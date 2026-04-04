import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import type { WorkoutPhase } from '../../hooks/useWorkoutPhase';
import { useTheme } from '../../theme';

export interface AmbientStatusBarProps {
  phase: WorkoutPhase;
}

export function AmbientStatusBar({ phase }: AmbientStatusBarProps) {
  const { colors } = useTheme();

  const phaseColors: Record<Exclude<WorkoutPhase, 'idle'>, string> = {
    active_set: colors.gold,
    resting: colors.info,
    pr_achieved: colors.gold,
    workout_complete: colors.completed,
  };
  const insets = useSafeAreaInsets();
  const barHeight = insets.top + 4;

  const opacity = useSharedValue(0);
  const sweepProgress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(sweepProgress);
    sweepProgress.value = 0;

    switch (phase) {
      case 'idle':
        opacity.value = withTiming(0, { duration: 300 });
        break;

      case 'active_set':
        opacity.value = withTiming(0.3, { duration: 300 });
        break;

      case 'resting':
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.15, {
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0.25, {
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          true,
        );
        break;

      case 'pr_achieved':
        opacity.value = withSequence(
          withTiming(0.5, {
            duration: 300,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: 700,
            easing: Easing.in(Easing.quad),
          }),
        );
        break;

      case 'workout_complete':
        // Sweep from left to right, then fade out
        sweepProgress.value = withTiming(1, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        });
        opacity.value = withSequence(
          withTiming(0.3, {
            duration: 800,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0.3, { duration: 1200 }),
          withTiming(0, {
            duration: 1000,
            easing: Easing.in(Easing.quad),
          }),
        );
        break;
    }
  }, [phase, opacity, sweepProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    // Sweep moves the gradient from off-screen left to full position
    transform: [
      { translateX: (sweepProgress.value - 1) * 100 },
    ],
  }));

  // Gradient colors: phase color at top → transparent at bottom
  const gradientColors = useMemo(() => {
    if (phase === 'idle') return ['transparent', 'transparent'] as const;
    const color = phaseColors[phase];
    return [color, 'transparent'] as const;
  }, [phase]);

  if (phase === 'idle') return null;

  const useSweep = phase === 'workout_complete';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { height: barHeight }, animatedStyle]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          useSweep ? sweepStyle : undefined,
        ]}
      >
        <LinearGradient
          colors={gradientColors as unknown as [string, string]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
    ...Platform.select({
      web: { pointerEvents: 'none' as const },
    }),
  },
});
