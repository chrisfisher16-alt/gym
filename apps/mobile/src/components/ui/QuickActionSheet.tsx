import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { mediumImpact, lightImpact } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  /** Ionicons name */
  icon: string;
  onPress: () => void;
  /** Red text/icon for delete actions */
  destructive?: boolean;
  /** Small pill next to label — "AI", "Pro", "New" */
  badge?: string;
  disabled?: boolean;
}

export interface QuickActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: QuickAction[];
  /** Optional preview card rendered at top of sheet */
  preview?: React.ReactNode;
}

// ── Constants ──────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 0.3;
const SPRING_CONFIG = { damping: 20, stiffness: 150 };

// ── Component ──────────────────────────────────────────────────────

export function QuickActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
  preview,
}: QuickActionSheetProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = useSharedValue(400); // measured on layout
  const context = useSharedValue(0);

  // ── Open / Close animations ────────────────────────────────────

  const open = useCallback(() => {
    mediumImpact();
    translateY.value = withSpring(0, SPRING_CONFIG);
    backdropOpacity.value = withTiming(0.5, { duration: 200 });
  }, [translateY, backdropOpacity]);

  const close = useCallback(() => {
    translateY.value = withSpring(SCREEN_HEIGHT, {
      ...SPRING_CONFIG,
      stiffness: 200,
    });
    backdropOpacity.value = withTiming(0, { duration: 150 });
  }, [translateY, backdropOpacity]);

  useEffect(() => {
    if (visible) {
      // Reset to off-screen before animating in
      translateY.value = SCREEN_HEIGHT;
      open();
    } else {
      close();
    }
  }, [visible, open, close, translateY]);

  // ── Swipe-to-dismiss gesture ───────────────────────────────────

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((e) => {
      // Only allow downward dragging (positive translationY)
      translateY.value = Math.max(context.value + e.translationY, 0);
    })
    .onEnd((e) => {
      const pastThreshold = translateY.value > sheetHeight.value * DISMISS_THRESHOLD;
      const flicked = e.velocityY > 500;

      if (pastThreshold || flicked) {
        translateY.value = withSpring(SCREEN_HEIGHT, {
          ...SPRING_CONFIG,
          stiffness: 200,
          velocity: e.velocityY,
        });
        backdropOpacity.value = withTiming(0, { duration: 150 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // ── Animated styles ────────────────────────────────────────────

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // ── Action row press handler ───────────────────────────────────

  const handleActionPress = useCallback(
    (action: QuickAction) => {
      if (action.disabled) return;
      lightImpact();
      action.onPress();
      onClose();
    },
    [onClose],
  );

  // ── Badge variant color ────────────────────────────────────────

  const getBadgeColors = useCallback(
    (badge: string) => {
      switch (badge) {
        case 'AI':
          return { bg: colors.infoLight, text: colors.info };
        case 'Pro':
          return { bg: colors.primaryMuted, text: colors.primary };
        default:
          return { bg: colors.successLight, text: colors.success };
      }
    },
    [colors],
  );

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000' },
              backdropStyle,
            ]}
          />
        </Pressable>

        {/* Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            onLayout={(e) => {
              sheetHeight.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.sheet,
              sheetStyle,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                shadowColor: colors.shadow,
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: colors.textTertiary }]}
              />
            </View>

            {/* Header */}
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text style={[typography.h3, { color: colors.text }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginTop: spacing.xs },
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {/* Preview card */}
            {preview ? (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
                {preview}
              </View>
            ) : null}

            {/* Actions */}
            <View
              style={{
                marginTop: spacing.base,
                marginHorizontal: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
              }}
            >
              {actions.map((action, index) => {
                const isDestructive = action.destructive === true;
                const iconColor = isDestructive
                  ? colors.error
                  : action.disabled
                    ? colors.disabledText
                    : colors.text;
                const labelColor = isDestructive
                  ? colors.error
                  : action.disabled
                    ? colors.disabledText
                    : colors.text;

                return (
                  <React.Fragment key={action.id}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.separator,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                    <Pressable
                      onPress={() => handleActionPress(action)}
                      disabled={action.disabled}
                      style={({ pressed }) => [
                        styles.actionRow,
                        {
                          paddingHorizontal: spacing.base,
                          paddingVertical: spacing.md,
                          opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={action.icon as keyof typeof Ionicons.glyphMap}
                        size={24}
                        color={iconColor}
                        style={{ marginRight: spacing.md }}
                      />
                      <Text
                        style={[
                          typography.label,
                          { color: labelColor, flex: 1 },
                        ]}
                      >
                        {action.label}
                      </Text>
                      {action.badge ? (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: getBadgeColors(action.badge).bg,
                              borderRadius: radius.full,
                              paddingHorizontal: spacing.sm,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              typography.caption,
                              {
                                color: getBadgeColors(action.badge).text,
                                fontWeight: '600',
                              },
                            ]}
                          >
                            {action.badge}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Cancel button */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  marginTop: spacing.md,
                  marginHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: spacing.md,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary, textAlign: 'center' },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52, // icon (24) + marginRight (12) + padding (16)
  },
  badge: {
    paddingVertical: 2,
  },
  cancelButton: {
    alignItems: 'center',
  },
});
