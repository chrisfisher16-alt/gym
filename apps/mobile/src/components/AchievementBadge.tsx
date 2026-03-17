import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import type { Achievement } from '../lib/achievements';

interface AchievementBadgeProps {
  achievement: Achievement;
  earned: boolean;
  earnedDate?: string;
  progressHint?: string;
  size?: 'sm' | 'md';
}

export function AchievementBadge({
  achievement,
  earned,
  earnedDate,
  progressHint,
  size = 'md',
}: AchievementBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const iconSize = size === 'sm' ? 24 : 32;
  const containerSize = size === 'sm' ? 56 : 72;

  const categoryColors: Record<string, string> = {
    workout: colors.primary,
    nutrition: colors.success,
    streak: colors.warning,
    milestone: colors.info,
  };

  const accentColor = categoryColors[achievement.category] ?? colors.primary;

  return (
    <View style={[styles.container, { width: size === 'sm' ? 80 : 96 }]}>
      <View
        style={[
          styles.iconContainer,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: earned ? accentColor + '20' : colors.surfaceSecondary,
            borderWidth: earned ? 2 : 1,
            borderColor: earned ? accentColor : colors.border,
          },
        ]}
      >
        <Ionicons
          name={achievement.icon as any}
          size={iconSize}
          color={earned ? accentColor : colors.textTertiary}
        />
      </View>
      <Text
        style={[
          size === 'sm' ? typography.caption : typography.labelSmall,
          {
            color: earned ? colors.text : colors.textTertiary,
            textAlign: 'center',
            marginTop: spacing.xs,
          },
        ]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>
      {earned && earnedDate ? (
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, textAlign: 'center', fontSize: 10 },
          ]}
        >
          {new Date(earnedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ) : progressHint ? (
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, textAlign: 'center', fontSize: 10 },
          ]}
          numberOfLines={1}
        >
          {progressHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
