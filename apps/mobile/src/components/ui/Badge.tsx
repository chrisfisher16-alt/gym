import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'pro';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const bgColors: Record<BadgeVariant, string> = {
    default: colors.surfaceSecondary,
    success: colors.successLight,
    warning: colors.warningLight,
    error: colors.errorLight,
    info: colors.infoLight,
    pro: colors.primaryMuted,
  };

  const textColors: Record<BadgeVariant, string> = {
    default: colors.textSecondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    pro: colors.primary,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColors[variant],
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
      ]}
    >
      <Text style={[typography.caption, { color: textColors[variant], fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
});
