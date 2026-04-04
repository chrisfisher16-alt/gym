import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useChallengeStore } from '../../src/stores/challenge-store';
import { selectionFeedback, mediumImpact } from '../../src/lib/haptics';
import { Button } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import type { ChallengeWithParticipants, ChallengeStatus } from '../../../../packages/shared/src/types/compete';

// ── Helpers ──────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  volume: 'Total Volume',
  workouts: 'Workouts Completed',
  streak: 'Workout Streak',
  prs: 'Personal Records',
  consistency: 'Consistency Score',
};

const METRIC_UNITS: Record<string, string> = {
  volume: 'lbs',
  workouts: 'sessions',
  streak: 'days',
  prs: 'PRs',
  consistency: '%',
};

const STATUS_CONFIG: Record<ChallengeStatus, { label: string; colorKey: 'active' | 'warning' | 'completed' | 'textTertiary' }> = {
  pending: { label: 'Pending', colorKey: 'warning' },
  active: { label: 'Active', colorKey: 'active' },
  completed: { label: 'Completed', colorKey: 'completed' },
  cancelled: { label: 'Cancelled', colorKey: 'textTertiary' },
};

function useCountdown(endsAt: string): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ── Component ───────────────────────────────────────────────────

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { colors, spacing, radius, typography } = useTheme();

  const activeChallenges = useChallengeStore((s) => s.activeChallenges);
  const completedChallenges = useChallengeStore((s) => s.completedChallenges);
  const acceptChallenge = useChallengeStore((s) => s.acceptChallenge);
  const declineChallenge = useChallengeStore((s) => s.declineChallenge);
  const cancelChallenge = useChallengeStore((s) => s.cancelChallenge);
  const storeLoading = useChallengeStore((s) => s.loading);
  const currentUser = useAuthStore((s) => s.user);

  const [actionLoading, setActionLoading] = useState(false);

  const challenge: ChallengeWithParticipants | undefined = useMemo(() => {
    return (
      activeChallenges.find((c) => c.id === challengeId) ??
      completedChallenges.find((c) => c.id === challengeId)
    );
  }, [activeChallenges, completedChallenges, challengeId]);

  const countdown = useCountdown(challenge?.endsAt ?? new Date().toISOString());

  // Sort participants by score (descending)
  const rankedParticipants = useMemo(() => {
    if (!challenge) return [];
    return [...challenge.participants]
      .filter((p) => p.status === 'accepted' || p.status === 'invited')
      .sort((a, b) => b.score - a.score);
  }, [challenge]);

  const maxScore = rankedParticipants.length > 0 ? rankedParticipants[0].score : 1;

  // Check if current user has a pending invite
  // We check for 'invited' status participant — this is a simplification;
  // in production you'd compare against the auth user id.
  const pendingParticipant = challenge?.participants.find((p) => p.status === 'invited');

  const handleAccept = useCallback(async () => {
    if (!challengeId) return;
    setActionLoading(true);
    mediumImpact();
    await acceptChallenge(challengeId);
    setActionLoading(false);
  }, [challengeId, acceptChallenge]);

  const handleDecline = useCallback(async () => {
    if (!challengeId) return;
    setActionLoading(true);
    selectionFeedback();
    await declineChallenge(challengeId);
    setActionLoading(false);
    router.back();
  }, [challengeId, declineChallenge, router]);

  const handleCancel = useCallback(() => {
    if (!challengeId) return;
    Alert.alert(
      'Cancel Challenge',
      'Are you sure you want to cancel this challenge? This cannot be undone.',
      [
        { text: 'Keep Challenge', style: 'cancel' },
        {
          text: 'Cancel Challenge',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            selectionFeedback();
            const { error } = await cancelChallenge(challengeId);
            setActionLoading(false);
            if (error) {
              Alert.alert('Error', error);
            }
          },
        },
      ],
    );
  }, [challengeId, cancelChallenge]);

  const isCreator = currentUser?.id === challenge?.creatorId;
  const canCancel = isCreator && (challenge?.status === 'active' || challenge?.status === 'pending');

  // ── Loading / Not Found ────────────────────────────────────────

  if (!challenge) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          {storeLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <Text style={[typography.body, { color: colors.textSecondary }]}>Challenge not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[challenge.status];

  // ── Main Render ────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text
          style={[typography.h3, { color: colors.text, flex: 1, marginLeft: spacing.md }]}
          numberOfLines={1}
        >
          {challenge.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + Countdown */}
        <View style={[styles.statusRow, { marginBottom: spacing.lg }]}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors[statusCfg.colorKey] + '20',
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Text style={[typography.labelSmall, { color: colors[statusCfg.colorKey] }]}>
              {statusCfg.label}
            </Text>
          </View>
          {(challenge.status === 'active' || challenge.status === 'pending') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: spacing.md }}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                {countdown}
              </Text>
            </View>
          )}
        </View>

        {/* Metric */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.base,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={[typography.labelSmall, { color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs }]}>
            Metric
          </Text>
          <Text style={[typography.h2, { color: colors.text }]}>
            {METRIC_LABELS[challenge.metric] ?? challenge.metric}
          </Text>
        </View>

        {/* Leaderboard */}
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Leaderboard
        </Text>

        {rankedParticipants.length === 0 ? (
          <Text style={[typography.body, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl }]}>
            No participants yet.
          </Text>
        ) : (
          rankedParticipants.map((p, idx) => {
            const rank = idx + 1;
            const progressWidth = maxScore > 0 ? (p.score / maxScore) * 100 : 0;
            const medalColor =
              rank === 1 ? colors.medalGold :
              rank === 2 ? colors.medalSilver :
              rank === 3 ? colors.medalBronze :
              undefined;

            return (
              <View
                key={p.id}
                style={[
                  styles.leaderRow,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: rank === 1 ? colors.gold : colors.border,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                {/* Rank */}
                <View style={[styles.rankBadge, { marginRight: spacing.md }]}>
                  {medalColor ? (
                    <Ionicons name="medal" size={20} color={medalColor} />
                  ) : (
                    <Text style={[typography.label, { color: colors.textTertiary }]}>
                      {rank}
                    </Text>
                  )}
                </View>

                {/* Avatar */}
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.full,
                      marginRight: spacing.md,
                    },
                  ]}
                >
                  <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                    {p.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Name + Progress */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
                      {p.displayName}
                    </Text>
                    <Text style={[typography.label, { color: colors.text }]}>
                      {p.score} {METRIC_UNITS[challenge.metric] ?? ''}
                    </Text>
                  </View>
                  {/* Progress bar */}
                  <View
                    style={{
                      height: 6,
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.full,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.max(progressWidth, 2)}%`,
                        backgroundColor: rank === 1 ? colors.gold : colors.primary,
                        borderRadius: radius.full,
                      }}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Cancel Challenge — only for the creator on active/pending challenges */}
        {canCancel && (
          <View style={{ marginTop: spacing.xl }}>
            <Button
              title="Cancel Challenge"
              variant="danger"
              onPress={handleCancel}
              disabled={actionLoading}
              fullWidth
            />
          </View>
        )}
      </ScrollView>

      {/* Accept / Decline for pending invites */}
      {challenge.status === 'pending' && pendingParticipant && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              paddingHorizontal: spacing.base,
              paddingBottom: spacing.xl,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Decline"
                variant="secondary"
                onPress={handleDecline}
                disabled={actionLoading}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Accept"
                onPress={handleAccept}
                loading={actionLoading}
                disabled={actionLoading}
              />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {},
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
