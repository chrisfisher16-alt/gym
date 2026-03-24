import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../theme';
import { useWorkoutStore } from '../../stores/workout-store';
import { useNutritionStore } from '../../stores/nutrition-store';
import { lightImpact, waterLogged } from '../../lib/haptics';

// ── Constants ─────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOT_SIZE = 24;
const PILL_HEIGHT = 40;
const PILL_MIN_WIDTH = 110;
const EXPANDED_WIDTH = 220;

const TAB_BAR_HEIGHT = 56;
const EDGE_MARGIN = 8;

const SNAP_SPRING = { damping: 20, stiffness: 200, mass: 0.8 };
const EXPAND_SPRING = { damping: 16, stiffness: 140 };

const DRAG_THRESHOLD = 10;
const COLLAPSE_TO_PILL_MS = 5_000;
const COLLAPSE_TO_DOT_MS = 15_000;

// ── Types ─────────────────────────────────────────────────────────────

type PillState = 'dot' | 'pill' | 'expanded';

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

function getTimeOfDayLabel(): { label: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 10) return { label: 'Breakfast', emoji: '🍳' };
  if (hour >= 11 && hour < 14) return { label: 'Lunch', emoji: '🍽' };
  if (hour >= 17 && hour < 20) return { label: 'Dinner', emoji: '🍽' };
  return { label: 'Water', emoji: '💧' };
}

// ── Component ─────────────────────────────────────────────────────────

