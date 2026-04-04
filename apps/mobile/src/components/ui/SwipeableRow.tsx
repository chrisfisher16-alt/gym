import React, { useCallback } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { swipeAction } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

export interface SwipeAction {
  label: string;
  icon: string; // Ionicons name
  color: string; // background color when revealed
  onTrigger: () => void;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction; // swipe right to reveal
  rightAction?: SwipeAction; // swipe left to reveal
  threshold?: number; // px to trigger (default 80)
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 80;

const SPRING_BACK = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

const ICON_SIZE = 24;

// ── Component ──────────────────────────────────────────────────────

export const SwipeableRow = React.memo(function SwipeableRow({
  children,
  leftAction,
  rightAction,
  threshold = DEFAULT_THRESHOLD,
  enabled = true,
  style,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  const fireLeftAction = useCallback(() => {
    leftAction?.onTrigger();
  }, [leftAction]);

  const fireRightAction = useCallback(() => {
    rightAction?.onTrigger();
  }, [rightAction]);

  const fireHaptic = useCallback(() => {
    swipeAction();
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .enabled(enabled)
    .onUpdate((e) => {
      // Clamp: only allow left-drag if rightAction, right-drag if leftAction
      let tx = e.translationX;
      if (tx > 0 && !leftAction) tx = 0;
      if (tx < 0 && !rightAction) tx = 0;
      translateX.value = tx;

      // Haptic on threshold cross
      const absTx = Math.abs(tx);
      if (absTx >= threshold && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(fireHaptic)();
      } else if (absTx < threshold && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd(() => {
      const tx = translateX.value;
      if (tx > threshold && leftAction) {
        // Trigger left action
        runOnJS(fireLeftAction)();
      } else if (tx < -threshold && rightAction) {
        // Trigger right action
        runOnJS(fireRightAction)();
      }
      translateX.value = withSpring(0, SPRING_BACK);
      hasTriggeredHaptic.value = false;
    });

  // ── Animated styles ────────────────────────────────────────────

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftBgStyle = useAnimatedStyle(() => {
    const width = Math.max(0, translateX.value);
    return {
      width,
      opacity: interpolate(translateX.value, [0, threshold], [0, 1], 'clamp'),
    };
  });

  const leftIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [0, threshold * 0.6, threshold],
      [0.6, 0.8, 1],
      'clamp',
    );
    const iconScale =
      translateX.value > threshold
        ? withSequence(
            withTiming(1.2, { duration: 80 }),
            withSpring(1, { damping: 12, stiffness: 300 }),
          )
        : scale;
    return {
      transform: [{ scale: iconScale }],
    };
  });

  const rightBgStyle = useAnimatedStyle(() => {
    const width = Math.max(0, -translateX.value);
    return {
      width,
      opacity: interpolate(-translateX.value, [0, threshold], [0, 1], 'clamp'),
    };
  });

  const rightIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      -translateX.value,
      [0, threshold * 0.6, threshold],
      [0.6, 0.8, 1],
      'clamp',
    );
    const iconScale =
      -translateX.value > threshold
        ? withSequence(
            withTiming(1.2, { duration: 80 }),
            withSpring(1, { damping: 12, stiffness: 300 }),
          )
        : scale;
    return {
      transform: [{ scale: iconScale }],
    };
  });

  if (!leftAction && !rightAction) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="button"
      accessibilityActions={[
        ...(leftAction ? [{ name: leftAction.label.toLowerCase(), label: leftAction.label }] : []),
        ...(rightAction ? [{ name: rightAction.label.toLowerCase(), label: rightAction.label }] : []),
      ]}
      onAccessibilityAction={(event) => {
        const actionName = event.nativeEvent.actionName;
        if (leftAction && actionName === leftAction.label.toLowerCase()) {
          leftAction.onTrigger();
        } else if (rightAction && actionName === rightAction.label.toLowerCase()) {
          rightAction.onTrigger();
        }
      }}
    >
      {/* Left action background (swipe right reveals) */}
      {leftAction && (
        <Animated.View
          style={[
            styles.actionBg,
            styles.leftBg,
            { backgroundColor: leftAction.color },
            leftBgStyle,
          ]}
        >
          <Animated.View style={[styles.actionContent, leftIconStyle]}>
            <Ionicons
              name={leftAction.icon as keyof typeof Ionicons.glyphMap}
              size={ICON_SIZE}
              color="#FFFFFF"
            />
            <Text style={styles.actionLabel}>{leftAction.label}</Text>
          </Animated.View>
        </Animated.View>
      )}

      {/* Right action background (swipe left reveals) */}
      {rightAction && (
        <Animated.View
          style={[
            styles.actionBg,
            styles.rightBg,
            { backgroundColor: rightAction.color },
            rightBgStyle,
          ]}
        >
          <Animated.View style={[styles.actionContent, rightIconStyle]}>
            <Ionicons
              name={rightAction.icon as keyof typeof Ionicons.glyphMap}
              size={ICON_SIZE}
              color="#FFFFFF"
            />
            <Text style={styles.actionLabel}>{rightAction.label}</Text>
          </Animated.View>
        </Animated.View>
      )}

      {/* Sliding content */}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  actionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leftBg: {
    left: 0,
    alignItems: 'flex-start',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rightBg: {
    right: 0,
    alignItems: 'flex-end',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
