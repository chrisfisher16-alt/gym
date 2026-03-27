import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { ProgressRing } from '../ui';
import { formatTimerDisplay } from '../../lib/workout-utils';
import { mediumImpact, warningNotification } from '../../lib/haptics';
import { playTimerComplete } from '../../lib/sounds';
import type { WeightContext } from '../../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseTimerProps {
  /** Target duration in seconds (from exercise defaults) */
  targetDuration: number;
  /** Called when user taps "LOG SET" with the actual elapsed seconds */
  onComplete: (actualDuration: number) => void;
  /** If 'bodyweight_added' or similar, show optional weight input */
  weightContext?: WeightContext;
  /** Ring diameter in px (default 180) */
  size?: number;
}

type TimerState = 'idle' | 'running' | 'paused' | 'completed';

// ── Component ────────────────────────────────────────────────────────

export function ExerciseTimer({
  targetDuration,
  onComplete,
  size = 180,
}: ExerciseTimerProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // ── State ────────────────────────────────────────────────────────
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompletedRef = useRef(false);

  // ── Reanimated shared values ─────────────────────────────────────
  const ringScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(0);

  // ── Derived values ───────────────────────────────────────────────
  const remaining = Math.max(0, targetDuration - elapsed);
  const overtime = elapsed > targetDuration ? elapsed - targetDuration : 0;
  const isOvertime = elapsed >= targetDuration && timerState !== 'idle';
  const progress = targetDuration > 0
    ? Math.min(1, elapsed / targetDuration)
    : 0;

  // ── Interval management ──────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  // ── Completion detection ─────────────────────────────────────────
  useEffect(() => {
    if (elapsed >= targetDuration && timerState === 'running' && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      setTimerState('completed');
      warningNotification();
      playTimerComplete();

      // Pulse ring + show badge
      ringScale.value = withSequence(
        withTiming(1.08, { duration: 150 }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
      badgeOpacity.value = withTiming(1, { duration: 200 });

      // Timer keeps running (count-up mode) — don't clear interval
    }
  }, [elapsed, targetDuration, timerState, ringScale, badgeOpacity]);

  // ── Actions ──────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    mediumImpact();
    setTimerState('running');
    hasCompletedRef.current = false;
    startInterval();

    // Scale pulse on start
    ringScale.value = withSequence(
      withTiming(1.06, { duration: 120 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  }, [startInterval, ringScale]);

  const handlePause = useCallback(() => {
    mediumImpact();
    setTimerState('paused');
    clearTimer();
  }, [clearTimer]);

  const handleResume = useCallback(() => {
    mediumImpact();
    setTimerState(isOvertime ? 'completed' : 'running');
    startInterval();
  }, [isOvertime, startInterval]);

  const handleReset = useCallback(() => {
    mediumImpact();
    clearTimer();
    setElapsed(0);
    setTimerState('idle');
    hasCompletedRef.current = false;
    badgeOpacity.value = withTiming(0, { duration: 150 });
    ringScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [clearTimer, badgeOpacity, ringScale]);

  const handleLogSet = useCallback(() => {
    mediumImpact();
    clearTimer();
    onComplete(elapsed);
    // Reset after logging
    setElapsed(0);
    setTimerState('idle');
    hasCompletedRef.current = false;
    badgeOpacity.value = withTiming(0, { duration: 150 });
  }, [clearTimer, onComplete, elapsed, badgeOpacity]);

  // ── Animated styles ──────────────────────────────────────────────
  const ringContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
  }));

  // ── Ring color ───────────────────────────────────────────────────
  const ringColor = isOvertime ? colors.success : colors.primary;

  // ── Display text ─────────────────────────────────────────────────
  const displayTime = timerState === 'idle'
    ? formatTimerDisplay(targetDuration)
    : isOvertime
      ? formatTimerDisplay(overtime)
      : formatTimerDisplay(remaining);

  const displaySubtext = timerState === 'idle'
    ? 'TAP START'
    : isOvertime
      ? null
      : `/ ${formatTimerDisplay(targetDuration)}`;

  // ── Render ───────────────────────────────────────────────────────
  const isActive = timerState === 'running' || timerState === 'completed';
  const isPaused = timerState === 'paused';

  return (
    <View style={styles.container}>
      {/* Ring area */}
      <Animated.View style={[styles.ringWrapper, ringContainerStyle]}>
        <ProgressRing
          progress={progress}
          size={size}
          strokeWidth={8}
          color={ringColor}
          gradientColors={isOvertime ? [colors.success, colors.successVibrant] : [colors.primary, colors.primaryLight]}
          trackColor={colors.surfaceSecondary}
        >
          <View style={styles.ringContent}>
            {isOvertime && (
              <Text style={[typography.labelSmall, { color: colors.success }]}>+</Text>
            )}
            <Text
              style={[
                typography.displayFocus,
                {
                  color: isOvertime ? colors.success : colors.text,
                  fontSize: size > 160 ? typography.displayFocus.fontSize : 32,
                  lineHeight: size > 160 ? typography.displayFocus.lineHeight : 38,
                },
              ]}
            >
              {displayTime}
            </Text>
            {displaySubtext && (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {displaySubtext}
              </Text>
            )}
          </View>
        </ProgressRing>

        {/* Overtime badge */}
        <Animated.View style={[styles.badge, badgeAnimatedStyle]}>
          <View
            style={[
              styles.badgePill,
              { backgroundColor: colors.successLight, borderRadius: radius.full },
            ]}
          >
            <Text style={[typography.labelSmall, { color: colors.success }]}>
              +{overtime}s
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Control buttons */}
      <View style={[styles.controls, { marginTop: spacing.lg, gap: spacing.sm }]}>
        {timerState === 'idle' ? (
          /* START */
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.7}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
                paddingHorizontal: spacing['2xl'],
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Text style={[typography.label, { color: colors.textOnPrimary }]}>START ▶</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* RESET */}
            <TouchableOpacity
              onPress={handleReset}
              activeOpacity={0.7}
              style={[
                styles.secondaryButton,
                {
                  borderColor: colors.border,
                  borderWidth: 1.5,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Text style={[typography.label, { color: colors.textSecondary }]}>RESET</Text>
            </TouchableOpacity>

            {/* PAUSE / RESUME */}
            {(isActive || isPaused) && !isOvertime && (
              <TouchableOpacity
                onPress={isActive ? handlePause : handleResume}
                activeOpacity={0.7}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing['2xl'],
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.textOnPrimary }]}>
                  {isActive ? 'PAUSE ⏸' : 'RESUME ▶'}
                </Text>
              </TouchableOpacity>
            )}

            {/* PAUSE / RESUME in overtime (still allow pausing the count-up) */}
            {isOvertime && (
              <TouchableOpacity
                onPress={isPaused ? handleResume : handlePause}
                activeOpacity={0.7}
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: colors.border,
                    borderWidth: 1.5,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.xl,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.textSecondary }]}>
                  {isPaused ? 'RESUME ▶' : 'PAUSE ⏸'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* LOG SET button — only visible once timer has been started */}
      {timerState !== 'idle' && (
        <TouchableOpacity
          onPress={handleLogSet}
          activeOpacity={0.7}
          style={[
            styles.logButton,
            {
              backgroundColor: isOvertime ? colors.success : colors.surfaceSecondary,
              borderRadius: radius.full,
              marginTop: spacing.md,
              paddingHorizontal: spacing['2xl'],
              paddingVertical: 14,
            },
          ]}
        >
          <Text
            style={[
              typography.label,
              { color: isOvertime ? '#FFFFFF' : colors.text },
            ]}
          >
            LOG SET — {formatTimerDisplay(elapsed)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -14,
    alignSelf: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
