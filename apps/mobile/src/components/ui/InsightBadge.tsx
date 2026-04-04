import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { Insight } from '../../lib/insight-engine';

interface InsightBadgeProps {
  insight: Insight;
  onAskMore?: () => void;
}

export function InsightBadge({ insight, onAskMore }: InsightBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Ionicons
        name="bulb-outline"
        size={14}
        color={colors.gold}
        style={{ marginRight: spacing.sm, marginTop: 1 }}
      />
      <Text
        style={[
          typography.bodySmall,
          {
            color: colors.textSecondary,
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
          },
        ]}
        numberOfLines={2}
      >
        {insight.message}
      </Text>
      {onAskMore && insight.coachPrompt && (
        <TouchableOpacity
          onPress={onAskMore}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={{ marginLeft: spacing.sm }}
        >
          <Text
            style={[
              typography.labelSmall,
              { color: colors.gold, fontSize: 12 },
            ]}
          >
            Ask more…
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
