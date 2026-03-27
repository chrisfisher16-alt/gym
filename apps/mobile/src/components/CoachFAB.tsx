import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import ReAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useCoachStore } from '../stores/coach-store';
import { useCoachSheet } from '../providers/CoachSheetProvider';
import type { CoachContext } from '@health-coach/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAB_SIZE = 56;
const EDGE_MARGIN = 16;
const TAB_BAR_HEIGHT = 56;
const DRAG_THRESHOLD = 8; // px moved before we consider it a drag (not a tap)

const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.8 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachFABProps {
  context?: CoachContext;
  label?: string;
  prefilledMessage?: string;
  hidden?: boolean;
}

// ---------------------------------------------------------------------------
// Context-aware copy
// ---------------------------------------------------------------------------

const QUICK_PROMPTS: Record<string, string[]> = {
  workout: [
    'Suggest a workout for today',
    'How should I warm up?',
    'Am I overtraining?',
  ],
  nutrition: [
    'What should I eat post-workout?',
    'Help me hit my protein goal',
    'Quick healthy snack ideas',
  ],
  progress: [
    'Summarize my week',
    'Am I on track for my goal?',
    'What should I focus on next?',
  ],
  general: [
    'Give me a motivation boost',
    'What should I work on today?',
    'Help me build a routine',
  ],
};



// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachFAB({
  context = 'general',
  label,
  prefilledMessage,
  hidden,
}: CoachFABProps) {
  const { colors, radius, spacing } = useTheme();
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);
  const { open } = useCoachSheet();

  // Device-aware dimensions
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Computed safe bounds
  const safeTop = insets.top + 8; // small extra buffer below status bar / notch
  const safeBottom = TAB_BAR_HEIGHT + insets.bottom + EDGE_MARGIN;
  const maxX = screenW - FAB_SIZE - EDGE_MARGIN;
  const maxY = screenH - FAB_SIZE - safeBottom;
  const defaultX = maxX;
  const defaultY = maxY;

  // Quick-prompts popover (floating FAB only)
  const [promptsVisible, setPromptsVisible] = useState(false);

  // -----------------------------------------------------------------------
  // Draggable position (shared values for reanimated)
  // -----------------------------------------------------------------------

  const posX = useSharedValue(defaultX);
  const posY = useSharedValue(defaultY);
  const startX = useSharedValue(defaultX);
  const startY = useSharedValue(defaultY);
  const isDragging = useSharedValue(false);
  const scale = useSharedValue(1);

  // Update default position when dimensions change (e.g. iPad multitasking)
  const prevW = useRef(screenW);
  const prevH = useRef(screenH);
  useEffect(() => {
    if (prevW.current !== screenW || prevH.current !== screenH) {
      // If FAB was at the old default, move it to the new default
      const oldMaxX = prevW.current - FAB_SIZE - EDGE_MARGIN;
      const oldMaxY = prevH.current - FAB_SIZE - safeBottom;
      if (Math.abs(posX.value - oldMaxX) < 2) posX.value = maxX;
      if (Math.abs(posY.value - oldMaxY) < 2) posY.value = maxY;
      prevW.current = screenW;
      prevH.current = screenH;
    }
  }, [screenW, screenH, maxX, maxY, safeBottom, posX, posY]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handlePress = useCallback(() => {
    setPrefilledContext(context, prefilledMessage);
    open();
  }, [context, prefilledMessage, setPrefilledContext, open]);

  const handleLongPress = useCallback(() => {
    setPromptsVisible(true);
  }, []);

  const handlePrompt = useCallback(
    (prompt: string) => {
      setPromptsVisible(false);
      setPrefilledContext(context, prompt);
      open();
    },
    [context, setPrefilledContext, open],
  );

  // -----------------------------------------------------------------------
  // Pan gesture for dragging
  // -----------------------------------------------------------------------

  const panGesture = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onStart(() => {
      startX.value = posX.value;
      startY.value = posY.value;
      isDragging.value = true;
      scale.value = withSpring(1.1, SPRING_CONFIG);
    })
    .onUpdate((e) => {
      const newX = startX.value + e.translationX;
      const newY = startY.value + e.translationY;

      // Clamp within safe screen bounds
      posX.value = Math.max(EDGE_MARGIN, Math.min(newX, maxX));
      posY.value = Math.max(safeTop, Math.min(newY, maxY));
    })
    .onEnd(() => {
      // Snap to nearest horizontal edge
      const midpoint = screenW / 2;
      const snapX =
        posX.value + FAB_SIZE / 2 < midpoint
          ? EDGE_MARGIN
          : maxX;

      posX.value = withSpring(snapX, SPRING_CONFIG);
      scale.value = withSpring(1, SPRING_CONFIG);
      isDragging.value = false;
    });

  // Tap gesture — only fires if drag distance was below threshold
  const tapGesture = Gesture.Tap().onEnd((_e, success) => {
    if (success) {
      runOnJS(handlePress)();
    }
  });

  // Long-press gesture for quick prompts
  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      runOnJS(handleLongPress)();
    });

  // Compose: pan takes priority, then long-press, then tap
  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture),
  );

  // -----------------------------------------------------------------------
  // Animated style
  // -----------------------------------------------------------------------

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
    zIndex: isDragging.value ? 9999 : 999,
  }));

  // -----------------------------------------------------------------------
  // Hidden state
  // -----------------------------------------------------------------------

  if (hidden) return null;

  // -----------------------------------------------------------------------
  // Labeled pill (inline usage) — simple, no tooltip / drag / long-press
  // -----------------------------------------------------------------------

  if (label) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.labeledFab,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.textInverse} />
        <Text
          style={[
            styles.labelText,
            {
              color: colors.textInverse,
              fontSize: 13,
              fontWeight: '600',
              marginLeft: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  // -----------------------------------------------------------------------
  // Floating draggable FAB with tooltip + long-press quick prompts
  // -----------------------------------------------------------------------

  const prompts = QUICK_PROMPTS[context] ?? QUICK_PROMPTS.general;

  return (
    <>
      <GestureDetector gesture={composedGesture}>
        <ReAnimated.View
          style={[styles.draggableContainer, animatedContainerStyle]}
          pointerEvents="box-none"
        >
          {/* FAB button */}
          <View
            style={[
              styles.fab,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.textInverse} />
          </View>
        </ReAnimated.View>
      </GestureDetector>

      {/* Quick-prompts modal */}
      <Modal
        visible={promptsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPromptsVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setPromptsVisible(false)}>
          <View
            style={[
              styles.promptsMenu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
                shadowColor: colors.shadow,
              },
            ]}
          >
            {prompts.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={[
                  styles.promptItem,
                  { borderBottomColor: colors.border },
                ]}
                activeOpacity={0.7}
                onPress={() => handlePrompt(prompt)}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={[styles.promptText, { color: colors.text }]}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  draggableContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB_SIZE,
    alignItems: 'flex-end',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  labeledFab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  labelText: {},

  // Quick-prompts overlay / menu
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 150,
    paddingRight: 20,
  },
  promptsMenu: {
    minWidth: 220,
    maxWidth: 280,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  promptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  promptText: {
    fontSize: 14,
    flex: 1,
  },
});
