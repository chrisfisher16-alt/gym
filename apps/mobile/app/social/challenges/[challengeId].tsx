import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme';
import { ScreenContainer } from '../../../src/components/ui';
import { useChallengeStore } from '../../../src/stores/challenge-store';
import { supabase } from '../../../src/lib/supabase';
import { lightImpact, successNotification } from '../../../src/lib/haptics';
import type { ChallengeWithParticipants } from '../../../../../packages/shared/src/types/compete';

// ── Helpers ─────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, { label: string; icon: string }> = {
  volume: { label: 'Volume', icon: 'barbell-outline' },
  workouts: { label: 'Workouts', icon: 'fitness-outline' },
  streak: { label: 'Streak', icon: 'flame-outline' },
  prs: { label: 'PRs', icon: 'trophy-outline' },
  consistency: { label: 'Consistency', icon: 'calendar-outline' },
};

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

function getTimeRemaining(endDate: string): string {
  const now = new Date().getTime();
  const end = new Date(endDate).getTime();
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function getStatusColor(status: string, colors: any) {
  switch (status) {
    case 'active':
      return colors.gold;
    case 'pending':
      return colors.textSecondary;
    case 'completed':
      return colors.success;
    default:
      return colors.textTertiary;
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { colors, spacing, radius, typography, dark } = useTheme();

  const {
    activeChallenges,
    completedChallenges,
    loading,
    fetchChallenges,
    acceptChallenge,
    declineChallenge,
  } = useChallengeStore();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const challenge: ChallengeWithParticipants | undefined = useMemo(
    () =>
      [...activeChallenges, ...completedChallenges].find(
        (c) => c.id === challengeId,
      ),
    [activeChallenges, completedChallenges, challengeId],
  );

  const sortedParticipants = useMemo(
    () =>
      challenge
        ? [...challenge.participants].sort((a, b) => b.score - a.score)
        : [],
    [challenge],
  );

  const maxScore = sortedParticipants.length > 0 ? sortedParticipants[0].score : 1;

  const currentUserParticipant = useMemo(
    () =>
      challenge?.participants.find((p) => p.userId === currentUserId),
    [challenge, currentUserId],
  );

  const isPendingInvite =
    challenge?.status === 'pending' && currentUserParticipant?.status === 'invited';

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchChallenges();
    setIsRefreshing(false);
  }, [fetchChallenges]);

  const handleAccept = useCallback(async () => {
    if (!challengeId) return;
    lightImpact();
    setIsAccepting(true);
    await acceptChallenge(challengeId);
    setIsAccepting(false);
    successNotification();
  }, [challengeId, acceptChallenge]);

  const handleDecline = useCallback(async () => {
    if (!challengeId) return;
    lightImpact();
    setIsDeclining(true);
    await declineChallenge(challengeId);
    setIsDeclining(false);
    router.back();
  }, [challengeId, declineChallenge, router]);

  const metricInfo = METRIC_LABELS[challenge?.metric ?? ''] ?? {
    label: 'Unknown',
    icon: 'help-outline',
  };

  // ── Loading / Not Found ───────────────────────────────────────────
  if (!challenge && loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </ScreenContainer>
    );
  }

  if (!challenge) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { paddingTop: spacing.sm, paddingBottom: spacing.md }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.md }]}>
            Challenge not found
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const statusColor = getStatusColor(challenge.status, colors);
  const timeRemaining = getTimeRemaining(challenge.endsAt);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.sm, paddingBottom: spacing.md }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}
          numberOfLines={1}
        >
          {challenge.title}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: `${statusColor}20`,
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <Text style={[typography.labelSmall, { color: statusColor, textTransform: 'capitalize' }]}>
            {challenge.status}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.md, paddingBottom: spacing.xl }}>
        {/* Completed Banner */}
        {challenge.status === 'completed' && sortedParticipants.length > 0 && (
          <View
            style={[
              styles.winnerBanner,
              {
                backgroundColor: dark
                  ? 'rgba(207, 174, 128, 0.15)'
                  : 'rgba(184, 148, 79, 0.12)',
                borderRadius: radius.lg,
                padding: spacing.base,
                borderWidth: 1,
                borderColor: colors.gold,
              },
            ]}
          >
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typography.labelSmall, { color: colors.gold }]}>CHALLENGE COMPLETE</Text>
              <Text style={[typography.label, { color: colors.text }]}>
                {sortedParticipants[0].displayName} wins!
              </Text>
            </View>
          </View>
        )}

        {/* Info Row */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.base,
              gap: spacing.md,
            },
          ]}
        >
          <View style={styles.infoRow}>
            <View style={[styles.infoItem, { gap: spacing.xs }]}>
              <Ionicons name={metricInfo.icon as any} size={18} color={colors.gold} />
              <Text style={[typography.label, { color: colors.text }]}>{metricInfo.label}</Text>
            </View>
            <View style={[styles.infoItem, { gap: spacing.xs }]}>
              <Ionicons name="time-outline" size={18} color={colors.gold} />
              <Text style={[typography.label, { color: colors.text }]}>{timeRemaining}</Text>
            </View>
          </View>
        </View>

        {/* Participants Leaderboard */}
        <View
          style={[
            styles.participantsCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.base,
              gap: spacing.sm,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            Standings
          </Text>
          {sortedParticipants.map((p, index) => {
            const isCurrentUser = p.userId === currentUserId;
            const barWidth = maxScore > 0 ? Math.max((p.score / maxScore) * 100, 4) : 4;
            const medal = index < 3 ? MEDAL_EMOJIS[index] : null;

            return (
              <View
                key={p.id}
                style={[
                  styles.participantRow,
                  {
                    backgroundColor: isCurrentUser
                      ? dark
                        ? 'rgba(207, 174, 128, 0.1)'
                        : 'rgba(184, 148, 79, 0.08)'
                      : 'transparent',
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    borderWidth: isCurrentUser ? 1 : 0,
                    borderColor: isCurrentUser ? colors.gold : 'transparent',
                  },
                ]}
              >
                {/* Rank / Medal */}
                <View style={styles.rankCol}>
                  {medal ? (
                    <Text style={{ fontSize: 18 }}>{medal}</Text>
                  ) : (
                    <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
                      #{index + 1}
                    </Text>
                  )}
                </View>

                {/* Avatar */}
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: isCurrentUser ? colors.gold : colors.primaryMuted,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: isCurrentUser
                          ? colors.textInverse
                          : colors.primary,
                      },
                    ]}
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Name + Bar */}
                <View style={{ flex: 1, marginLeft: spacing.sm, gap: spacing.xs }}>
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        typography.label,
                        {
                          color: isCurrentUser ? colors.gold : colors.text,
                          flex: 1,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {p.displayName}
                      {isCurrentUser ? ' (You)' : ''}
                    </Text>
                    <Text style={[typography.label, { color: isCurrentUser ? colors.gold : colors.text }]}>
                      {p.score}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.barBg,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderRadius: radius.sm,
                        height: 6,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: isCurrentUser ? colors.gold : colors.primary,
                          borderRadius: radius.sm,
                          height: 6,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          {/* Participant status badges */}
          {challenge.participants.some((p) => p.status === 'invited') && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
                {challenge.participants.filter((p) => p.status === 'invited').length} pending invite(s)
              </Text>
            </View>
          )}
        </View>

        {/* Accept / Decline Buttons */}
        {isPendingInvite && (
          <View style={[styles.actionRow, { gap: spacing.sm }]}>
            <TouchableOpacity
              onPress={handleDecline}
              disabled={isDeclining}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.base,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flex: 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Decline challenge"
            >
              {isDeclining ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[typography.label, { color: colors.textSecondary }]}>Decline</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAccept}
              disabled={isAccepting}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.gold,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.base,
                  flex: 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Accept challenge"
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={[typography.label, { color: colors.textInverse }]}>
                  Accept
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Active status indicator */}
        {challenge.status === 'active' && !isPendingInvite && (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: dark
                  ? 'rgba(207, 174, 128, 0.1)'
                  : 'rgba(184, 148, 79, 0.08)',
                borderRadius: radius.lg,
                padding: spacing.base,
              },
            ]}
          >
            <Ionicons name="pulse-outline" size={20} color={colors.gold} />
            <Text style={[typography.label, { color: colors.gold, marginLeft: spacing.sm }]}>
              Challenge In Progress
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {},
  winnerBanner: { flexDirection: 'row', alignItems: 'center' },
  infoCard: {},
  infoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  participantsCard: {},
  participantRow: { flexDirection: 'row', alignItems: 'center' },
  rankCol: { width: 30, alignItems: 'center' },
  avatar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  barBg: { overflow: 'hidden' },
  barFill: {},
  actionRow: { flexDirection: 'row' },
  actionButton: { alignItems: 'center', justifyContent: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
