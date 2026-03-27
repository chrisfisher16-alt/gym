import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { ScreenContainer, ExpandableCard, EmptyState } from '../../src/components/ui';
import { LeaderboardCard, type LeaderboardEntry } from '../../src/components/compete/LeaderboardCard';
import { ChallengeCard } from '../../src/components/compete/ChallengeCard';
import { FriendRow } from '../../src/components/compete/FriendRow';
import { ActivityFeedItem } from '../../src/components/compete/ActivityFeedItem';
import { InviteFriendsSheet } from '../../src/components/InviteFriendsSheet';
import { useChallengeStore } from '../../src/stores/challenge-store';
import { useFriendsStore } from '../../src/stores/friends-store';
import { useFeedStore } from '../../src/stores/feed-store';
import { CompeteTabSkeleton } from '../../src/components/ui/SkeletonLayouts';
import { supabase } from '../../src/lib/supabase';
import type { ChallengeMetric } from '../../../../packages/shared/src/types/compete';

// ── Component ─────────────────────────────────────────────────────────

export default function CompeteTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography, dark } = useTheme();
  const goldColor = dark ? '#CFAE80' : '#B8944F';

  // ── Stores ────────────────────────────────────────────────────────
  const {
    activeChallenges,
    loading: challengesLoading,
    leaderboard,
    leaderboardMetric,
    leaderboardTimeframe,
    initialize: initChallenges,
    fetchLeaderboard,
  } = useChallengeStore();

  const {
    friends,
    isLoading: friendsLoading,
    initialize: initFriends,
    isInitialized: friendsInitialized,
  } = useFriendsStore();

  const {
    items: feedItems,
    isLoading: feedLoading,
    isRefreshing: feedRefreshing,
    fetchFriendActivity,
    toggleLike,
  } = useFeedStore();

  // ── Local state ───────────────────────────────────────────────────
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [category, setCategory] = useState<ChallengeMetric>(leaderboardMetric);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>(leaderboardTimeframe);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    initChallenges();
    if (!friendsInitialized) initFriends();
    fetchFriendActivity(true);
    fetchLeaderboard(category, timeframe);
  }, []);

  // ── Leaderboard category/timeframe change ─────────────────────────
  const handleCategoryChange = useCallback(
    (cat: string) => {
      const metric = cat as ChallengeMetric;
      setCategory(metric);
      fetchLeaderboard(metric, timeframe);
    },
    [timeframe, fetchLeaderboard],
  );

  const handleTimeframeChange = useCallback(
    (tf: string) => {
      const t = tf as 'week' | 'month' | 'all';
      setTimeframe(t);
      fetchLeaderboard(category, t);
    },
    [category, fetchLeaderboard],
  );

  // ── Leaderboard entries mapped to component format ────────────────
  const leaderboardEntries: LeaderboardEntry[] = useMemo(
    () =>
      leaderboard.map((e) => ({
        userId: e.userId,
        displayName: e.displayName,
        avatarUrl: e.avatarUrl ?? undefined,
        value: e.score,
        isCurrentUser: e.userId === currentUserId,
      })),
    [leaderboard, currentUserId],
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      initChallenges(),
      initFriends(),
      fetchFriendActivity(true),
      fetchLeaderboard(category, timeframe),
    ]);
    setIsRefreshing(false);
  }, [category, timeframe, initChallenges, initFriends, fetchFriendActivity, fetchLeaderboard]);

  // ── Friend row data ───────────────────────────────────────────────
  const friendRows = useMemo(
    () =>
      friends.map((f) => ({
        id: f.friend.id,
        displayName: f.friend.displayName,
        avatarUrl: f.friend.avatarUrl,
      })),
    [friends],
  );

  // ── Initial loading state ─────────────────────────────────────────
  const isInitialLoading = challengesLoading && friendsLoading && feedLoading;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={goldColor}
        />
      }
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: spacing.sm, paddingBottom: spacing.md }]}>
        <Text style={[typography.h1, { color: colors.text, flex: 1 }]}>Compete</Text>
        <TouchableOpacity
          onPress={() => setInviteSheetVisible(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Invite friends"
          style={[
            styles.inviteButton,
            {
              backgroundColor: dark ? 'rgba(207, 174, 128, 0.15)' : 'rgba(184, 148, 79, 0.12)',
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <Ionicons name="person-add-outline" size={18} color={goldColor} />
          <Text style={[typography.labelSmall, { color: goldColor, marginLeft: spacing.xs }]}>
            Invite
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {isInitialLoading ? (
        <CompeteTabSkeleton />
      ) : (
        <View style={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          {/* Section 1: Leaderboard */}
          <LeaderboardCard
            entries={leaderboardEntries}
            category={category}
            timeframe={timeframe}
            onCategoryChange={handleCategoryChange}
            onTimeframeChange={handleTimeframeChange}
            isLoading={challengesLoading}
          />

          {/* Section 2: Active Challenges */}
          <ChallengeCard
            challenges={activeChallenges}
            onViewChallenge={(id) => router.push(`/social/challenges/${id}` as any)}
            onCreateChallenge={() => router.push('/social/challenges/create' as any)}
          />

          {/* Section 3: Friends */}
          <ExpandableCard
            expandedContent={
              <View style={{ gap: spacing.xs }}>
                {friends.length === 0 ? (
                  <EmptyState
                    compact
                    icon="people-outline"
                    title="No friends yet"
                    description="Add friends to compete on the leaderboard"
                    actionLabel="Find Friends"
                    onAction={() => router.push('/social/friends')}
                  />
                ) : (
                  <>
                    {friends.map((f) => (
                      <FriendRow
                        key={f.id}
                        friend={{
                          id: f.friend.id,
                          displayName: f.friend.displayName,
                          avatarUrl: f.friend.avatarUrl,
                        }}
                        onPress={() => router.push('/social/friends')}
                        onChallenge={() => router.push('/social/challenges/create' as any)}
                        onRemove={() => {}}
                      />
                    ))}
                    <TouchableOpacity
                      onPress={() => setInviteSheetVisible(true)}
                      style={[
                        styles.addFriendsButton,
                        {
                          backgroundColor: dark ? 'rgba(207, 174, 128, 0.15)' : 'rgba(184, 148, 79, 0.12)',
                          borderRadius: radius.md,
                          paddingVertical: spacing.md,
                          marginTop: spacing.sm,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Invite friends"
                    >
                      <Ionicons name="add" size={18} color={goldColor} />
                      <Text style={[typography.label, { color: goldColor, marginLeft: spacing.xs }]}>
                        Invite Friends
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            }
          >
            <View style={styles.sectionHeader}>
              <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
                👥 Friends ({friends.length})
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </ExpandableCard>

          {/* Section 4: Activity Feed */}
          <ExpandableCard
            expandedContent={
              <View style={{ gap: spacing.xs }}>
                {feedItems.length === 0 ? (
                  <EmptyState
                    compact
                    icon="newspaper-outline"
                    title="No activity yet"
                    description="Complete a workout and share it, or add friends to see their activity"
                  />
                ) : (
                  feedItems.slice(0, 10).map((item) => (
                    <ActivityFeedItem
                      key={item.id}
                      item={item}
                      onLike={() => toggleLike(item.id)}
                      onPress={() => router.push('/social/feed')}
                    />
                  ))
                )}
                {feedItems.length > 0 && (
                  <TouchableOpacity
                    onPress={() => router.push('/social/feed')}
                    style={[
                      styles.viewAllButton,
                      {
                        paddingVertical: spacing.md,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                        marginTop: spacing.sm,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="View all activity"
                  >
                    <Text style={[typography.label, { color: goldColor }]}>
                      View All Activity
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={goldColor} style={{ marginLeft: spacing.xs }} />
                  </TouchableOpacity>
                )}
              </View>
            }
          >
            <View style={styles.sectionHeader}>
              <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
                📰 Activity Feed
              </Text>
              {feedLoading && <ActivityIndicator size="small" color={goldColor} />}
            </View>
          </ExpandableCard>
        </View>
      )}

      {/* Invite Sheet */}
      <InviteFriendsSheet
        visible={inviteSheetVisible}
        onClose={() => setInviteSheetVisible(false)}
      />
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
