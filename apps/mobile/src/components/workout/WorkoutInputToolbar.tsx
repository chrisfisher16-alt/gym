import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { lightImpact } from '../../lib/haptics';

// ── Types ─────────────────────────────────────────────────────────────

export type InputType = 'weight' | 'reps' | 'duration' | 'distance' | 'level';

export interface WorkoutInputToolbarProps {
  inputType: InputType;
  currentValue: number;
  lastSessionValue?: number | null;
  unitLabel?: string;
  onSetValue: (value: number) => void;
  visible: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────

const REPS_PRESETS = [5, 8, 10, 12, 15, 20] as const;
const WEIGHT_INCREMENTS = [2.5, 5, 10] as const;
const DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const;
const DISTANCE_PRESETS = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0] as const;
const LEVEL_PRESETS = [1, 3, 5, 7, 9, 12, 15] as const;
const ANIMATION_DURATION = 150;
const TOOLBAR_HEIGHT = 52;


// ── Component ─────────────────────────────────────────────────────────

export function WorkoutInputToolbar({
  inputType,
  currentValue,
  lastSessionValue,
  unitLabel = 'lbs',
  onSetValue,
  visible,
}: WorkoutInputToolbarProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // ── Animated height / opacity ───────────────────────────────────────
  const animProgress = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    animProgress.value = withTiming(visible ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.quad),
    });
  }, [visible, animProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    height: animProgress.value * TOOLBAR_HEIGHT,
    opacity: animProgress.value,
    overflow: 'hidden' as const,
  }));

  // ── Handlers ────────────────────────────────────────────────────────

  const handlePress = useCallback(
    (value: number) => {
      lightImpact();
      onSetValue(value);
    },
    [onSetValue],
  );

  const handleIncrement = useCallback(
    (delta: number) => {
      lightImpact();
      onSetValue(Math.max(0, currentValue + delta));
    },
    [currentValue, onSetValue],
  );

  const handleSameAsLast = useCallback(() => {
    if (lastSessionValue != null) {
      lightImpact();
      onSetValue(lastSessionValue);
    }
  }, [lastSessionValue, onSetValue]);

  // ── Derived data ────────────────────────────────────────────────────

  const hasLastSession = lastSessionValue != null && lastSessionValue > 0;
  const isCurrentMatchingLast =
    hasLastSession && currentValue === lastSessionValue;

  // ── Chip builder ────────────────────────────────────────────────────

  const chipStyle = useCallback(
    (isActive: boolean, isAccent: boolean) => [
      styles.chip,
      {
        backgroundColor: isActive
          ? isAccent
            ? colors.gold
            : colors.primary
          : colors.surfaceSecondary,
        borderColor: isActive
          ? 'transparent'
          : colors.border,
        borderRadius: radius.full,
      },
    ],
    [colors, radius],
  );

  const chipTextStyle = useCallback(
    (isActive: boolean, isAccent: boolean) => [
      typography.labelSmall,
      {
        color: isActive
          ? colors.textInverse
          : colors.text,
        fontWeight: '600' as const,
      },
    ],
    [colors, typography],
  );

  // ── Weight toolbar content ──────────────────────────────────────────

  const weightButtons = useMemo(() => {
    const items: React.ReactNode[] = [];

    // "Last: X" accent chip
    if (hasLastSession) {
      const isActive = isCurrentMatchingLast;
      items.push(
        <TouchableOpacity
          key="last-value"
          onPress={() => handlePress(lastSessionValue!)}
          style={chipStyle(isActive, true)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isActive, true)}>
            Last: {lastSessionValue}
          </Text>
        </TouchableOpacity>,
      );
    }

    // Increment chips: +2.5, +5, +10
    for (const inc of WEIGHT_INCREMENTS) {
      const label = `+${inc}`;
      items.push(
        <TouchableOpacity
          key={label}
          onPress={() => handleIncrement(inc)}
          style={chipStyle(false, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(false, false)}>{label}</Text>
        </TouchableOpacity>,
      );
    }

    // "Same as last" chip
    if (hasLastSession) {
      items.push(
        <TouchableOpacity
          key="same-as-last"
          onPress={handleSameAsLast}
          style={chipStyle(isCurrentMatchingLast, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isCurrentMatchingLast, false)}>
            Same as last
          </Text>
        </TouchableOpacity>,
      );
    }

    return items;
  }, [
    hasLastSession,
    isCurrentMatchingLast,
    lastSessionValue,
    handlePress,
    handleIncrement,
    handleSameAsLast,
    chipStyle,
    chipTextStyle,
  ]);

  // ── Reps toolbar content ────────────────────────────────────────────

  const repsButtons = useMemo(() => {
    return REPS_PRESETS.map((rep) => {
      const isActive = currentValue === rep;
      return (
        <TouchableOpacity
          key={`rep-${rep}`}
          onPress={() => handlePress(rep)}
          style={chipStyle(isActive, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isActive, false)}>{rep}</Text>
        </TouchableOpacity>
      );
    });
  }, [currentValue, handlePress, chipStyle, chipTextStyle]);

  // ── Duration toolbar content ───────────────────────────────────────

  const durationButtons = useMemo(() => {
    return DURATION_PRESETS.map((sec) => {
      const isActive = currentValue === sec;
      const label = sec >= 60 ? `${sec / 60}m` : `${sec}s`;
      return (
        <TouchableOpacity
          key={`dur-${sec}`}
          onPress={() => handlePress(sec)}
          style={chipStyle(isActive, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isActive, false)}>{label}</Text>
        </TouchableOpacity>
      );
    });
  }, [currentValue, handlePress, chipStyle, chipTextStyle]);

  // ── Distance toolbar content ───────────────────────────────────────

  const distanceButtons = useMemo(() => {
    return DISTANCE_PRESETS.map((dist) => {
      const isActive = currentValue === dist;
      return (
        <TouchableOpacity
          key={`dist-${dist}`}
          onPress={() => handlePress(dist)}
          style={chipStyle(isActive, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isActive, false)}>{dist} {unitLabel}</Text>
        </TouchableOpacity>
      );
    });
  }, [currentValue, handlePress, chipStyle, chipTextStyle, unitLabel]);

  // ── Level toolbar content ──────────────────────────────────────────

  const levelButtons = useMemo(() => {
    return LEVEL_PRESETS.map((lvl) => {
      const isActive = currentValue === lvl;
      return (
        <TouchableOpacity
          key={`lvl-${lvl}`}
          onPress={() => handlePress(lvl)}
          style={chipStyle(isActive, false)}
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isActive, false)}>Lv {lvl}</Text>
        </TouchableOpacity>
      );
    });
  }, [currentValue, handlePress, chipStyle, chipTextStyle]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <Reanimated.View style={containerStyle}>
      <View
        style={[
          styles.toolbar,
          {
            borderTopColor: colors.borderLight,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { gap: spacing.sm }]}
          keyboardShouldPersistTaps="always"
        >
          {inputType === 'weight'
            ? weightButtons
            : inputType === 'duration'
              ? durationButtons
              : inputType === 'distance'
                ? distanceButtons
                : inputType === 'level'
                  ? levelButtons
                  : repsButtons}
        </ScrollView>
      </View>
    </Reanimated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toolbar: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
});
