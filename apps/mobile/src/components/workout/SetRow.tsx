import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useProfileStore } from '../../stores/profile-store';
import { successNotification, selectionFeedback, mediumImpact, weightIncrement as weightIncrementHaptic } from '../../lib/haptics';
import { completionFlash, checkPop, goldPulse } from '../../lib/animations';
import type { ActiveSet } from '../../types/workout';
import { crossPlatformAlert } from '../../lib/cross-platform-alert';
import { useVelocityStepper, type AccelerationStage } from '../../hooks/useVelocityStepper';
import { getCrossedSnapPoint, type SnapPoint } from '../../lib/weight-snap-points';

export interface SetRowProps {
  set: ActiveSet;
  exerciseInstanceId: string;
  setIndex: number;
  previousData?: string; // e.g. "60×10" from last session's same set number
  onLog: (setId: string, weight: number, reps: number) => void;
  onComplete: (setId: string) => void;
  onRemove: (setId: string) => void;
  onRPE: (setId: string, rpe: number) => void;
  onWeightCascade?: (setIndex: number, weight: number, reps: number) => void;
  equipmentType?: string;
}

export const SetRow = React.memo(function SetRow({
  set,
  exerciseInstanceId,
  setIndex,
  previousData,
  onLog,
  onComplete,
  onRemove,
  onRPE,
  onWeightCascade,
  equipmentType,
}: SetRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const unitPreference = useProfileStore((s) => s.profile.unitPreference);
  const unitLabel = unitPreference === 'metric' ? 'kg' : 'lbs';
  const weightPlaceholder = useMemo(() => {
    if (equipmentType === 'dumbbell') return `${unitLabel} each`;
    if (equipmentType === 'barbell') return `${unitLabel} (bar)`;
    return unitLabel;
  }, [equipmentType, unitLabel]);
  const snapUnit = unitPreference === 'metric' ? 'kg' : 'lb' as const;
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? '');
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? '');
  const [userEdited, setUserEdited] = useState(false);
  const [showIncrementPicker, setShowIncrementPicker] = useState(false);
  const [weightIncrement, setWeightIncrement] = useState(unitPreference === 'metric' ? 2.5 : 5);
  const WEIGHT_INCREMENTS = unitPreference === 'metric' ? [1.25, 2.5, 5, 10] : [2.5, 5, 10, 25];
  const isAutoFilled = !!set.isAutoFilled && !userEdited;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prBounce = useRef(new Animated.Value(1)).current;
  const prGlow = useRef(new Animated.Value(0)).current;

  // ── Snap point state (reanimated) ──
  const prevWeightRef = useRef(parseFloat(localWeight) || 0);
  const snapScale = useSharedValue(1);
  const snapTooltipOpacity = useSharedValue(0);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);

  const snapWeightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: snapScale.value }],
  }));

  const snapTooltipStyle = useAnimatedStyle(() => ({
    opacity: snapTooltipOpacity.value,
  }));

  const fireSnapEffect = useCallback((sp: SnapPoint) => {
    // Haptic: medium impact instead of light
    mediumImpact();
    // Visual: scale bump
    snapScale.value = withSequence(
      withTiming(1.15, { duration: 150 }),
      withTiming(1, { duration: 150 }),
    );
    // Tooltip: show label then fade out
    setSnapLabel(`${sp.label} \u{1F4AA}`);
    snapTooltipOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(800, withTiming(0, { duration: 200 })),
    );
  }, [snapScale, snapTooltipOpacity]);

  const checkSnapPoint = useCallback((newWeight: number) => {
    const oldWeight = prevWeightRef.current;
    prevWeightRef.current = newWeight;
    const crossed = getCrossedSnapPoint(oldWeight, newWeight, snapUnit);
    if (crossed) {
      fireSnapEffect(crossed);
    }
  }, [snapUnit, fireSnapEffect]);

  // ── Velocity stepper for weight ──
  const weightStages = useMemo<AccelerationStage[]>(() => [
    { delay: 0, step: weightIncrement, hapticInterval: 400 },
    { delay: 400, step: weightIncrement * 2, hapticInterval: 200 },
    { delay: 1200, step: weightIncrement * 4, hapticInterval: 100 },
  ], [weightIncrement]);

  const weightVelocity = useVelocityStepper({
    initialValue: parseFloat(localWeight) || 0,
    step: weightIncrement,
    min: 0,
    onChange: (newVal) => {
      setUserEdited(true);
      setLocalWeight(newVal.toString());
      checkSnapPoint(newVal);
      const r = parseInt(localReps, 10);
      if (!isNaN(r)) {
        onLog(set.id, newVal, r);
      }
    },
    accelerationStages: weightStages,
  });

  // ── Velocity stepper for reps ──
  const repStages = useMemo<AccelerationStage[]>(() => [
    { delay: 0, step: 1, hapticInterval: 400 },
    { delay: 400, step: 1, hapticInterval: 200 },
    { delay: 1200, step: 2, hapticInterval: 100 },
  ], []);

  const repsVelocity = useVelocityStepper({
    initialValue: parseInt(localReps, 10) || 0,
    step: 1,
    min: 0,
    onChange: (newVal) => {
      setUserEdited(true);
      setLocalReps(newVal.toString());
      const w = parseFloat(localWeight);
      if (!isNaN(w)) onLog(set.id, w, newVal);
    },
    accelerationStages: repStages,
  });

  useEffect(() => {
    if (set.weight !== undefined) setLocalWeight(set.weight.toString());
  }, [set.weight]);

  useEffect(() => {
    if (set.reps !== undefined) setLocalReps(set.reps.toString());
  }, [set.reps]);

  useEffect(() => {
    if (set.isPR && set.isCompleted) {
      successNotification();
      // PR trophy bounce
      prBounce.setValue(0);
      checkPop(prBounce).start();
      goldPulse(prGlow).start();
    }
  }, [set.isPR, set.isCompleted]);

  // Green flash when set completes
  useEffect(() => {
    if (set.isCompleted) {
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      completionFlash(scaleAnim).start();
    }
  }, [set.isCompleted]);

  // ── Double-tap weight to toggle previous session value ──
  const weightHighlightAnim = useRef(new Animated.Value(0)).current;
  const parsePreviousWeight = useCallback((): number | null => {
    if (!previousData) return null;
    // previousData format: "60×10" or "60 × 10"
    const match = previousData.match(/^([\d.]+)/);
    return match ? parseFloat(match[1]) : null;
  }, [previousData]);

  const handleDoubleTapWeight = useCallback(() => {
    const prevWeight = parsePreviousWeight();
    if (prevWeight === null) return;

    const currentW = parseFloat(localWeight);
    const newWeight = currentW === prevWeight ? '' : prevWeight.toString();

    setLocalWeight(newWeight);
    setUserEdited(true);
    weightIncrementHaptic();

    // Flash highlight
    weightHighlightAnim.setValue(1);
    Animated.timing(weightHighlightAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    if (newWeight) {
      const r = parseInt(localReps, 10);
      if (!isNaN(r)) {
        onLog(set.id, prevWeight, r);
      }
    }
  }, [parsePreviousWeight, localWeight, localReps, set.id, setIndex, onLog, onWeightCascade, weightHighlightAnim]);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((_e, success) => {
      'worklet';
      if (success) {
        runOnJS(handleDoubleTapWeight)();
      }
    });

  const handleWeightChange = (text: string) => {
    setLocalWeight(text);
    setUserEdited(true);
    const w = parseFloat(text);
    if (!isNaN(w)) {
      checkSnapPoint(w);
    }
    const r = parseInt(localReps, 10);
    if (!isNaN(w) && !isNaN(r)) {
      onLog(set.id, w, r);
    }
  };

  const handleRepsChange = (text: string) => {
    setLocalReps(text);
    setUserEdited(true);
    const w = parseFloat(localWeight);
    const r = parseInt(text, 10);
    if (!isNaN(w) && !isNaN(r)) {
      onLog(set.id, w, r);
    }
  };



  const handleComplete = () => {
    const w = parseFloat(localWeight);
    const r = parseInt(localReps, 10);
    if (isNaN(w) || isNaN(r)) {
      // Require valid weight and reps before completing
      return;
    }
    mediumImpact();
    onLog(set.id, w, r);
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
      {/* Green flash overlay */}
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

      {/* Set number */}
      <View style={[styles.setNumber, { width: 28 }]}>
        <Text style={[typography.label, { color: setTypeLabel ? setTypeColor : colors.textSecondary, fontWeight: '600' }]}>
          {setTypeLabel || set.setNumber}
        </Text>
      </View>

      {/* Previous performance */}
      <View style={{ width: 52, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={[typography.caption, { color: colors.textTertiary, fontSize: 11 }]}
          numberOfLines={1}
        >
          {previousData ?? '—'}
        </Text>
      </View>

      {/* Weight stepper */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPressIn={() => weightVelocity.handlePressIn('down')}
          onPressOut={weightVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[
            styles.stepperBtn,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.sm,
            },
          ]}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <GestureDetector gesture={doubleTapGesture}>
          <Reanimated.View style={snapWeightStyle}>
            <TouchableOpacity
              onPress={() => setShowIncrementPicker(true)}
              activeOpacity={0.7}
              style={{ alignItems: 'center' }}
            >
              <Animated.View
                style={{
                  opacity: weightVelocity.isAccelerating ? 0.7 : 1,
                  transform: [{ scale: weightVelocity.isAccelerating ? 1.02 : 1 }],
                }}
              >
                <TextInput
                  style={[
                    styles.stepperValue,
                    {
                      color: isAutoFilled ? colors.textTertiary : colors.text,
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.sm,
                      ...typography.body,
                      fontWeight: isAutoFilled ? '400' : '700',
                      fontStyle: isAutoFilled ? 'italic' : 'normal',
                    },
                  ]}
                  value={localWeight}
                  onChangeText={handleWeightChange}
                  keyboardType="decimal-pad"
                  placeholder={weightPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  selectTextOnFocus
                />
                {/* Double-tap highlight overlay */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: radius.sm,
                      opacity: weightHighlightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
                    },
                  ]}
                />
              </Animated.View>
              <Text style={[typography.caption, { color: colors.textTertiary, fontSize: 9, marginTop: -2 }]}>±{weightIncrement}</Text>
            </TouchableOpacity>
            {/* Snap point tooltip */}
            {snapLabel && (
              <Reanimated.View
                style={[snapTooltipStyle, styles.snapTooltip]}
                pointerEvents="none"
              >
                <Text style={[styles.snapTooltipText, { color: colors.gold ?? colors.warning }]}>
                  {snapLabel}
                </Text>
              </Reanimated.View>
            )}
          </Reanimated.View>
        </GestureDetector>
        <TouchableOpacity
          onPressIn={() => weightVelocity.handlePressIn('up')}
          onPressOut={weightVelocity.handlePressOut}
          activeOpacity={0.7}
          style={[
            styles.stepperBtn,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.sm,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Weight increment picker */}
      <Modal
        visible={showIncrementPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIncrementPicker(false)}
      >
        <Pressable
          style={styles.incrementOverlay}
          onPress={() => setShowIncrementPicker(false)}
        >
          <View style={[styles.incrementCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <Text style={[typography.label, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>Weight Increment</Text>
            <View style={styles.incrementRow}>
              {WEIGHT_INCREMENTS.map((inc) => (
                <TouchableOpacity
                  key={inc}
                  onPress={() => {
                    setWeightIncrement(inc);
                    selectionFeedback();
                    setShowIncrementPicker(false);
                  }}
                  style={[
                    styles.incrementChip,
                    {
                      backgroundColor: weightIncrement === inc ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text style={[typography.label, { color: weightIncrement === inc ? colors.textInverse : colors.text }]}>±{inc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <Text style={[typography.label, { color: colors.textTertiary, marginHorizontal: 4 }]}>×</Text>

      {/* Reps stepper */}
      <View style={styles.inputGroup}>
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
            opacity: repsVelocity.isAccelerating ? 0.7 : 1,
            transform: [{ scale: repsVelocity.isAccelerating ? 1.02 : 1 }],
          }}
        >
          <TextInput
            style={[
              styles.stepperValue,
              {
                color: isAutoFilled ? colors.textTertiary : colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.sm,
                ...typography.body,
                fontWeight: isAutoFilled ? '400' : '700',
                fontStyle: isAutoFilled ? 'italic' : 'normal',
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

      {/* Complete checkmark */}
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

      {/* PR badge */}
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
    right: -8,
    top: -8,
  },
  incrementOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incrementCard: {
    padding: 16,
    width: '70%',
    maxWidth: 280,
  },
  incrementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  incrementChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 48,
    alignItems: 'center',
  },
  snapTooltip: {
    position: 'absolute',
    bottom: -14,
    alignSelf: 'center',
  },
  snapTooltipText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
