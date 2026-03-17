import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface SkeletonCardProps {
  /** Number of text-like rows to show */
  rows?: number;
  /** Whether to show a circular avatar placeholder */
  showAvatar?: boolean;
  /** Overall height of the card (auto if not set) */
  height?: number;
  /** Custom style */
  style?: object;
}

/**
 * A skeleton loading card with a shimmer animation.
 * Use instead of spinners for content-shaped loading placeholders.
 */
export function SkeletonCard({ rows = 3, showAvatar = false, height, style }: SkeletonCardProps) {
  const { colors, spacing, radius } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const shimmerStyle = { opacity };

  const ROW_WIDTHS: (`${number}%`)[] = ['100%', '85%', '70%', '90%', '60%'];

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
      {showAvatar && (
        <View style={styles.headerRow}>
          <Animated.View
            style={[
              styles.avatar,
              shimmerStyle,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          />
          <View style={styles.headerText}>
            <Animated.View
              style={[
                styles.row,
                shimmerStyle,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.sm,
                  width: '60%',
                  height: 14,
                  marginBottom: spacing.xs,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.row,
                shimmerStyle,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.sm,
                  width: '40%',
                  height: 10,
                },
              ]}
            />
          </View>
        </View>
      )}

      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.row,
            shimmerStyle,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.sm,
              width: ROW_WIDTHS[i % ROW_WIDTHS.length],
              height: i === 0 ? 16 : 12,
              marginTop: i === 0 && showAvatar ? spacing.md : i === 0 ? 0 : spacing.sm,
            },
          ]}
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  row: {},
});
