import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { SwipeableRow, type SwipeAction } from '../ui/SwipeableRow';
import { lightImpact } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

export interface FriendRowProps {
  friend: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    workoutsPerWeek?: number;
    streak?: number;
  };
  onPress: () => void;
  onChallenge: () => void;
  onRemove: () => void;
}

// ── Constants ──────────────────────────────────────────────────────

const AVATAR_SIZE = 40;

// ── Component ──────────────────────────────────────────────────────

export const FriendRow = React.memo(function FriendRow({
  friend,
  onPress,
  onChallenge,
  onRemove,
}: FriendRowProps) {
  const { colors, typography, spacing, radius, dark } = useTheme();

  const leftAction = useMemo<SwipeAction>(
    () => ({
      label: 'Remove',
      icon: 'person-remove-outline',
      color: colors.error,
      onTrigger: onRemove,
    }),
    [colors.error, onRemove],
  );

  const rightAction = useMemo<SwipeAction>(
    () => ({
      label: 'Challenge',
      icon: 'trophy-outline',
      color: colors.gold,
      onTrigger: onChallenge,
    }),
    [colors.gold, onChallenge],
  );

  return (
    <SwipeableRow leftAction={leftAction} rightAction={rightAction}>
      <Pressable
        onPress={() => {
          lightImpact();
          onPress();
        }}
        style={[
          styles.row,
          {
            backgroundColor: colors.surface,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.base,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${friend.displayName}${friend.streak ? `, ${friend.streak} day streak` : ''}`}
      >
        {/* Avatar */}
        {friend.avatarUrl ? (
          <Image
            source={{ uri: friend.avatarUrl }}
            style={[styles.avatar, { borderRadius: AVATAR_SIZE / 2 }]}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              {
                borderRadius: AVATAR_SIZE / 2,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name="person" size={20} color={colors.textTertiary} />
          </View>
        )}

        {/* Name + subtitle */}
        <View style={[styles.info, { marginLeft: spacing.md }]}>
          <Text
            style={[typography.label, { color: colors.text }]}
            numberOfLines={1}
          >
            {friend.displayName}
          </Text>
          {friend.workoutsPerWeek != null && (
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              {friend.workoutsPerWeek} workouts/wk
            </Text>
          )}
        </View>

        {/* Streak badge */}
        {friend.streak != null && friend.streak > 0 && (
          <View
            style={[
              styles.streakBadge,
              {
                backgroundColor: dark ? 'rgba(207, 174, 128, 0.15)' : 'rgba(184, 148, 79, 0.12)',
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Text style={[typography.labelSmall, { color: colors.gold }]}>
              🔥{friend.streak}
            </Text>
          </View>
        )}
      </Pressable>
    </SwipeableRow>
  );
});

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  info: {
    flex: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
