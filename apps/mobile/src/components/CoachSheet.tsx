import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useCoachSheet } from '../providers/CoachSheetProvider';
import { useCoachStore } from '../stores/coach-store';
import { CoachChatUI } from './CoachChatUI';
import { CoachAvatar } from './coach/CoachAvatar';
import { lightImpact } from '../lib/haptics';

// ── Spring config (matches existing feel) ────────────────────────────
const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 0.8 };

// ── Context-aware quick prompts ──────────────────────────────────────
const QUICK_PROMPTS: Record<string, { text: string; icon: string }[]> = {
  workout: [
    { text: 'Suggest a workout for today', icon: 'barbell-outline' },
    { text: 'How should I warm up?', icon: 'flame-outline' },
    { text: 'Am I overtraining?', icon: 'alert-circle-outline' },
  ],
  nutrition: [
    { text: 'What should I eat post-workout?', icon: 'restaurant-outline' },
    { text: 'Help me hit my protein goal', icon: 'nutrition-outline' },
    { text: 'Quick healthy snack ideas', icon: 'cafe-outline' },
  ],
  progress: [
    { text: 'Summarize my week', icon: 'calendar-outline' },
    { text: 'Am I on track for my goal?', icon: 'trending-up-outline' },
    { text: 'What should I focus on next?', icon: 'bulb-outline' },
  ],
  general: [
    { text: 'Give me a motivation boost', icon: 'flash-outline' },
    { text: 'What should I work on today?', icon: 'today-outline' },
    { text: 'Help me build a routine', icon: 'repeat-outline' },
  ],
};

// ── Component ────────────────────────────────────────────────────────

