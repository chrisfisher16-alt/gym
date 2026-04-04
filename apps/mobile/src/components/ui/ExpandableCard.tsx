import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { lightImpact, selectionFeedback } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

interface ExpandableCardProps {
  /** Collapsed content (always visible) */
  children: React.ReactNode;
  /** Content that appears on expand */
  expandedContent: React.ReactNode;
  /** Callback fired when the card expands */
  onExpand?: () => void;
  /** Callback fired when the card collapses */
  onCollapse?: () => void;
  /** Callback fired on long press of the header */
  onLongPress?: () => void;
  /** Expand direction – inline or bottom-sheet style (future) */
  expandDirection?: 'down' | 'modal';
  /** Trigger haptic feedback on expand/collapse (default true) */
  hapticFeedback?: boolean;
  /** Disable expand/collapse interaction */
  disabled?: boolean;
  /** Start the card in expanded state */
  initiallyExpanded?: boolean;
  /** Container style override */
  style?: StyleProp<ViewStyle>;
}

// ── Spring config for a ~300ms feel ────────────────────────────────

const EXPAND_SPRING = {
  damping: 20,
  stiffness: 180,
  mass: 0.8,
} as const;

// ── Component ──────────────────────────────────────────────────────

export function ExpandableCard({
  children,
  expandedContent,
  onExpand,
  onCollapse,
  expandDirection: _expandDirection = 'down',
  hapticFeedback = true,
  disabled = false,
  initiallyExpanded = false,
  onLongPress,
  style,
}: ExpandableCardProps) {
  const { colors, spacing, radius, dark } = useTheme();

  // ── State ──────────────────────────────────────────────────────

  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [hasExpanded, setHasExpanded] = useState(initiallyExpanded);
  const [contentHeight, setContentHeight] = useState(0);

  // ── Shared values ──────────────────────────────────────────────

  const heightProgress = useSharedValue(initiallyExpanded ? 1 : 0);
  const scale = useSharedValue(1);
  const contentOpacity = useSharedValue(initiallyExpanded ? 1 : 0);
  const shimmerTranslate = useSharedValue(-1);

  // ── Measure expanded content ───────────────────────────────────

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      setContentHeight(h);

      // If already expanded and this is the first measurement, animate now
      if (expanded && h > 0) {
        heightProgress.value = withSpring(1, EXPAND_SPRING);
        contentOpacity.value = withTiming(1, { duration: 200 });
      }
    }
  }, [expanded, heightProgress, contentOpacity]);

  // ── Toggle ─────────────────────────────────────────────────────

  const toggle = useCallback(() => {
    if (disabled) return;

    const willExpand = !expanded;

    if (willExpand && contentHeight === 0) {
      // Content not measured yet — expand without animation, animation will happen on next toggle
      if (!hasExpanded) setHasExpanded(true);
      setExpanded(true);
      onExpand?.();
      return;
    }

    // Scale pulse on tap
    scale.value = withSequence(
      withTiming(0.98, { duration: 75 }),
      withTiming(1.0, { duration: 75 }),
    );

    if (willExpand) {
      // Lazy mount: mark as expanded at least once
      if (!hasExpanded) setHasExpanded(true);

      setExpanded(true);
      heightProgress.value = withSpring(1, EXPAND_SPRING);
      contentOpacity.value = withTiming(1, { duration: 200 });

      // Gold shimmer sweep — reset to start, then animate across
      cancelAnimation(shimmerTranslate);
      shimmerTranslate.value = -1;
      shimmerTranslate.value = withTiming(2, { duration: 400 });

      if (hapticFeedback) selectionFeedback();
      onExpand?.();
    } else {
      setExpanded(false);
      heightProgress.value = withSpring(0, EXPAND_SPRING);
      contentOpacity.value = withTiming(0, { duration: 150 });

      if (hapticFeedback) lightImpact();
      onCollapse?.();
    }
  }, [
    disabled,
    expanded,
    contentHeight,
    hasExpanded,
    hapticFeedback,
    onExpand,
    onCollapse,
    heightProgress,
    scale,
    contentOpacity,
    shimmerTranslate,
  ]);

  // ── Animated styles ────────────────────────────────────────────

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const expandStyle = useAnimatedStyle(() => ({
    height: interpolate(heightProgress.value, [0, 1], [0, contentHeight || 1]),
    opacity: contentOpacity.value,
    overflow: 'hidden' as const,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerTranslate.value, [-1, 2], [-300, 300]) }],
    opacity: interpolate(shimmerTranslate.value, [-1, 0, 1.5, 2], [0, 0.6, 0.6, 0]),
  }));



  // ── Render ─────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
          shadowColor: colors.shadow,
          ...(dark
            ? {}
            : {
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }),
        },
        style,
      ]}
    >
    <Animated.View style={scaleStyle}>
      {/* Tappable header area */}
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Collapse card' : 'Expand card'}
        style={{ padding: spacing.base }}
      >
        {children}

        {/* Gold shimmer overlay – sits inside the header */}
        <View style={[StyleSheet.absoluteFill, styles.shimmerContainer]} pointerEvents="none">
          <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', colors.gold, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded content – lazy mounted */}
      {hasExpanded && (
        <Animated.View style={expandStyle}>
          <Pressable onPress={toggle} onLayout={handleContentLayout} style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.base }}>
            {expandedContent}
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  shimmerContainer: {
    overflow: 'hidden',
    borderRadius: 14, // matches radius.lg
  },
  shimmerStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    opacity: 0.5,
  },
});
