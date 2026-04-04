import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { mediumImpact } from '../../lib/haptics';

// ── Types ───────────────────────────────────────────────────────────

export interface RewindOverlayProps {
  /** What was undone, e.g. "Completed Set 3 — Bench Press 90×5" */
  description: string;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when the animation completes and the overlay should be hidden */
  onComplete: () => void;
}

// ── Component ───────────────────────────────────────────────────────

const FADE_IN_MS = 200;
const HOLD_MS = 800;
const FADE_OUT_MS = 200;

export function RewindOverlay({ description, visible, onComplete }: RewindOverlayProps) {
  const { typography, colors } = useTheme();

  const backdropOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const iconRotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      mediumImpact();

      // Backdrop fade in → hold → fade out
      backdropOpacity.value = withSequence(
        withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.ease) }),
        withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        })),
      );

      // Content appears slightly after backdrop
      contentOpacity.value = withSequence(
        withDelay(50, withTiming(1, { duration: FADE_IN_MS - 50 })),
        withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS })),
      );

      // Quick spin for the rewind icon
      iconRotation.value = 0;
      iconRotation.value = withTiming(-360, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      backdropOpacity.value = 0;
      contentOpacity.value = 0;
      iconRotation.value = 0;
    }
  }, [visible, backdropOpacity, contentOpacity, iconRotation, onComplete]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, backdropStyle]} pointerEvents="none">
      <Animated.View style={[styles.content, contentStyle]}>
        <Animated.View style={iconStyle}>
          <Text style={styles.icon}>⏪</Text>
        </Animated.View>
        <Text
          style={[
            typography.label,
            styles.description,
            { color: colors.textInverse },
          ]}
          numberOfLines={2}
        >
          Undid: {description}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
