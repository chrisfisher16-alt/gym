import React, { useCallback } from 'react';
import { View, StyleSheet, type ViewStyle, type LayoutChangeEvent, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

// ── SkeletonBlock ────────────────────────────────────────────────────

interface SkeletonBlockProps {
  /** Width of the skeleton block — defaults to '100%' */
  width?: DimensionValue;
  /** Height of the skeleton block — defaults to 16 */
  height?: number;
  /** Border radius — defaults to 4 */
  borderRadius?: number;
  /** Additional styles */
  style?: ViewStyle;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * A single skeleton placeholder block with a shimmer animation.
 * Composable primitive used inside pre-composed skeleton layouts.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonBlockProps) {
  const { colors, dark } = useTheme();
  const blockWidth = useSharedValue(0);
  const translateX = useSharedValue(-300);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      blockWidth.value = w;
      // Start shimmer: sweep from -width to +width
      translateX.value = -w;
      translateX.value = withRepeat(
        withTiming(w, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1, // infinite
        false,
      );
    },
    [blockWidth, translateX],
  );

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bgColor = dark ? '#252525' : '#F0EEE9';
  const shimmerColors: [string, string, string] = dark
    ? ['transparent', 'rgba(196, 162, 101, 0.08)', 'transparent']
    : ['transparent', 'rgba(255, 255, 255, 0.6)', 'transparent'];

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: bgColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={shimmerColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          StyleSheet.absoluteFill,
          { width: '100%', height: '100%' },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

// ── SkeletonCard ─────────────────────────────────────────────────────

interface SkeletonCardProps {
  /** Number of text-like rows to show */
  rows?: number;
  /** Whether to show a circular avatar placeholder */
  showAvatar?: boolean;
  /** Whether to show a large image placeholder at the top */
  hasImage?: boolean;
  /** Overall height of the card (auto if not set) */
  height?: number;
  /** Custom style */
  style?: ViewStyle;
}

const ROW_WIDTHS: DimensionValue[] = ['100%', '85%', '70%', '90%', '60%'];

/**
 * A pre-composed skeleton loading card with shimmer animation.
 * Use instead of spinners for content-shaped loading placeholders.
 */
export function SkeletonCard({
  rows = 3,
  showAvatar = false,
  hasImage = false,
  height,
  style,
}: SkeletonCardProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: 1,
          borderColor: colors.borderLight,
          height,
        },
        style,
      ]}
    >
      {hasImage && (
        <SkeletonBlock
          width="100%"
          height={140}
          borderRadius={radius.md}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {showAvatar && (
        <View style={styles.headerRow}>
          <SkeletonBlock
            width={40}
            height={40}
            borderRadius={20}
          />
          <View style={styles.headerText}>
            <SkeletonBlock
              width="60%"
              height={14}
              borderRadius={radius.sm}
              style={{ marginBottom: spacing.xs }}
            />
            <SkeletonBlock
              width="40%"
              height={10}
              borderRadius={radius.sm}
            />
          </View>
        </View>
      )}

      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={ROW_WIDTHS[i % ROW_WIDTHS.length]}
          height={i === 0 ? 16 : 12}
          borderRadius={radius.sm}
          style={{
            marginTop: i === 0 && showAvatar ? spacing.md : i === 0 ? 0 : spacing.sm,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
});