export function QuickInputPill() {
  const { colors, spacing, radius, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const logWater = useNutritionStore((s) => s.logWater);

  // ── State ─────────────────────────────────────────────────
  const [pillState, setPillState] = useState<PillState>('pill');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Timers
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keyboard listener ─────────────────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    // Android fallback
    const showSub2 = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub2 = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
      showSub2.remove();
      hideSub2.remove();
    };
  }, []);

  // ── Context-aware label ───────────────────────────────────
  const contextLabel = useMemo(() => {
    if (activeSession) return { label: 'Log Set', emoji: '🏋' };
    return getTimeOfDayLabel();
  }, [activeSession]);

  // ── Context-aware actions ─────────────────────────────────
  const actions: QuickAction[] = useMemo(() => {
    if (activeSession) {
      return [
        {
          id: 'log-set',
          label: 'Log Set',
          icon: 'checkmark-circle-outline',
          onPress: () => {
            router.push('/(tabs)/workout');
          },
        },
        {
          id: 'add-water',
          label: 'Add Water',
          icon: 'water-outline',
          onPress: () => {
            logWater(8);
            waterLogged();
          },
        },
        {
          id: 'rest-timer',
          label: 'Rest Timer',
          icon: 'timer-outline',
          onPress: () => {
            router.push('/(tabs)/workout');
          },
        },
      ];
    }

    return [
      {
        id: 'log-meal',
        label: 'Log Meal',
        icon: 'restaurant-outline',
        onPress: () => {
          router.push('/(tabs)/nutrition');
        },
      },
      {
        id: 'add-water',
        label: 'Add Water',
        icon: 'water-outline',
        onPress: () => {
          logWater(8);
          waterLogged();
        },
      },
      {
        id: 'log-weight',
        label: 'Log Weight',
        icon: 'scale-outline',
        onPress: () => {
          router.push('/progress');
        },
      },
      {
        id: 'ask-coach',
        label: 'Ask Coach',
        icon: 'chatbubble-outline',
        onPress: () => {
          router.push('/(tabs)/coach');
        },
      },
    ];
  }, [activeSession, logWater]);

  // ── Position ──────────────────────────────────────────────
  const defaultY = SCREEN_HEIGHT - insets.bottom - TAB_BAR_HEIGHT - PILL_HEIGHT - 24;
  const defaultX = SCREEN_WIDTH - PILL_MIN_WIDTH - EDGE_MARGIN;

  const translateX = useSharedValue(defaultX);
  const translateY = useSharedValue(defaultY);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Track whether the current gesture is a drag
  const isDragging = useSharedValue(false);
  const totalDistance = useSharedValue(0);

  // Track which edge we're snapped to: 'right' or 'left'
  const snappedEdge = useRef<'left' | 'right'>('right');

  // ── Animation values ──────────────────────────────────────
  const pillScale = useSharedValue(1);
  const expandProgress = useSharedValue(0); // 0 = pill, 1 = expanded

  // ── Auto-collapse timers ──────────────────────────────────
  const clearTimers = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (dotTimerRef.current) clearTimeout(dotTimerRef.current);
    collapseTimerRef.current = null;
    dotTimerRef.current = null;
  }, []);

  const startExpandedTimer = useCallback(() => {
    clearTimers();
    collapseTimerRef.current = setTimeout(() => {
      setPillState('pill');
      expandProgress.value = withSpring(0, EXPAND_SPRING);
    }, COLLAPSE_TO_PILL_MS);
  }, [clearTimers, expandProgress]);

  const startPillTimer = useCallback(() => {
    clearTimers();
    dotTimerRef.current = setTimeout(() => {
      setPillState('dot');
      pillScale.value = withSpring(0.6, SNAP_SPRING);
    }, COLLAPSE_TO_DOT_MS);
  }, [clearTimers, pillScale]);

  const resetInteractionTimers = useCallback(() => {
    if (pillState === 'expanded') {
      startExpandedTimer();
    } else if (pillState === 'pill') {
      startPillTimer();
    }
  }, [pillState, startExpandedTimer, startPillTimer]);

  // Set up timers when state changes
  useEffect(() => {
    if (pillState === 'expanded') {
      startExpandedTimer();
    } else if (pillState === 'pill') {
      startPillTimer();
    } else {
      clearTimers();
    }
    return clearTimers;
  }, [pillState, startExpandedTimer, startPillTimer, clearTimers]);

  // ── Handlers ──────────────────────────────────────────────
  const handleTap = useCallback(() => {
    lightImpact();

    if (pillState === 'dot') {
      setPillState('pill');
      pillScale.value = withSpring(1, SNAP_SPRING);
      return;
    }

    if (pillState === 'pill') {
      setPillState('expanded');
      expandProgress.value = withSpring(1, EXPAND_SPRING);
      return;
    }

    // expanded → collapse
    setPillState('pill');
    expandProgress.value = withSpring(0, EXPAND_SPRING);
  }, [pillState, pillScale, expandProgress]);

  const handleActionPress = useCallback(
    (action: QuickAction) => {
      lightImpact();
      // Collapse first, then execute
      setPillState('pill');
      expandProgress.value = withSpring(0, EXPAND_SPRING);
      // Small delay so animation starts before navigation
      setTimeout(() => action.onPress(), 150);
    },
    [expandProgress],
  );

  const handleBackdropPress = useCallback(() => {
    setPillState('pill');
    expandProgress.value = withSpring(0, EXPAND_SPRING);
  }, [expandProgress]);

  // ── Gesture: Pan for dragging ─────────────────────────────
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      isDragging.value = false;
      totalDistance.value = 0;
    })
    .onUpdate((e) => {
      const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      totalDistance.value = dist;

      if (dist >= DRAG_THRESHOLD) {
        isDragging.value = true;
        translateX.value = contextX.value + e.translationX;
        translateY.value = contextY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (!isDragging.value) {
        // Was a tap, not a drag
        runOnJS(handleTap)();
        return;
      }

      // Snap to nearest edge
      const currentCenterX = translateX.value + PILL_MIN_WIDTH / 2;
      const snapToLeft = currentCenterX < SCREEN_WIDTH / 2;

      const snapX = snapToLeft
        ? EDGE_MARGIN
        : SCREEN_WIDTH - PILL_MIN_WIDTH - EDGE_MARGIN;

      // Clamp Y
      const minY = insets.top + 20;
      const maxY = SCREEN_HEIGHT - insets.bottom - TAB_BAR_HEIGHT - PILL_HEIGHT - 8;
      const clampedY = Math.min(Math.max(translateY.value, minY), maxY);

      translateX.value = withSpring(snapX, SNAP_SPRING);
      translateY.value = withSpring(clampedY, SNAP_SPRING);

      runOnJS(setSnappedEdge)(snapToLeft ? 'left' : 'right');
      runOnJS(resetInteractionTimers)();
    });

  function setSnappedEdge(edge: 'left' | 'right') {
    snappedEdge.current = edge;
  }

  // ── Animated styles ───────────────────────────────────────
  const pillContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: pillScale.value },
    ],
  }));

  const expandedCardStyle = useAnimatedStyle(() => ({
    width: withSpring(
      expandProgress.value > 0.5 ? EXPANDED_WIDTH : PILL_MIN_WIDTH,
      EXPAND_SPRING,
    ),
    opacity: expandProgress.value,
  }));

  // ── Colors ────────────────────────────────────────────────
  const pillBg = dark ? 'rgba(196, 162, 101, 0.95)' : 'rgba(184, 148, 79, 0.95)';
  const pillTextColor = '#1A1A1A';
  const expandedBg = colors.surface;
  const expandedBorder = dark ? 'rgba(196, 162, 101, 0.3)' : 'rgba(184, 148, 79, 0.2)';
  const backdropColor = 'rgba(0, 0, 0, 0.3)';

  // ── Don't render if keyboard visible ──────────────────────
  if (keyboardVisible) return null;

  return (
    <>
      {/* Backdrop when expanded */}
      {pillState === 'expanded' && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor, zIndex: 998 }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        </Animated.View>
      )}

      {/* Pill container */}
      <Animated.View
        style={[
          styles.pillContainer,
          pillContainerStyle,
          { zIndex: 999 },
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View>
            {/* Dot state */}
            {pillState === 'dot' && (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: pillBg },
                ]}
              />
            )}

            {/* Pill state */}
            {pillState === 'pill' && (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: pillBg,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              >
                <Text style={[styles.pillEmoji]}>{contextLabel.emoji}</Text>
                <Text
                  style={[
                    styles.pillLabel,
                    { color: pillTextColor },
                  ]}
                  numberOfLines={1}
                >
                  {contextLabel.label}
                </Text>
              </View>
            )}

            {/* Expanded state */}
            {pillState === 'expanded' && (
              <Animated.View
                style={[
                  styles.expandedCard,
                  expandedCardStyle,
                  {
                    backgroundColor: expandedBg,
                    borderColor: expandedBorder,
                    shadowColor: dark ? '#000' : '#333',
                  },
                ]}
              >
                {/* Header */}
                <View style={[styles.expandedHeader, { paddingHorizontal: spacing.md }]}>
                  <Text style={[styles.pillEmoji]}>{contextLabel.emoji}</Text>
                  <Text
                    style={[
                      styles.expandedTitle,
                      { color: colors.text },
                    ]}
                  >
                    Quick Actions
                  </Text>
                </View>

                {/* Actions */}
                {actions.map((action, index) => (
                  <Animated.View
                    key={action.id}
                    entering={FadeIn.delay(index * 50).duration(150)}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionRow,
                        {
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm + 2,
                          backgroundColor: pressed
                            ? dark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)'
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleActionPress(action)}
                    >
                      <Ionicons
                        name={action.icon}
                        size={20}
                        color={dark ? 'rgba(196, 162, 101, 1)' : 'rgba(184, 148, 79, 1)'}
                      />
                      <Text
                        style={[
                          styles.actionLabel,
                          { color: colors.text, marginLeft: spacing.sm },
                        ]}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    opacity: 0.6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    minWidth: PILL_MIN_WIDTH,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  pillEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  expandedCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
  },
  expandedTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
