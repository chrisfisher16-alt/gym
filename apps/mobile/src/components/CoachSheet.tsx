import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useCoachSheet } from '../providers/CoachSheetProvider';
import { CoachChatUI } from './CoachChatUI';
import { lightImpact } from '../lib/haptics';

const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 0.8 };

export function CoachSheet() {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, radius } = useTheme();
  const { isOpen, close } = useCoachSheet();

  // Snap points as Y positions from TOP of screen
  const FULL_SNAP = insets.top + 10; // near top, respecting safe area
  const DEFAULT_SNAP = screenHeight * 0.3; // 70% visible (30% from top)
  const CLOSED_SNAP = screenHeight + 50; // off-screen below

  const translateY = useSharedValue(CLOSED_SNAP);
  const backdropOpacity = useSharedValue(0);
  const currentSnap = useSharedValue(CLOSED_SNAP);

  // Open/close animation
  useEffect(() => {
    if (isOpen) {
      translateY.value = withSpring(DEFAULT_SNAP, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 250 });
      currentSnap.value = DEFAULT_SNAP;
    } else {
      translateY.value = withSpring(CLOSED_SNAP, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 200 });
      currentSnap.value = CLOSED_SNAP;
    }
  }, [isOpen, DEFAULT_SNAP, CLOSED_SNAP, translateY, backdropOpacity, currentSnap]);

  // Pan gesture for drag-to-dismiss / snap
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const newY = currentSnap.value + e.translationY;
      // Clamp: don't go above FULL_SNAP
      translateY.value = Math.max(FULL_SNAP, newY);
    })
    .onEnd((e) => {
      const currentY = translateY.value;
      const velocity = e.velocityY;

      // Fast downward flick → dismiss
      if (velocity > 1000) {
        translateY.value = withSpring(CLOSED_SNAP, SPRING_CONFIG);
        backdropOpacity.value = withTiming(0, { duration: 200 });
        currentSnap.value = CLOSED_SNAP;
        runOnJS(close)();
        return;
      }

      // Fast upward flick → full screen
      if (velocity < -1000) {
        translateY.value = withSpring(FULL_SNAP, SPRING_CONFIG);
        currentSnap.value = FULL_SNAP;
        runOnJS(lightImpact)();
        return;
      }

      // Snap to nearest point
      const midDefault = (FULL_SNAP + DEFAULT_SNAP) / 2;
      const midClosed = (DEFAULT_SNAP + CLOSED_SNAP) / 2;

      if (currentY < midDefault) {
        // Snap to full
        translateY.value = withSpring(FULL_SNAP, SPRING_CONFIG);
        currentSnap.value = FULL_SNAP;
      } else if (currentY < midClosed) {
        // Snap to default
        translateY.value = withSpring(DEFAULT_SNAP, SPRING_CONFIG);
        currentSnap.value = DEFAULT_SNAP;
      } else {
        // Dismiss
        translateY.value = withSpring(CLOSED_SNAP, SPRING_CONFIG);
        backdropOpacity.value = withTiming(0, { duration: 200 });
        currentSnap.value = CLOSED_SNAP;
        runOnJS(close)();
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      backdropOpacity.value,
      [0, 1],
      [0, 0.5],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <>
      {/* Backdrop — pointer events controlled by outer wrapper */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Reanimated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000' },
            backdropStyle,
          ]}
        >
          <TouchableWithoutFeedback onPress={close}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Reanimated.View>
      </View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Reanimated.View
          style={[
            styles.sheet,
            {
              height: screenHeight,
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
            },
            sheetStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Coach Chat — persistently mounted to preserve conversation */}
          <CoachChatUI keyboardVerticalOffset={0} showHeader={false} />
        </Reanimated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
