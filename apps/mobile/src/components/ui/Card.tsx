import React from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  variant?: 'default' | 'hero' | 'elevated' | string;
  onPress?: () => void;
  onLongPress?: () => void;
  pressable?: boolean;
}

const SPRING_CONFIG = { damping: 10, stiffness: 400 };

export function Card({
  children,
  style,
  padded = true,
  variant = 'default',
  onPress,
  onLongPress,
  pressable = false,
}: CardProps) {
  const { colors, spacing, radius } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyle = variant === 'hero'
    ? { borderColor: colors.primary, borderWidth: 1.5 }
    : variant === 'elevated'
      ? { elevation: 6, shadowOpacity: 1, shadowRadius: 12 }
      : {};

  const baseStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: padded ? spacing.base : 0,
    shadowColor: colors.shadow,
    borderColor: colors.borderLight,
  };

  if (pressable && onPress) {
    const flatCustom = StyleSheet.flatten(style);
    const merged = Object.assign(
      {},
      styles.card,
      baseStyle,
      variantStyle,
      flatCustom,
    ) as Record<string, unknown>;
    return (
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98, SPRING_CONFIG); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_CONFIG); }}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Animated.View style={[merged, animatedStyle]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, baseStyle, variantStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
});
