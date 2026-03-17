import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { ProgressBar } from './ProgressBar';

interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color: string;
  style?: ViewStyle;
}

export function MacroBar({
  label,
  current,
  target,
  unit = 'g',
  color,
  style,
}: MacroBarProps) {
  const { colors, spacing, typography } = useTheme();
  const progress = target > 0 ? current / target : 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {Math.round(current)}/{target}{unit}
        </Text>
      </View>
      <ProgressBar
        progress={progress}
        color={color}
        height={8}
        style={{ marginTop: spacing.xs }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
