import React, { useEffect, useRef, useState } from 'react';
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
import type { ActiveSet, SecondaryMetricDef } from '../../types/workout';
import { crossPlatformAlert } from '../../lib/cross-platform-alert';
import { useVelocityStepper, WEIGHT_STAGES } from '../../hooks/useVelocityStepper';
import { useProfileStore } from '../../stores/profile-store';

export interface DistanceWeightSetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  onLog: (setId: string, weight: number, reps: number) => void; // reps carries distance value
  onComplete: (setId: string) => void;
  onRemove: (setId: string) => void;
  weightLabel?: string;
  distanceMetric?: SecondaryMetricDef;
}

export const DistanceWeightSetRow = React.memo(function DistanceWeightSetRow({
  set,
  exerciseInstanceId,
  onLog,
  onComplete,
  onRemove,
  weightLabel,
  distanceMetric,
}: DistanceWeightSetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const unitPreference = useProfileStore((s) => s.profile.unitPreference);
  const weightUnit = unitPreference === 'metric' ? 'kg' : 'lbs';
  const weightStep = unitPreference === 'metric' ? 2.5 : 5;

  const distStep = distanceMetric?.step ?? 5;
  const distUnit = distanceMetric?.unit ?? 'meters';
  const distLabel = distUnit === 'meters' ? 'm' : distUnit;
  const distMax = distanceMetric?.max ?? 200;
  const distDefault = distanceMetric?.defaultValue ?? 25;

  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? '');
  const [localDistance, setLocalDistance] = useState(
    (set.reps ?? distDefault).toString(),
  );
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (set.weight !== undefined) setLocalWeight(set.weight.toString());
  }, [set.weight]);

  useEffect(() => {
    if (set.reps !== undefined) setLocalDistance(set.reps.toString());
  }, [set.reps]);

  // Green flash when set completes
  useEffect(() => {
    if (set.isCompleted) {
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      completionFlash(scaleAnim).start();
    }
  }, [set.isCompleted]);

  // ── Velocity stepper for weight ──
  const weightVelocity = useVelocityStepper({
    initialValue: parseFloat(localWeight) || 0,
    step: weightStep,
    min: 0,
    onChange: (newVal) => {
      setLocalWeight(newVal.toString());
      const d = parseFloat(localDistance) || 0;
      onLog(set.id, newVal, d);
    },
    accelerationStages: WEIGHT_STAGES,
  });

  // ── Velocity stepper for distance ──
  const distanceVelocity = useVelocityStepper({
    initialValue: parseFloat(localDistance) || 0,
    step: distStep,
    min: 0,
    max: distMax,
    onChange: (newVal) => {
      setLocalDistance(newVal.toString());
      const w = parseFloat(localWeight) || 0;
      onLog(set.id, w, newVal);
    },
  });

  const handleWeightChange = (text: string) => {
    setLocalWeight(text);
    const w = parseFloat(text);
    if (!isNaN(w)) {
      const d = parseFloat(localDistance) || 0;
      onLog(set.id, w, d);
    }
  };

  const handleDistanceChange = (text: string) => {
    setLocalDistance(text);
    const d = parseFloat(text);
    if (!isNaN(d)) {
      const w = parseFloat(localWeight) || 0;
      onLog(set.id, w, d);
    }
  };

  const handleComplete = () => {
    const w = parseFloat(localWeight);
    const d = parseFloat(localDistance);
    if (isNaN(w) || w <= 0 || isNaN(d) || d <= 0) return;
    onLog(set.id, w, d);
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
          backgroundColor: set.isCompleted ? colors.completedMuted : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.md,
          marginBottom: 4,
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

      {/* Set number */}
      <View style={[styles.setNumber, { width: 28 }]}>
        <Text style={[typography.label, { color: setTypeLabel ? setTypeColor : colors.textSecondary, fontWeight: '600' }]}>
          {setTypeLabel || set.setNumber}
        </Text>
      </View>

      {/* Weight stepper */}
      <View style={[styles.inputGroup, { flex: 1, marginRight: 4 }]}>
        <TouchableOpacity
          onPressIn={() => weightVelocity.handlePressIn('down')}
          onPressOut={weightVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <Animated.View
          style={{
            flex: 1,
            maxWidth: 70,
            opacity: weightVelocity.isAccelerating ? 0.7 : 1,
            transform: [{ scale: weightVelocity.isAccelerating ? 1.02 : 1 }],
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
            value={localWeight}
            onChangeText={handleWeightChange}
            keyboardType="decimal-pad"
            placeholder={weightLabel ?? weightUnit}
            placeholderTextColor={colors.textTertiary}
            selectTextOnFocus
          />
        </Animated.View>
        <TouchableOpacity
          onPressIn={() => weightVelocity.handlePressIn('up')}
          onPressOut={weightVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Distance stepper */}
      <View style={[styles.inputGroup, { flex: 1, marginRight: 4 }]}>
        <TouchableOpacity
          onPressIn={() => distanceVelocity.handlePressIn('down')}
          onPressOut={distanceVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <Animated.View
          style={{
            flex: 1,
            maxWidth: 70,
            opacity: distanceVelocity.isAccelerating ? 0.7 : 1,
            transform: [{ scale: distanceVelocity.isAccelerating ? 1.02 : 1 }],
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
            value={localDistance}
            onChangeText={handleDistanceChange}
            keyboardType="decimal-pad"
            placeholder={distLabel}
            placeholderTextColor={colors.textTertiary}
            selectTextOnFocus
          />
        </Animated.View>
        <TouchableOpacity
          onPressIn={() => distanceVelocity.handlePressIn('up')}
          onPressOut={distanceVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Complete checkmark */}
      <TouchableOpacity
        onPress={handleComplete}
        disabled={set.isCompleted}
        style={[
          styles.checkBtnCompact,
          {
            backgroundColor: set.isCompleted ? colors.completed : colors.surfaceSecondary,
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

      {/* Remove set button - only for incomplete sets */}
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
  },
  stepperBtn: {
    width: 32,
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
});
