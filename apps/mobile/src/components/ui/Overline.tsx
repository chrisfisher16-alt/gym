import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme';

interface OverlineProps {
  children: string;
  style?: StyleProp<TextStyle>;
  color?: string;
}

export function Overline({ children, style, color }: OverlineProps) {
  const { colors, typography } = useTheme();
  return (
    <Text style={[typography.overline, { color: color ?? colors.primary }, style]}>
      {children}
    </Text>
  );
}
