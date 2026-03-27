import React, { useCallback, useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DISMISS_THRESHOLD = 30;
const AUTO_DISMISS_MS = 8_000;

export interface CoachPeekProps {
  message: string;
  coachPrompt?: string;
  onDismiss: () => void;
  onExpand: () => void;
  /** Distance from bottom of screen to position the pill */
  bottomOffset: number;
}

export function CoachPeek({
  message,
  coachPrompt,
  onDismiss,
  onExpand,
  bottomOffset,
}: CoachPeekProps) {
  const { colors, spacing, typography, dark } = useTheme();
  const bgColor = dark ? 'rgba(207, 174, 128, 0.92)' : 'rgba(184, 148, 79, 0.92)';
  const textColor = colors.textInverse;

  // ── Slide-up animation ──────────────────────────────────────────
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Slide up after a brief mount delay (the 3s delay is handled by the trigger)
    translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    opacity.value = withDelay(50, withTiming(1, { duration: 250 }));
  }, [translateY, opacity]);

  // ── Auto-dismiss ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // ── Swipe-to-dismiss gesture ────────────────────────────────────
  const panTranslateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow downward swipe
      if (e.translationY > 0) {
        panTranslateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        // Dismiss with spring
        panTranslateY.value = withSpring(120, { damping: 20 });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onDismiss)();
      } else {
        // Snap back
        panTranslateY.value = withSpring(0, { damping: 15 });
      }
    });

  // ── Tap → expand to coach ───────────────────────────────────────
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onExpand)();
  });

  const composed = Gesture.Race(panGesture, tapGesture);

  // ── Animated styles ─────────────────────────────────────────────
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + panTranslateY.value }],
    opacity: opacity.value,
  }));

  const handleDismissPress = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        exiting={FadeOut.duration(200)}
        style={[
          styles.pill,
          pillStyle,
          {
            bottom: bottomOffset,
            backgroundColor: bgColor,
            paddingVertical: spacing.sm,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
          },
        ]}
      >
        <Text style={styles.icon}>💡</Text>
        <Text
          style={[
            typography.bodySmall,
            styles.message,
            { color: textColor, fontSize: 14, marginHorizontal: spacing.sm },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {message}
        </Text>
        <TouchableOpacity
          onPress={handleDismissPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
          style={[styles.closeBtn, { marginLeft: spacing.xs }]}
        >
          <Text style={[styles.closeText, { color: textColor }]}>×</Text>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.9,
    borderRadius: 24,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  icon: {
    fontSize: 16,
  },
  message: {
    flex: 1,
    flexShrink: 1,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
});
