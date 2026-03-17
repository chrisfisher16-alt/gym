import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface CoachAvatarProps {
  size?: number;
}

export function CoachAvatar({ size = 36 }: CoachAvatarProps) {
  const { colors, radius } = useTheme();
  const iconSize = Math.round(size * 0.5);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: colors.primaryMuted,
        },
      ]}
    >
      <Ionicons name="fitness" size={iconSize} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
