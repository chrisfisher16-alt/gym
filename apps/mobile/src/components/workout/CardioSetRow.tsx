import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExerciseTimer } from './ExerciseTimer';
import { selectionFeedback, mediumImpact, successNotification } from '../../lib/haptics';
import { completionFlash } from '../../lib/animations';
import { formatDuration } from '../../lib/workout-utils';
import type { ActiveSet, SecondaryMetricDef } from '../../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface CardioSetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  defaultDuration: number;
  secondaryMetrics?: SecondaryMetricDef[];
  onLogCardio: (setId: string, data: {
    durationSeconds: number;
    distance?: number;
    distanceUnit?: string;
    incline?: number;
    speed?: number;
    speedUnit?: string;
    level?: number;
    calories?: number;
    resistance?: number;
  }) => void;
  onComplete: (setId: string) => void;
}

// ── Component ────────────────────────────────────────────────────────

export const CardioSetRow = React.memo(function CardioSetRow({
  set,
  exerciseInstanceId,
  defaultDuration,
  secondaryMetrics = [],
  onLogCardio,
  onComplete,
}: CardioSetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // ── State ──────────────────────────────────────────────────────────
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [actualDuration, setActualDuration] = useState(0);
  const [metricValues, setMetricValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const m of secondaryMetrics) {
      // Prefer value already on set, fall back to metric default
      const existing = (set as unknown as Record<string, unknown>)[m.type];
      initial[m.type] = typeof existing === 'number' ? existing : m.defaultValue;
    }
    return initial;
  });

  // ── Animations ─────────────────────────────────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (set.isCompleted) {
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      completionFlash(scaleAnim).start();
    }
  }, [set.isCompleted]);

  // ── Timer callback ─────────────────────────────────────────────────
  const handleTimerComplete = useCallback((elapsed: number) => {
    setActualDuration(elapsed);
    setTimerCompleted(true);
  }, []);

  // ── Metric stepper ─────────────────────────────────────────────────
  const handleStep = useCallback((type: string, step: number, min: number, max: number, direction: 'up' | 'down') => {
    selectionFeedback();
    setMetricValues((prev) => {
      const current = prev[type] ?? 0;
      const next = direction === 'up'
        ? Math.min(max, current + step)
        : Math.max(min, current - step);
      return { ...prev, [type]: parseFloat(next.toFixed(4)) };
    });
  }, []);

  const handleMetricChange = useCallback((type: string, text: string, min: number, max: number) => {
    const val = parseFloat(text);
    if (!isNaN(val)) {
      setMetricValues((prev) => ({
        ...prev,
        [type]: Math.max(min, Math.min(max, val)),
      }));
    } else if (text === '' || text === '.') {
      // Allow clearing input temporarily
      setMetricValues((prev) => ({ ...prev, [type]: 0 }));
    }
  }, []);

  // ── Log set ────────────────────────────────────────────────────────
  const handleLogSet = useCallback(() => {
    mediumImpact();
    const data: Parameters<typeof onLogCardio>[1] = {
      durationSeconds: actualDuration,
    };
    for (const m of secondaryMetrics) {
      const val = metricValues[m.type];
      if (val !== undefined && val !== 0) {
        (data as Record<string, unknown>)[m.type] = val;
        // Attach units for distance/speed
        if (m.type === 'distance') data.distanceUnit = m.unit;
        if (m.type === 'speed') data.speedUnit = m.unit;
      }
    }
    onLogCardio(set.id, data);
    onComplete(set.id);
    successNotification();
  }, [actualDuration, metricValues, secondaryMetrics, set.id, onLogCardio, onComplete]);

  // ── Set type label ─────────────────────────────────────────────────
  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';

  // ── Completed state ────────────────────────────────────────────────
  if (set.isCompleted) {
    const summaryParts: string[] = [];
    if (set.durationSeconds) summaryParts.push(formatDuration(set.durationSeconds));
    if (set.distance) summaryParts.push(`${set.distance} ${set.distanceUnit ?? 'mi'}`);
    if (set.incline != null && set.incline > 0) summaryParts.push(`${set.incline}% ↗`);
    if (set.speed != null && set.speed > 0) summaryParts.push(`${set.speed} ${set.speedUnit ?? 'mph'}`);
    if (set.level != null && set.level > 0) summaryParts.push(`Lv ${set.level}`);
    if (set.calories != null && set.calories > 0) summaryParts.push(`${set.calories} kcal`);
    if (set.resistance != null && set.resistance > 0) summaryParts.push(`R${set.resistance}`);

    return (
      <Animated.View
        style={[
          styles.completedRow,
          {
            backgroundColor: colors.completedMuted,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            marginBottom: 2,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Green flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.completed,
              borderRadius: radius.md,
              opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
            },
          ]}
        />
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {setTypeLabel || set.setNumber}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={18} color={colors.completed} style={{ marginRight: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: colors.completed }]} numberOfLines={1}>
            {summaryParts.join(' · ')}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Active state ───────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          marginBottom: 4,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.label, { color: colors.textSecondary, fontWeight: '600' }]}>
            {setTypeLabel || `Set ${set.setNumber}`}
          </Text>
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerSection}>
        <ExerciseTimer
          targetDuration={defaultDuration}
          onComplete={handleTimerComplete}
          size={140}
        />
      </View>

      {/* Secondary Metrics */}
      {secondaryMetrics.length > 0 && (
        <View style={[styles.metricsSection, { marginTop: spacing.sm }]}>
          {secondaryMetrics.map((metric) => (
            <View
              key={metric.type}
              style={[
                styles.metricRow,
                { marginBottom: spacing.xs, paddingVertical: spacing.xs },
              ]}
            >
              {/* Label */}
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary, width: 80 },
                ]}
                numberOfLines={1}
              >
                {metric.label}
              </Text>

              {/* Stepper */}
              <View style={styles.metricStepper}>
                <TouchableOpacity
                  onPress={() => handleStep(metric.type, metric.step, metric.min, metric.max, 'down')}
                  activeOpacity={0.7}
                  style={[
                    styles.stepperBtn,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </TouchableOpacity>

                <TextInput
                  style={[
                    styles.metricInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderRadius: radius.sm,
                      ...typography.bodyLarge,
                      fontWeight: '700',
                    },
                  ]}
                  value={
                    metricValues[metric.type] !== undefined
                      ? String(metricValues[metric.type])
                      : ''
                  }
                  onChangeText={(text) => handleMetricChange(metric.type, text, metric.min, metric.max)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />

                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, width: 32, textAlign: 'center' },
                  ]}
                >
                  {metric.unit}
                </Text>

                <TouchableOpacity
                  onPress={() => handleStep(metric.type, metric.step, metric.min, metric.max, 'up')}
                  activeOpacity={0.7}
                  style={[
                    styles.stepperBtn,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* LOG SET button */}
      <TouchableOpacity
        onPress={handleLogSet}
        disabled={!timerCompleted}
        activeOpacity={0.7}
        style={[
          styles.logButton,
          {
            backgroundColor: timerCompleted ? colors.completed : colors.surfaceSecondary,
            borderRadius: radius.md,
            marginTop: spacing.md,
            paddingVertical: spacing.md,
            opacity: timerCompleted ? 1 : 0.5,
          },
        ]}
      >
        <Text
          style={[
            typography.label,
            { color: timerCompleted ? colors.textOnPrimary : colors.textTertiary },
          ]}
        >
          LOG SET
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  setNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricsSection: {},
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricStepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricInput: {
    textAlign: 'center',
    width: 64,
    height: 38,
    paddingHorizontal: 4,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
