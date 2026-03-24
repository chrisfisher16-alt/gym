import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface GainPillProps {
  value: number;
  suffix?: string;
}

export function GainPill({ value, suffix = '%' }: GainPillProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isPositive = value >= 0;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${isPositive ? 'Up' : 'Down'} ${Math.abs(value)}${suffix}`}
      style={[styles.pill, {
        backgroundColor: isPositive ? colors.successLight : colors.errorLight,
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }]}
    >
      <Text style={[typography.caption, {
        color: isPositive ? colors.success : colors.error,
        fontWeight: '700',
      }]}>
        {isPositive ? '↑' : '↓'} {Math.abs(value)}{suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
  },
});
