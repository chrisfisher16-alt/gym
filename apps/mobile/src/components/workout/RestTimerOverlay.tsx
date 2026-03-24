import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../../theme';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { useWorkoutStore } from '../../stores/workout-store';
import { ProgressRing } from '../ui';
import { formatTimerDisplay } from '../../lib/workout-utils';
import { mediumImpact, warningNotification } from '../../lib/haptics';
import { playTimerComplete } from '../../lib/sounds';
import { REST_TIMER_PRESETS } from '../../types/workout';

const PULL_THRESHOLD = 40;
const MAX_DRAG_FOLLOW = 20;
const EXTEND_SECONDS = 30;
const BADGE_FADE_MS = 800;

export function RestTimerOverlay() {
  const { colors, spacing, radius, typography } = useTheme();
  const {
    isRestTimerActive,
    restSecondsLeft,
    restTimerDuration,
    clearRestTimer,
    startRestTimer,
    extendRestTimer,
    activeSession,
  } = useActiveWorkout();
  const updateExerciseRestTimerMode = useWorkoutStore((s) => s.updateExerciseRestTimerMode);
  const currentExercise = activeSession?.exercises[activeSession.currentExerciseIndex ?? 0];
  const restExerciseId = activeSession?.restTimerExerciseId;
  const triggerExercise = restExerciseId
    ? activeSession?.exercises.find(e => e.id === restExerciseId)
    : currentExercise;

  // ── Reanimated shared values ──────────────────────────────────────
  const dragY = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(0);
  const hintOpacity = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  useEffect(() => {
    if (restSecondsLeft === 0 && isRestTimerActive) {
      warningNotification();
      playTimerComplete();
    }
  }, [restSecondsLeft, isRestTimerActive]);

  // ── Callbacks for runOnJS (must be before early return) ────────
  const onExtend = useCallback(() => {
    mediumImpact();
    extendRestTimer(EXTEND_SECONDS);
  }, [extendRestTimer]);

  // ── Gesture (must be before early return) ──────────────────────
  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY(10)
    .onStart(() => {
      hasTriggered.value = false;
    })
    .onUpdate((e) => {
      const ty = e.translationY;
      // Only follow downward drags, clamped to MAX_DRAG_FOLLOW
      dragY.value = ty > 0 ? Math.min(ty * 0.5, MAX_DRAG_FOLLOW) : 0;

      // Show hint while dragging down
      hintOpacity.value = ty > 5 && ty < PULL_THRESHOLD ? withTiming(1, { duration: 100 }) : 0;

      // Trigger extend when crossing threshold
      if (ty > PULL_THRESHOLD && !hasTriggered.value) {
        hasTriggered.value = true;
        hintOpacity.value = withTiming(0, { duration: 150 });

        // Pulse the ring
        ringScale.value = withSequence(
          withTiming(1.05, { duration: 120 }),
          withSpring(1, { damping: 12, stiffness: 200 }),
        );

        // Show +30s badge
        badgeOpacity.value = withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(0, { duration: BADGE_FADE_MS - 150 }),
        );

        runOnJS(onExtend)();
      }
    })
    .onEnd(() => {
      dragY.value = withSpring(0, { damping: 15, stiffness: 300 });
      hintOpacity.value = withTiming(0, { duration: 100 });
      hasTriggered.value = false;
    }), [onExtend, hasTriggered, dragY, hintOpacity, ringScale, badgeOpacity]);

  // ── Animated styles (must be before early return) ──────────────
  const ringContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: ringScale.value },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  if (!isRestTimerActive) return null;

  const progress = restTimerDuration > 0 ? restSecondsLeft / restTimerDuration : 0;
  const nextExercise = activeSession?.exercises[(activeSession.currentExerciseIndex ?? 0) + 1];
  const formatPreset = (s: number) => (s >= 120 ? `${s / 60}m` : `${s}s`);

  return (
    <View style={[styles.restOverlay, { backgroundColor: colors.overlayHeavy }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        {/* Overline */}
        <Text style={[typography.overline, { color: colors.textSecondary, marginBottom: spacing.lg }]}>Rest</Text>

        {/* Pull hint — shown during drag before threshold */}
        <Animated.Text
          style={[
            typography.caption,
            {
              color: colors.textTertiary,
              marginBottom: spacing.sm,
              position: 'absolute',
              top: '28%',
            },
            hintStyle,
          ]}
        >
          ↓ Pull to extend
        </Animated.Text>

        {/* GestureDetector wrapping the ring area */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[{ alignItems: 'center' }, ringContainerStyle]}>
            {/* Progress Ring with timer */}
            <ProgressRing
              progress={progress}
              size={220}
              strokeWidth={8}
              color={colors.primary}
              gradientColors={[colors.primary, colors.primaryLight]}
            >
              <Text style={[typography.displayFocus, { color: colors.text }]}>
                {formatTimerDisplay(restSecondsLeft)}
              </Text>
            </ProgressRing>

            {/* +30s badge — floats below ring on extend */}
            <Animated.Text
              style={[
                typography.label,
                {
                  color: colors.primary,
                  fontSize: 18,
                  fontWeight: '700',
                  marginTop: spacing.sm,
                  position: 'absolute',
                  bottom: -32,
                },
                badgeStyle,
              ]}
            >
              +30s
            </Animated.Text>
          </Animated.View>
        </GestureDetector>

        {/* Preset buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          {REST_TIMER_PRESETS.map((seconds) => (
            <TouchableOpacity
              key={seconds}
              onPress={() => startRestTimer(seconds)}
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderWidth: restTimerDuration === seconds ? 1.5 : 0,
                borderColor: restTimerDuration === seconds ? colors.borderBrand : 'transparent',
              }}
            >
              <Text style={[typography.labelSmall, { color: colors.text }]}>
                {formatPreset(seconds)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* +30s extend button (kept as a fallback tap target) */}
        <TouchableOpacity
          onPress={() => extendRestTimer(EXTEND_SECONDS)}
          style={{
            marginTop: spacing.md,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.surfaceSecondary,
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>+30s</Text>
        </TouchableOpacity>

        {/* Up Next */}
        {nextExercise && (
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={[typography.overline, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Up Next</Text>
            <Text style={[typography.label, { color: colors.text }]}>{nextExercise.exerciseName}</Text>
          </View>
        )}

        {/* Skip button */}
        <TouchableOpacity
          onPress={clearRestTimer}
          style={{
            marginTop: spacing.xl,
            paddingVertical: 14,
            paddingHorizontal: 40,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: colors.textSecondary,
          }}
        >
          <Text style={[typography.label, { color: colors.text, textAlign: 'center' }]}>Skip Rest</Text>
        </TouchableOpacity>

        {/* Don't show for this exercise */}
        {triggerExercise && (
          <TouchableOpacity
            onPress={() => {
              updateExerciseRestTimerMode(triggerExercise.id, 'off');
              clearRestTimer();
            }}
            style={{ marginTop: spacing.md }}
          >
            <Text style={[typography.caption, { color: colors.textTertiary, textDecorationLine: 'underline' }]}>
              Don't auto-rest for {triggerExercise.exerciseName}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  restOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
