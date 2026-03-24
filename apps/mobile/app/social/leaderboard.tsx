import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { ScreenContainer, Card } from '../../src/components/ui';
import { useFriendsStore } from '../../src/stores/friends-store';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { useNutritionStore } from '../../src/stores/nutrition-store';

type LeaderboardCategory = 'volume' | 'workouts' | 'streak' | 'prs' | 'nutrition';

const CATEGORIES: { key: LeaderboardCategory; label: string; icon: string }[] = [
  { key: 'volume', label: 'Volume', icon: 'barbell-outline' },
  { key: 'workouts', label: 'Workouts', icon: 'fitness-outline' },
  { key: 'streak', label: 'Streak', icon: 'flame-outline' },
  { key: 'prs', label: 'PRs', icon: 'trophy-outline' },
  { key: 'nutrition', label: 'Nutrition', icon: 'restaurant-outline' },
];

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  value: number;
  displayValue: string;
  isCurrentUser: boolean;
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { friends, initialize: initFriends, isInitialized: friendsInitialized } = useFriendsStore();
  const history = useWorkoutStore((s) => s.history);
  const profile = useProfileStore((s) => s.profile);
  const unitPref = profile.unitPreference;
  const weightUnit = unitPref === 'metric' ? 'kg' : 'lbs';
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('volume');

  useEffect(() => {
    if (!friendsInitialized) initFriends();
  }, [friendsInitialized]);

  // Compute current user's stats
  const myStats = useMemo(() => {
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const weekWorkouts = history.filter(
      (h) => new Date(h.completedAt) >= weekStart,
    );
    const monthWorkouts = history.filter(
      (h) => new Date(h.completedAt) >= monthStart,
    );

    const weeklyVolume = weekWorkouts.reduce((s, h) => s + h.totalVolume, 0);
    const weeklyCount = weekWorkouts.length;
    const monthlyPRs = monthWorkouts.reduce((s, h) => s + h.prCount, 0);

    // Streak: consecutive days with workouts
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(today);
    const sortedHistory = [...history].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasWorkout = sortedHistory.some(
        (h) => h.completedAt.startsWith(dateStr),
      );
      if (hasWorkout) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Today might not have a workout yet, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      } else {
        break;
      }
    }

    // Nutrition: days with meals logged this week
    let nutritionDays = 0;
    const checkNutrition = new Date(weekStart);
    while (checkNutrition <= today) {
      const key = checkNutrition.toISOString().split('T')[0];
      if (dailyLogs[key]?.meals?.length > 0) nutritionDays++;
      checkNutrition.setDate(checkNutrition.getDate() + 1);
    }
    const daysSoFar = Math.max(1, Math.ceil((today.getTime() - weekStart.getTime()) / 86400000) + 1);
    const nutritionPct = Math.round((nutritionDays / daysSoFar) * 100);

    return { weeklyVolume, weeklyCount, streak, monthlyPRs, nutritionPct };
  }, [history, dailyLogs]);

  // Build leaderboard entries (current user + friends with placeholder data)
  // In a full implementation, friend stats would come from Supabase queries
  const entries = useMemo((): LeaderboardEntry[] => {
    const me: LeaderboardEntry = {
      userId: 'me',
      displayName: profile.displayName || 'You',
      value: 0,
      displayValue: '',
      isCurrentUser: true,
    };

    switch (selectedCategory) {
      case 'volume':
        me.value = myStats.weeklyVolume;
        me.displayValue = `${Math.round(me.value).toLocaleString()} ${weightUnit}`;
        break;
      case 'workouts':
        me.value = myStats.weeklyCount;
        me.displayValue = `${me.value} sessions`;
        break;
      case 'streak':
        me.value = myStats.streak;
        me.displayValue = `${me.value} days`;
        break;
      case 'prs':
        me.value = myStats.monthlyPRs;
        me.displayValue = `${me.value} PRs`;
        break;
      case 'nutrition':
        me.value = myStats.nutritionPct;
        me.displayValue = `${me.value}%`;
        break;
    }

    // Friends show as placeholders since we don't have their workout data locally
    // In production, this would be a Supabase RPC query
    const friendEntries: LeaderboardEntry[] = friends.map((f) => ({
      userId: f.friend.id,
      displayName: f.friend.displayName,
      value: 0,
      displayValue: '--',
      isCurrentUser: false,
    }));

    return [me, ...friendEntries].sort((a, b) => b.value - a.value);
  }, [selectedCategory, myStats, friends, profile.displayName, weightUnit]);

  const categoryInfo = CATEGORIES.find((c) => c.key === selectedCategory)!;
  const periodLabel = selectedCategory === 'prs' ? 'This Month' : 'This Week';

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Leaderboard
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/social/friends')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Friends"
        >
          <Ionicons name="people-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={[styles.navTabs, { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm }]}>
        <TouchableOpacity
          style={[styles.navTab, { minHeight: 44, justifyContent: 'center' }]}
          onPress={() => router.push('/social/feed')}
          accessibilityRole="tab"
          accessibilityLabel="Feed tab"
          accessibilityState={{ selected: false }}
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navTab, { minHeight: 44, justifyContent: 'center', borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          activeOpacity={1}
          accessibilityRole="tab"
          accessibilityLabel="Leaderboard tab, selected"
          accessibilityState={{ selected: true }}
        >
          <Text style={[typography.labelLarge, { color: colors.primary }]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navTab, { minHeight: 44, justifyContent: 'center' }]}
          onPress={() => router.push('/social/friends')}
          accessibilityRole="tab"
          accessibilityLabel="Friends tab"
          accessibilityState={{ selected: false }}
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Category Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.base, gap: spacing.sm }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedCategory(cat.key)}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === cat.key ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                minHeight: 44,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
          >
            <Ionicons
              name={cat.icon as any}
              size={16}
              color={selectedCategory === cat.key ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: selectedCategory === cat.key ? colors.textInverse : colors.text,
                  marginLeft: 6,
                },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[typography.caption, { color: colors.textTertiary, marginBottom: spacing.md }]}>
        {periodLabel}
      </Text>

      {/* Leaderboard */}
      {friends.length < 3 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={56} color={colors.textTertiary} />
          <Text style={[typography.h3, { color: colors.text, marginTop: spacing.base, textAlign: 'center' }]}>
            Add friends to compete
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 280 },
            ]}
          >
            The leaderboard comes alive with 3 or more friends. Search and add friends to get started.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/social/friends')}
            style={[
              styles.ctaBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                marginTop: spacing.xl,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Find friends"
          >
            <Ionicons name="person-add-outline" size={18} color={colors.textInverse} />
            <Text style={[typography.label, { color: colors.textInverse, marginLeft: spacing.sm }]}>
              Find Friends
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const medalColors = [colors.medalGold, colors.medalSilver, colors.medalBronze];

            return (
              <View
                key={entry.userId}
                style={[
                  styles.entryRow,
                  {
                    backgroundColor: entry.isCurrentUser
                      ? colors.primaryMuted
                      : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    borderWidth: entry.isCurrentUser ? 1 : 0,
                    borderColor: entry.isCurrentUser ? colors.primary : 'transparent',
                  },
                ]}
              >
                {/* Rank */}
                <View style={styles.rankContainer}>
                  {isTop3 ? (
                    <View
                      style={[
                        styles.medalBadge,
                        { backgroundColor: medalColors[rank - 1] + '20' },
                      ]}
                    >
                      <Ionicons name="medal" size={18} color={medalColors[rank - 1]} />
                    </View>
                  ) : (
                    <Text style={[typography.label, { color: colors.textTertiary, width: 28, textAlign: 'center' }]}>
                      {rank}
                    </Text>
                  )}
                </View>

                {/* Avatar + Name */}
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: entry.isCurrentUser
                        ? colors.primary
                        : colors.surfaceSecondary,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: entry.isCurrentUser ? colors.textInverse : colors.text },
                    ]}
                  >
                    {entry.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[
                    typography.label,
                    {
                      color: colors.text,
                      flex: 1,
                      marginLeft: spacing.sm,
                      fontWeight: entry.isCurrentUser ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {entry.isCurrentUser ? 'You' : entry.displayName}
                </Text>

                {/* Value */}
                <Text
                  style={[
                    typography.label,
                    { color: entry.isCurrentUser ? colors.primary : colors.text },
                  ]}
                >
                  {entry.displayValue}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navTabs: {
    flexDirection: 'row',
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  medalBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
});
