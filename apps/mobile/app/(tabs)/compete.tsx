import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';

export default function CompeteTab() {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl, paddingHorizontal: spacing.base }}>
      <Animated.View entering={FadeIn.duration(200)}>
        <Text style={[typography.h1, { color: colors.text }]}>Compete</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Coming soon — compete with friends
        </Text>
      </Animated.View>
    </View>
  );
}
