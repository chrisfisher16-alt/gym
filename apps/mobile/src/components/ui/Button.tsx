import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();

  const heights: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
  const fontSizes: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

  const bgColors: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceSecondary,
    ghost: 'transparent',
    danger: colors.error,
  };

  const textColors: Record<ButtonVariant, string> = {
    primary: colors.textInverse,
    secondary: colors.text,
    ghost: colors.primary,
    danger: colors.textInverse,
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          height: heights[size],
          backgroundColor: bgColors[variant],
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? 0.5 : 1,
        },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        variant === 'ghost' && { paddingHorizontal: spacing.base },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: textColors[variant],
                fontSize: fontSizes[size],
                fontWeight: '600',
                marginLeft: icon ? spacing.sm : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    textAlign: 'center',
  },
});