export function CoachSheet() {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();
  const { isOpen, close } = useCoachSheet();

  // Coach store — read context for prompt selection & messages for auto-expand
  const prefilledContext = useCoachStore((s) => s.prefilledContext);
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);
  const messages = useCoachStore((s) => s.messages);
  const activeConversation = useCoachStore((s) => s.activeConversation);

  const currentMessages = activeConversation
    ? messages.filter((m) => m.conversation_id === activeConversation.id)
    : [];

  const hasMessages = currentMessages.length > 0;

  // Determine context key for quick prompts
  const contextKey = typeof prefilledContext === 'string' ? prefilledContext : 'general';
  const prompts = QUICK_PROMPTS[contextKey] ?? QUICK_PROMPTS.general;

  // ── Snap points (Y positions from TOP of screen) ─────────────────
  const FULL_SNAP = insets.top + 10; // ~95% visible
  const EXPANDED_SNAP = screenHeight * 0.35; // ~65% visible
  const COMPACT_SNAP = screenHeight * 0.65; // ~35% visible
  const CLOSED_SNAP = screenHeight + 50; // off-screen

  const translateY = useSharedValue(CLOSED_SNAP);
  const backdropOpacity = useSharedValue(0);
  const currentSnap = useSharedValue(CLOSED_SNAP);

  // ── Open / close ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // If there are already messages, open at expanded; otherwise compact
      const target = hasMessages ? EXPANDED_SNAP : COMPACT_SNAP;
      translateY.value = withSpring(target, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 250 });
      currentSnap.value = target;
    } else {
      translateY.value = withSpring(CLOSED_SNAP, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 200 });
      currentSnap.value = CLOSED_SNAP;
    }
  }, [
    isOpen,
    hasMessages,
    EXPANDED_SNAP,
    COMPACT_SNAP,
    CLOSED_SNAP,
    translateY,
    backdropOpacity,
    currentSnap,
  ]);

  // ── Auto-expand when first message is sent ────────────────────────
  const expandToExpanded = useCallback(() => {
    translateY.value = withSpring(EXPANDED_SNAP, SPRING_CONFIG);
    currentSnap.value = EXPANDED_SNAP;
    lightImpact();
  }, [EXPANDED_SNAP, translateY, currentSnap]);

  const handleMessageSent = useCallback(() => {
    // Only auto-expand if we're currently at compact
    if (currentSnap.value === COMPACT_SNAP) {
      expandToExpanded();
    }
  }, [COMPACT_SNAP, currentSnap, expandToExpanded]);

  // ── Quick prompt tap ──────────────────────────────────────────────
  const handlePromptTap = useCallback(
    (promptText: string) => {
      lightImpact();
      // Set as prefilled message so CoachChatUI picks it up and sends
      setPrefilledContext(contextKey as any, promptText);
      // Expand sheet
      expandToExpanded();
    },
    [contextKey, setPrefilledContext, expandToExpanded],
  );

  // ── Pan gesture (handle + title area ONLY) ────────────────────────
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

      // Snap to nearest of 3 points (or dismiss)
      const midCompactExpanded = (COMPACT_SNAP + EXPANDED_SNAP) / 2;
      const midExpandedFull = (EXPANDED_SNAP + FULL_SNAP) / 2;
      const dismissThreshold = COMPACT_SNAP + (CLOSED_SNAP - COMPACT_SNAP) * 0.3;

      if (currentY > dismissThreshold) {
        // Dismiss
        translateY.value = withSpring(CLOSED_SNAP, SPRING_CONFIG);
        backdropOpacity.value = withTiming(0, { duration: 200 });
        currentSnap.value = CLOSED_SNAP;
        runOnJS(close)();
      } else if (currentY > midCompactExpanded) {
        // Snap to compact
        translateY.value = withSpring(COMPACT_SNAP, SPRING_CONFIG);
        currentSnap.value = COMPACT_SNAP;
      } else if (currentY > midExpandedFull) {
        // Snap to expanded
        translateY.value = withSpring(EXPANDED_SNAP, SPRING_CONFIG);
        currentSnap.value = EXPANDED_SNAP;
      } else {
        // Snap to full
        translateY.value = withSpring(FULL_SNAP, SPRING_CONFIG);
        currentSnap.value = FULL_SNAP;
        runOnJS(lightImpact)();
      }
    });

  // ── Derived: is sheet in compact position ─────────────────────────
  // We use a JS-side approximation for rendering decisions.
  // The animated value drives the actual layout.
  const isCompact = !hasMessages && isOpen;

  // Visible height in compact mode (for constraining the chat container)
  const HEADER_HEIGHT = 70; // handle (~16) + title row (~44) + padding
  const PROMPTS_HEIGHT = 56; // prompt pills + padding
  const compactVisibleHeight = screenHeight - COMPACT_SNAP;
  const compactChatHeight = Math.max(80, compactVisibleHeight - HEADER_HEIGHT - PROMPTS_HEIGHT);

  // ── Animated styles ───────────────────────────────────────────────
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
      {/* Backdrop */}
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
        {/* ── Draggable header area (handle + title) ── */}
        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={styles.dragArea} collapsable={false}>
            {/* Drag handle */}
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Title row */}
            <View
              style={[
                styles.titleRow,
                { paddingHorizontal: spacing.base },
              ]}
            >
              <View style={styles.titleLeft}>
                <CoachAvatar size={24} />
                <Text
                  style={[
                    typography.label,
                    {
                      color: colors.text,
                      marginLeft: spacing.sm,
                      fontSize: 15,
                      fontWeight: '600',
                    },
                  ]}
                >
                  AI Coach
                </Text>
              </View>
              <TouchableOpacity
                onPress={close}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        </GestureDetector>

        {/* ── Quick prompts (compact view, no messages) ── */}
        {isCompact && (
          <View style={[styles.promptsContainer, { paddingHorizontal: spacing.base }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promptsScroll}
            >
              {prompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt.text}
                  onPress={() => handlePromptTap(prompt.text)}
                  activeOpacity={0.7}
                  style={[
                    styles.promptChip,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.xl,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name={prompt.icon as any}
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.text, fontWeight: '500' },
                    ]}
                    numberOfLines={1}
                  >
                    {prompt.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Chat UI (always mounted to preserve conversation) ── */}
        <View style={isCompact ? { height: compactChatHeight } : styles.chatContainer}>
          <CoachChatUI
            keyboardVerticalOffset={0}
            showHeader={false}
            compactMode={isCompact}
            onMessageSent={handleMessageSent}
          />
        </View>
      </Reanimated.View>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

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
  dragArea: {
    // Only this area responds to drag gestures
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptsContainer: {
    paddingBottom: 8,
  },
  promptsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
  },
});
