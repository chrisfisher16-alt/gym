import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type Typography } from '../../theme';
import { lightImpact } from '../../lib/haptics';
import type { FeedItem } from '../../stores/feed-store';

// ── Types ──────────────────────────────────────────────────────────

export interface ActivityFeedItemProps {
  item: FeedItem;
  onLike: () => void;
  onPress: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const AVATAR_SIZE = 36;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatVolume(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

// ── Content renderers ──────────────────────────────────────────────

function renderContent(
  item: FeedItem,
  textColor: string,
  secondaryColor: string,
  typography: Typography,
): React.ReactNode {
  const meta = item.metadata || {};

  switch (item.type) {
    case 'workout_share': {
      const duration = meta.durationMinutes ? `${meta.durationMinutes} min` : null;
      const volume = meta.totalVolume ? `${formatVolume(meta.totalVolume)} lbs` : null;
      const parts = [duration, volume].filter(Boolean).join(' · ');
      return (
        <Text style={[typography.body, { color: textColor }]}>
          <Text style={{ fontWeight: '600' }}>{item.userDisplayName}</Text>
          {' completed '}
          <Text style={{ fontWeight: '600' }}>"{item.title}"</Text>
          {parts ? ` · ${parts}` : ''}
        </Text>
      );
    }

    case 'pr_share': {
      const exercise = meta.exerciseName ?? 'Exercise';
      const weight = meta.weight ?? '?';
      const reps = meta.reps ?? '?';
      return (
        <Text style={[typography.body, { color: textColor }]}>
          <Text style={{ fontWeight: '600' }}>{item.userDisplayName}</Text>
          {' hit a PR! 🎉 '}
          <Text style={{ color: secondaryColor }}>
            {exercise}: {weight} × {reps}
          </Text>
        </Text>
      );
    }

    case 'achievement_share':
      return (
        <Text style={[typography.body, { color: textColor }]}>
          <Text style={{ fontWeight: '600' }}>{item.userDisplayName}</Text>
          {' earned "'}
          <Text style={{ fontWeight: '600' }}>{item.title}</Text>
          {'" 🏆'}
        </Text>
      );

    case 'milestone': {
      const streak = meta.streakDays ?? meta.value ?? '?';
      return (
        <Text style={[typography.body, { color: textColor }]}>
          <Text style={{ fontWeight: '600' }}>{item.userDisplayName}</Text>
          {` hit a ${streak}-day streak! 🔥`}
        </Text>
      );
    }

    default:
      return (
        <Text style={[typography.body, { color: textColor }]}>
          <Text style={{ fontWeight: '600' }}>{item.userDisplayName}</Text>
          {' '}
          {item.title}
        </Text>
      );
  }
}

// ── Component ──────────────────────────────────────────────────────

export const ActivityFeedItem = React.memo(function ActivityFeedItem({
  item,
  onLike,
  onPress,
}: ActivityFeedItemProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={() => {
        lightImpact();
        onPress();
      }}
      style={[
        styles.container,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.userDisplayName} activity`}
    >
      {/* Avatar */}
      {item.userAvatarUrl ? (
        <Image
          source={{ uri: item.userAvatarUrl }}
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
          <Ionicons name="person" size={18} color={colors.textTertiary} />
        </View>
      )}

      {/* Content */}
      <View style={[styles.content, { marginLeft: spacing.md }]}>
        {renderContent(item, colors.text, colors.textSecondary, typography)}

        {/* Footer: timestamp + like */}
        <View style={[styles.footer, { marginTop: spacing.xs }]}>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {relativeTime(item.createdAt)}
          </Text>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              lightImpact();
              onLike();
            }}
            style={styles.likeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={item.isLikedByMe ? 'Unlike' : 'Like'}
          >
            <Ionicons
              name={item.isLikedByMe ? 'heart' : 'heart-outline'}
              size={16}
              color={item.isLikedByMe ? colors.gold : colors.textTertiary}
            />
            {item.likesCount > 0 && (
              <Text
                style={[
                  typography.caption,
                  {
                    color: item.isLikedByMe ? colors.gold : colors.textTertiary,
                    marginLeft: 3,
                  },
                ]}
              >
                {item.likesCount}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
