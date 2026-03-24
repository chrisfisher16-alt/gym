import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { useWorkoutStore } from '../../stores/workout-store';
import { formatTimerDisplay } from '../../lib/workout-utils';
import { warningNotification } from '../../lib/haptics';
import { playTimerComplete } from '../../lib/sounds';
import { REST_TIMER_PRESETS } from '../../types/workout';

/** Height of the collapsed compact bar */
const BAR_HEIGHT = 56;
/** Height of the expanded bar (with presets) */
const EXPANDED_HEIGHT = 120;
/** Auto-dismiss delay after timer completion (ms) */
const AUTO_DISMISS_MS = 3000;

export function RestTimerBar() {
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

  const [expanded, setExpanded] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = hidden (below), 1 = visible
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActive = useRef(false);

  const restExerciseId = activeSession?.restTimerExerciseId;
  const currentExercise = activeSession?.exercises[activeSession.currentExerciseIndex ?? 0];
  const triggerExercise = restExerciseId
    ? activeSession?.exercises.find((e) => e.id === restExerciseId)
    : currentExercise;

  // ── Slide in/out ──────────────────────────────────────────────────
  useEffect(() => {
    if (isRestTimerActive || isCompleted) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setExpanded(false);
    }
  }, [isRestTimerActive, isCompleted, slideAnim]);

  // ── Timer completion ──────────────────────────────────────────────
  useEffect(() => {
    if (restSecondsLeft === 0 && prevActive.current && isRestTimerActive) {
      // Timer just hit zero
      warningNotification();
      playTimerComplete();
      setIsCompleted(true);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 4 },
      ).start();

      // Auto-dismiss after 3s
      autoDismissTimer.current = setTimeout(() => {
        clearRestTimer();
        setIsCompleted(false);
      }, AUTO_DISMISS_MS);
    }
    prevActive.current = isRestTimerActive && restSecondsLeft > 0;
  }, [restSecondsLeft, isRestTimerActive, clearRestTimer, pulseAnim]);

  // Cleanup auto-dismiss on unmount or manual dismiss
  useEffect(() => {
    return () => {
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, []);

  // ── Dismiss handler ───────────────────────────────────────────────
  const handleDismiss = () => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    clearRestTimer();
    setIsCompleted(false);
    setExpanded(false);
  };

  // Nothing to render
  if (!isRestTimerActive && !isCompleted) return null;

  const progress = restTimerDuration > 0 ? restSecondsLeft / restTimerDuration : 0;
  const formatPreset = (s: number) => (s >= 120 ? `${s / 60}m` : `${s}s`);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [EXPANDED_HEIGHT + 40, 0], // slide from below
  });

  const barHeight = expanded ? EXPANDED_HEIGHT : BAR_HEIGHT;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity: slideAnim,
          height: barHeight,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {/* ── Compact bar (always visible) ─────────────────────────── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (isCompleted) {
            handleDismiss();
          } else {
            setExpanded((prev) => !prev);
          }
        }}
        style={styles.compactRow}
      >
        {/* Progress bar (absolute, bottom of the compact row) */}
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.max(progress * 100, 0)}%`,
                opacity: isCompleted ? pulseAnim : 1,
              },
            ]}
          />
        </View>

        {/* Timer icon + countdown */}
        <View style={styles.timerSection}>
          <Ionicons
            name="timer-outline"
            size={20}
            color={isCompleted ? colors.success : colors.primary}
            style={{ marginRight: spacing.xs }}
          />
          <Animated.Text
            style={[
              typography.label,
              {
                color: isCompleted ? colors.success : colors.text,
                fontVariant: ['tabular-nums'],
                fontSize: 18,
                opacity: isCompleted ? pulseAnim : 1,
              },
            ]}
          >
            {isCompleted ? 'Done!' : formatTimerDisplay(restSecondsLeft)}
          </Animated.Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          {!isCompleted && (
            <TouchableOpacity
              onPress={() => extendRestTimer(30)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.actionBtn,
                {
                  borderColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  marginRight: spacing.sm,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                +30s
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* ── Expanded section (presets + disable) ─────────────────── */}
      {expanded && !isCompleted && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          <View style={styles.presetRow}>
            {REST_TIMER_PRESETS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                onPress={() => startRestTimer(seconds)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                    borderWidth: restTimerDuration === seconds ? 1.5 : 0,
                    borderColor:
                      restTimerDuration === seconds
                        ? colors.borderBrand
                        : 'transparent',
                  },
                ]}
              >
                <Text style={[typography.caption, { color: colors.text }]}>
                  {formatPreset(seconds)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {triggerExercise && (
            <TouchableOpacity
              onPress={() => {
                updateExerciseRestTimerMode(triggerExercise.id, 'off');
                handleDismiss();
              }}
              style={{ alignSelf: 'center' }}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textTertiary,
                    textDecorationLine: 'underline',
                  },
                ]}
              >
                Disable for {triggerExercise.exerciseName}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  compactRow: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  timerSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
