import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function IconButton({
  name,
  onPress,
  size = 24,
  color,
  backgroundColor,
  style,
}: IconButtonProps) {
  const { colors, radius } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: backgroundColor ?? colors.surfaceSecondary,
          borderRadius: radius.full,
          width: size + 24,
          height: size + 24,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
});
