import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { formatTimerDisplay } from '../../lib/workout-utils';
import { successNotification } from '../../lib/haptics';
import type { ActiveSet } from '../../types/workout';

const DURATION_PRESETS = [30, 45, 60, 90, 120];

export interface TimedSetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  defaultDuration: number;
  onLogDuration: (setId: string, durationSeconds: number) => void;
  onComplete: (setId: string) => void;
}

export const TimedSetRow = React.memo(function TimedSetRow({
  set,
  exerciseInstanceId,
  defaultDuration,
  onLogDuration,
  onComplete,
}: TimedSetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [selectedDuration, setSelectedDuration] = useState(set.durationSeconds ?? defaultDuration);
  const [timerActive, setTimerActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(selectedDuration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerActive) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerActive(false);
          successNotification();
          onLogDuration(set.id, selectedDuration);
          onComplete(set.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive, selectedDuration, set.id, onLogDuration, onComplete]);

  const handleStart = () => {
    setSecondsLeft(selectedDuration);
    setTimerActive(true);
  };

  const handlePause = () => {
    setTimerActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleReset = () => {
    setTimerActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(selectedDuration);
  };

  const handleSelectDuration = (d: number) => {
    setSelectedDuration(d);
    setSecondsLeft(d);
    onLogDuration(set.id, d);
  };

  const handleManualComplete = () => {
    onLogDuration(set.id, selectedDuration);
    onComplete(set.id);
  };

  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';

  if (set.isCompleted) {
    return (
      <View
        style={[
          styles.setRow,
          {
            backgroundColor: colors.successLight,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            marginBottom: 2,
          },
        ]}
      >
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {setTypeLabel || set.setNumber}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[typography.label, { color: colors.success }]}>
            {set.durationSeconds ?? selectedDuration}s ✓
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.timedSetContainer,
        {
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          marginBottom: 4,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
    >
      <View style={styles.timedSetHeader}>
        <View style={[styles.setNumber, { width: 28 }]}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {setTypeLabel || set.setNumber}
          </Text>
        </View>
        {/* Timer display */}
        <View style={styles.timerDisplay}>
          <Text style={[typography.h2, { color: timerActive ? colors.primary : colors.text }]}>
            {formatTimerDisplay(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* Duration presets */}
      {!timerActive && (
        <View style={styles.durationPresets}>
          {DURATION_PRESETS.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => handleSelectDuration(d)}
              style={[
                styles.durationChip,
                {
                  backgroundColor: selectedDuration === d ? colors.primary : colors.surface,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: selectedDuration === d ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: selectedDuration === d ? colors.textInverse : colors.text },
                ]}
              >
                {d}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Timer controls */}
      <View style={styles.timerControls}>
        {!timerActive ? (
          <>
            <TouchableOpacity
              onPress={handleStart}
              style={[styles.timerBtn, { backgroundColor: colors.success, borderRadius: radius.md }]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="play" size={16} color={colors.textInverse} />
              <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleManualComplete}
              style={[styles.timerBtn, { backgroundColor: colors.primaryMuted, borderRadius: radius.md }]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={handlePause}
              style={[styles.timerBtn, { backgroundColor: colors.warning, borderRadius: radius.md }]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="pause" size={16} color={colors.textInverse} />
              <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.timerBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={[typography.labelSmall, { color: colors.text, marginLeft: 4 }]}>Reset</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timedSetContainer: {},
  timedSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  durationPresets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
  },
});
