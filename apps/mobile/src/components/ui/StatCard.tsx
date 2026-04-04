import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Overline } from './Overline';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  children?: React.ReactNode;
  /** Animate the value counting up from 0 on first appearance */
  animated?: boolean;
}

export function StatCard({ label, value, unit, children, animated = true }: StatCardProps) {
  const { colors, spacing, radius, typography, dark } = useTheme();

  const numericValue = parseFloat(value.replace(/,/g, ''));
  const canAnimate = animated && !isNaN(numericValue) && isFinite(numericValue);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={[styles.card, {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.border,
        ...(dark ? {} : { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }),
      }]}
    >
      {canAnimate ? (
        <AnimatedNumber
          value={numericValue}
          style={[typography.statValue, { color: colors.text, textAlign: 'center' }]}
        />
      ) : (
        <Text style={[typography.statValue, { color: colors.text, textAlign: 'center' }]}>
          {value}
        </Text>
      )}
      {unit && (
        <Text style={[typography.statUnit, { color: colors.textTertiary, textAlign: 'center', marginTop: 2 }]}>
          {unit}
        </Text>
      )}
      <Overline style={{ textAlign: 'center', marginTop: spacing.xs, ...typography.micro }}>{label}</Overline>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
