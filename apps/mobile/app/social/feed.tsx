import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing as sp } from '../../src/theme';
import { ScreenContainer, EmptyState } from '../../src/components/ui';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useFeedStore, type FeedItem } from '../../src/stores/feed-store';
import { useFriendsStore } from '../../src/stores/friends-store';
import { supabase } from '../../src/lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatDurationMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function getIconForType(type: FeedItem['type']): string {
  switch (type) {
    case 'workout_share': return 'barbell-outline';
    case 'pr_share': return 'trophy-outline';
    case 'achievement_share': return 'ribbon-outline';
    case 'milestone': return 'flag-outline';
    default: return 'fitness-outline';
  }
}

// ── Feed Card Component ────────────────────────────────────────────────

function FeedCard({
  item,
  onLike,
  onDelete,
  isOwnItem,
}: {
  item: FeedItem;
  onLike: () => void;
  onDelete: () => void;
  isOwnItem: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  const meta = item.metadata || {};
  const stats = useMemo(() => {
    const parts: { label: string; value: string; icon: string }[] = [];
    if (meta.durationSeconds) {
      parts.push({ label: 'Duration', value: formatDurationMinutes(meta.durationSeconds), icon: 'time-outline' });
    }
    if (meta.totalVolume) {
      const vol = meta.totalVolume >= 1000
        ? `${(meta.totalVolume / 1000).toFixed(1)}k`
        : `${meta.totalVolume}`;
      parts.push({ label: 'Volume', value: `${vol} ${meta.unit || 'lbs'}`, icon: 'barbell-outline' });
    }
    if (meta.totalSets) {
      parts.push({ label: 'Sets', value: `${meta.totalSets}`, icon: 'layers-outline' });
    }
    if (meta.exerciseCount) {
      parts.push({ label: 'Exercises', value: `${meta.exerciseCount}`, icon: 'fitness-outline' });
    }
    if (meta.prCount && meta.prCount > 0) {
      parts.push({ label: 'PRs', value: `${meta.prCount}`, icon: 'trophy' });
    }
    return parts;
  }, [item.metadata]);

  const handleLongPress = () => {
    if (!isOwnItem) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this post?')) onDelete();
    } else {
      crossPlatformAlert('Delete Post', 'Remove this from your feed?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={isOwnItem ? 0.8 : 1}
      onLongPress={handleLongPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.userDisplayName} shared: ${item.title}`}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary, borderRadius: 20 },
          ]}
        >
          <Text style={[typography.labelLarge, { color: colors.textOnPrimary }]}>
            {item.userDisplayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.labelLarge, { color: colors.text }]}>
            {item.userDisplayName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: colors.primaryLight, borderRadius: radius.sm },
          ]}
        >
          <Ionicons name={getIconForType(item.type) as any} size={14} color={colors.primary} />
        </View>
      </View>

      {/* Content */}
      <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
        {item.title}
      </Text>
      {item.body ? (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
          {item.body}
        </Text>
      ) : null}

      {/* Stats row */}
      {stats.length > 0 && (
        <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statChip,
                { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
              ]}
            >
              <Ionicons name={stat.icon as any} size={14} color={colors.textSecondary} />
              <Text style={[typography.caption, { color: colors.text, marginLeft: 4, fontWeight: '600' }]}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actionsRow, { marginTop: spacing.sm, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onLike}
          accessibilityRole="button"
          accessibilityLabel={item.isLikedByMe ? 'Unlike' : 'Like'}
        >
          <Ionicons
            name={item.isLikedByMe ? 'heart' : 'heart-outline'}
            size={20}
            color={item.isLikedByMe ? colors.error : colors.textSecondary}
          />
          {item.likesCount > 0 && (
            <Text
              style={[
                typography.caption,
                { color: item.isLikedByMe ? colors.error : colors.textSecondary, marginLeft: 4 },
              ]}
            >
              {item.likesCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────

export default function FeedScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    items,
    isLoading,
    isRefreshing,
    hasMore,
    fetchFeed,
    toggleLike,
    deleteItem,
  } = useFeedStore();
  const friendCount = useFriendsStore((s) => s.friends.length);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const handleRefresh = useCallback(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchFeed(false);
    }
  }, [hasMore, isLoading, fetchFeed]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <FeedCard
        item={item}
        onLike={() => toggleLike(item.id)}
        onDelete={() => deleteItem(item.id)}
        isOwnItem={item.userId === currentUserId}
      />
    ),
    [toggleLike, deleteItem, currentUserId],
  );

  const emptyState = (
    <EmptyState
      icon="newspaper-outline"
      title="No Activity Yet"
      description="Complete a workout and share it, or add friends to see their activity"
      actionLabel="Find Friends"
      onAction={() => router.push('/social/friends')}
    />
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
          Activity Feed
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/social/friends')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Friends"
        >
          <Ionicons name="people-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { paddingHorizontal: spacing.md, marginTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, styles.tabActive, { borderBottomColor: colors.primary }]}
          activeOpacity={1}
          accessibilityRole="tab"
          accessibilityState={{ selected: true }}
          accessibilityLabel="Feed tab"
        >
          <Text style={[typography.labelLarge, { color: colors.primary }]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/social/leaderboard')}
          accessibilityRole="tab"
          accessibilityState={{ selected: false }}
          accessibilityLabel="Leaderboard tab"
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/social/friends')}
          accessibilityRole="tab"
          accessibilityState={{ selected: false }}
          accessibilityLabel="Friends tab"
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Feed list */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          { paddingTop: spacing.md, paddingBottom: spacing.xl },
          items.length === 0 && { flex: 1, justifyContent: 'center' },
        ]}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={isLoading ? null : emptyState}
        ListFooterComponent={
          isLoading && items.length > 0 ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sp.sm,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  card: {},
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    padding: sp.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.sm,
    paddingVertical: sp.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: sp.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.xs,
    paddingHorizontal: sp.xs,
    minWidth: 44,
    minHeight: 44,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
  },
});
