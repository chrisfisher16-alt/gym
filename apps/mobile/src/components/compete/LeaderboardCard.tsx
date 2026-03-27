import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from '../ui/ExpandableCard';
import { selectionFeedback } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  value: number;
  isCurrentUser: boolean;
}

export interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  category: 'volume' | 'workouts' | 'streak' | 'prs' | 'consistency';
  timeframe: 'week' | 'month' | 'all';
  onCategoryChange: (cat: string) => void;
  onTimeframeChange: (tf: string) => void;
  isLoading?: boolean;
  unitLabel?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const MEDAL_ICONS = ['🥇', '🥈', '🥉'] as const;
const AVATAR_SIZE = 32;

const CATEGORIES: { key: LeaderboardCardProps['category']; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'workouts', label: 'Workouts' },
  { key: 'streak', label: 'Streak' },
  { key: 'prs', label: 'PRs' },
  { key: 'consistency', label: 'Consistency' },
];

const TIMEFRAMES: { key: LeaderboardCardProps['timeframe']; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

// ── Helpers ────────────────────────────────────────────────────────

function formatValue(value: number, unitLabel?: string): string {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k${unitLabel ? ` ${unitLabel}` : ''}`;
  }
  return `${value.toLocaleString()}${unitLabel ? ` ${unitLabel}` : ''}`;
}

function timeframeLabel(tf: LeaderboardCardProps['timeframe']): string {
  switch (tf) {
    case 'week': return "This Week's";
    case 'month': return "This Month's";
    case 'all': return 'All Time';
  }
}

// ── Component ──────────────────────────────────────────────────────

export function LeaderboardCard({
  entries,
  category,
  timeframe,
  onCategoryChange,
  onTimeframeChange,
  isLoading = false,
  unitLabel,
}: LeaderboardCardProps) {
  const { colors, typography, spacing, radius, dark } = useTheme();

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.value - a.value),
    [entries],
  );
  const top3 = sorted.slice(0, 3);

  // ── Collapsed content ─────────────────────────────────────────

  const collapsed = (
    <View style={styles.collapsedRow}>
      <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
        🏆 {timeframeLabel(timeframe)} Leaderboard
      </Text>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.gold} />
      ) : (
        <View style={styles.top3Preview}>
          {top3.map((entry, i) => (
            <View key={entry.userId} style={styles.previewEntry}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {MEDAL_ICONS[i]}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {entry.displayName.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Expanded content ──────────────────────────────────────────

  const expanded = (
    <View style={{ gap: spacing.md }}>
      {/* Full ranked list */}
      {sorted.map((entry, i) => (
        <View
          key={entry.userId}
          style={[
            styles.rankRow,
            {
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: entry.isCurrentUser
                ? dark ? 'rgba(207, 174, 128, 0.15)' : 'rgba(184, 148, 79, 0.12)'
                : 'transparent',
            },
          ]}
        >
          {/* Rank */}
          <View style={styles.rankBadge}>
            {i < 3 ? (
              <Text style={{ fontSize: 16 }}>{MEDAL_ICONS[i]}</Text>
            ) : (
              <Text style={[typography.label, { color: colors.textTertiary, width: 24, textAlign: 'center' }]}>
                {i + 1}
              </Text>
            )}
          </View>

          {/* Avatar */}
          {entry.avatarUrl ? (
            <Image
              source={{ uri: entry.avatarUrl }}
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
              <Ionicons name="person" size={16} color={colors.textTertiary} />
            </View>
          )}

          {/* Name */}
          <Text
            style={[
              typography.body,
              {
                color: entry.isCurrentUser ? colors.gold : colors.text,
                fontWeight: entry.isCurrentUser ? '600' : '400',
                flex: 1,
                marginLeft: spacing.sm,
              },
            ]}
            numberOfLines={1}
          >
            {entry.displayName}
            {entry.isCurrentUser ? ' (You)' : ''}
          </Text>

          {/* Value */}
          <Text
            style={[
              typography.label,
              { color: i < 3 ? colors.gold : colors.textSecondary },
            ]}
          >
            {formatValue(entry.value, unitLabel)}
          </Text>
        </View>
      ))}

      {sorted.length === 0 && !isLoading && (
        <Text style={[typography.body, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.base }]}>
          No entries yet
        </Text>
      )}

      {/* Category picker */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 }]}>
          Category
        </Text>
        <View style={styles.segmentRow}>
          {CATEGORIES.map((c) => {
            const isActive = c.key === category;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  selectionFeedback();
                  onCategoryChange(c.key);
                }}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: isActive
                      ? (dark ? 'rgba(207, 174, 128, 0.2)' : 'rgba(184, 148, 79, 0.15)')
                      : colors.surfaceSecondary,
                    borderRadius: radius.sm,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: isActive ? colors.gold : colors.textSecondary,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Timeframe picker */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 }]}>
          Timeframe
        </Text>
        <View style={styles.segmentRow}>
          {TIMEFRAMES.map((t) => {
            const isActive = t.key === timeframe;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  selectionFeedback();
                  onTimeframeChange(t.key);
                }}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: isActive
                      ? (dark ? 'rgba(207, 174, 128, 0.2)' : 'rgba(184, 148, 79, 0.15)')
                      : colors.surfaceSecondary,
                    borderRadius: radius.sm,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: isActive ? colors.gold : colors.textSecondary,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <ExpandableCard expandedContent={expanded}>
      {collapsed}
    </ExpandableCard>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  top3Preview: {
    flexDirection: 'row',
    gap: 8,
  },
  previewEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segmentItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
