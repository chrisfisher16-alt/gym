import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  variant?: 'default' | 'hero' | 'elevated' | string;
}

export function Card({ children, style, padded = true, variant = 'default' }: CardProps) {
  const { colors, spacing, radius } = useTheme();

  const variantStyle: ViewStyle = variant === 'hero'
    ? { borderColor: colors.primary, borderWidth: 1.5 }
    : variant === 'elevated'
      ? { elevation: 6, shadowOpacity: 1, shadowRadius: 12 }
      : {};

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.base : 0,
          shadowColor: colors.shadow,
          borderColor: colors.borderLight,
        },
        variantStyle,
        style,
      ]}
    >
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
