import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { successNotification } from '../../lib/haptics';
import { completionFlash, checkPop, goldPulse } from '../../lib/animations';
import type { ActiveSet } from '../../types/workout';
import { crossPlatformAlert } from '../../lib/cross-platform-alert';
import { useVelocityStepper, REP_STAGES } from '../../hooks/useVelocityStepper';

export interface BodyweightSetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  onLog: (setId: string, weight: number, reps: number) => void;
  onComplete: (setId: string) => void;
  onRemove: (setId: string) => void;
  onRPE: (setId: string, rpe: number) => void;
}

export const BodyweightSetRow = React.memo(function BodyweightSetRow({
  set,
  exerciseInstanceId,
  onLog,
  onComplete,
  onRemove,
  onRPE,
}: BodyweightSetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? '');
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prBounce = useRef(new Animated.Value(1)).current;
  const prGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (set.reps !== undefined) setLocalReps(set.reps.toString());
  }, [set.reps]);

  useEffect(() => {
    if (set.isPR && set.isCompleted) {
      successNotification();
      prBounce.setValue(0);
      checkPop(prBounce).start();
      goldPulse(prGlow).start();
    }
  }, [set.isPR, set.isCompleted]);

  useEffect(() => {
    if (set.isCompleted) {
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      completionFlash(scaleAnim).start();
    }
  }, [set.isCompleted]);

  // ── Velocity stepper for reps ──
  const repsVelocity = useVelocityStepper({
    initialValue: parseInt(localReps, 10) || 0,
    step: 1,
    min: 0,
    onChange: (newVal) => {
      setLocalReps(newVal.toString());
      onLog(set.id, 0, newVal);
    },
    accelerationStages: REP_STAGES,
  });

  const handleRepsChange = (text: string) => {
    setLocalReps(text);
    const r = parseInt(text, 10);
    if (!isNaN(r)) onLog(set.id, 0, r);
  };

  const handleComplete = () => {
    const r = parseInt(localReps, 10);
    if (isNaN(r) || r <= 0) return;
    onLog(set.id, 0, r);
    onComplete(set.id);
  };

  const setTypeLabel =
    set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failure' ? 'F' : '';
  const setTypeColor =
    set.setType === 'warmup' ? colors.warning : set.setType === 'drop' ? colors.info : colors.text;

  return (
    <Animated.View
      style={[
        styles.setRow,
        {
          backgroundColor: set.isCompleted ? (set.isPR ? colors.warningLight : colors.successLight) : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.md,
          marginBottom: 4,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.success,
            borderRadius: radius.md,
            opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
          },
        ]}
      />

      <View style={[styles.setNumber, { width: 28 }]}>
        <Text style={[typography.label, { color: setTypeLabel ? setTypeColor : colors.textSecondary, fontWeight: '600' }]}>
          {setTypeLabel || set.setNumber}
        </Text>
      </View>

      {/* Reps stepper (centered, takes more space) */}
      <View style={[styles.inputGroup, { flex: 1 }]}>
        <TouchableOpacity
          onPressIn={() => repsVelocity.handlePressIn('down')}
          onPressOut={repsVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <Animated.View
          style={{
            flex: 1,
            maxWidth: 80,
            opacity: repsVelocity.isAccelerating ? 0.7 : 1,
            transform: [{ scale: repsVelocity.isAccelerating ? 1.02 : 1 }],
          }}
        >
          <TextInput
            style={[
              styles.stepperValue,
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.sm,
                ...typography.body,
                fontWeight: '700',
              },
            ]}
            value={localReps}
            onChangeText={handleRepsChange}
            keyboardType="number-pad"
            placeholder="reps"
            placeholderTextColor={colors.textTertiary}
            selectTextOnFocus
          />
        </Animated.View>
        <TouchableOpacity
          onPressIn={() => repsVelocity.handlePressIn('up')}
          onPressOut={repsVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleComplete}
        disabled={set.isCompleted}
        style={[
          styles.checkBtnCompact,
          {
            backgroundColor: set.isCompleted ? colors.success : colors.surfaceSecondary,
            borderRadius: radius.sm,
          },
        ]}
      >
        <Ionicons
          name={set.isCompleted ? 'checkmark' : 'checkmark-outline'}
          size={22}
          color={set.isCompleted ? colors.textInverse : colors.textTertiary}
        />
      </TouchableOpacity>

      {!set.isCompleted && (
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm('Remove this set?')) onRemove(set.id);
              return;
            }
            crossPlatformAlert('Remove Set', 'Remove this set?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemove(set.id) },
            ]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Remove set"
          style={[styles.removeBtn, { marginLeft: 4 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      )}

      {set.isPR && (
        <Animated.View style={[styles.prBadge, { transform: [{ scale: prBounce }] }]}>
          <Ionicons name="trophy" size={16} color={colors.gold ?? colors.warning} />
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: colors.gold ?? colors.warning,
              borderRadius: 12,
              opacity: prGlow,
            }}
          />
        </Animated.View>
      )}
    </Animated.View>
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
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    textAlign: 'center',
    flex: 1,
    width: 44,
    height: 38,
    marginHorizontal: 2,
    paddingHorizontal: 2,
  },
  checkBtnCompact: {
    width: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
});
