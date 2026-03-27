import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useCoachStore } from '../stores/coach-store';
import { useCoachSheet } from '../providers/CoachSheetProvider';
import type { CoachContext } from '@health-coach/shared';

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

const TOOLTIP_TEXT: Record<string, string> = {
  workout: 'Need help with your workout?',
  nutrition: 'Questions about your meals?',
  progress: "Let's review your progress",
  onboarding: 'I can help you get set up',
  general: 'Ask your coach anything',
};

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

const TOOLTIP_DURATION = 3_000;

// Track which contexts have already shown a tooltip this session
const shownTooltips = new Set<string>();

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

  // Tooltip state (floating FAB only)
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const [showTooltip, setShowTooltip] = useState(false);

  // Quick-prompts popover (floating FAB only)
  const [promptsVisible, setPromptsVisible] = useState(false);

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
  // Tooltip auto-show on mount (once per context per session)
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Only for the floating (unlabeled) variant
    if (label || hidden) return;

    const key = context;
    if (shownTooltips.has(key)) return;
    shownTooltips.add(key);

    setShowTooltip(true);
    Animated.timing(tooltipOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowTooltip(false));
    }, TOOLTIP_DURATION);

    return () => clearTimeout(timer);
  }, [context, label, hidden, tooltipOpacity]);

  // -----------------------------------------------------------------------
  // Hidden state
  // -----------------------------------------------------------------------

  if (hidden) return null;

  // -----------------------------------------------------------------------
  // Labeled pill (inline usage) — simple, no tooltip / long-press
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
  // Floating circular FAB with tooltip + long-press quick prompts
  // -----------------------------------------------------------------------

  const tooltipMessage = TOOLTIP_TEXT[context] ?? TOOLTIP_TEXT.general;
  const prompts = QUICK_PROMPTS[context] ?? QUICK_PROMPTS.general;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Tooltip bubble */}
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              opacity: tooltipOpacity,
            },
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.text }]}>
            {tooltipMessage}
          </Text>
          {/* little caret pointing right toward the FAB */}
          <View
            style={[
              styles.tooltipCaret,
              { borderLeftColor: colors.surface },
            ]}
          />
        </Animated.View>
      )}

      {/* FAB button */}
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.8}
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
      </TouchableOpacity>

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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    alignItems: 'flex-end',
  },
  fab: {
    width: 56,
    height: 56,
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

  // Tooltip
  tooltip: {
    position: 'absolute',
    bottom: 12,
    right: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: 200,
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tooltipCaret: {
    position: 'absolute',
    right: -8,
    top: '50%',
    marginTop: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },

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
