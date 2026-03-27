import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from '../ui/ExpandableCard';
import { lightImpact } from '../../lib/haptics';
import type { ChallengeWithParticipants } from '../../../../../packages/shared/src/types/compete';

// ── Types ──────────────────────────────────────────────────────────

export interface ChallengeCardProps {
  challenges: ChallengeWithParticipants[];
  onViewChallenge: (id: string) => void;
  onCreateChallenge: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

function daysRemaining(endsAt: string): number {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function metricLabel(metric: ChallengeWithParticipants['metric']): string {
  switch (metric) {
    case 'volume': return 'Volume';
    case 'workouts': return 'Workouts';
    case 'streak': return 'Streak';
    case 'prs': return 'PRs';
    case 'consistency': return 'Consistency';
    default: return metric;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function ChallengeCard({
  challenges,
  onViewChallenge,
  onCreateChallenge,
}: ChallengeCardProps) {
  const { colors, typography, spacing, radius, dark } = useTheme();
  const goldColor = dark ? '#CFAE80' : '#B8944F';

  const activeChallenges = useMemo(
    () => challenges.filter((c) => c.status === 'active'),
    [challenges],
  );

  // ── Collapsed content ─────────────────────────────────────────

  const collapsed = (
    <View style={styles.collapsedRow}>
      <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
        📊 Active Challenges ({activeChallenges.length})
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </View>
  );

  // ── Expanded content ──────────────────────────────────────────

  const expanded = (
    <View style={{ gap: spacing.md }}>
      {activeChallenges.map((challenge) => {
        const days = daysRemaining(challenge.endsAt);
        const sortedParticipants = [...challenge.participants]
          .filter((p) => p.status === 'accepted')
          .sort((a, b) => b.score - a.score);
        const maxScore = sortedParticipants.length > 0 ? sortedParticipants[0].score : 1;

        return (
          <Pressable
            key={challenge.id}
            onPress={() => {
              lightImpact();
              onViewChallenge(challenge.id);
            }}
            style={[
              styles.challengeItem,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            {/* Title + countdown */}
            <View style={styles.challengeHeader}>
              <Text
                style={[typography.label, { color: colors.text, flex: 1 }]}
                numberOfLines={1}
              >
                {challenge.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {days > 0 ? `Ends in ${days}d` : 'Ended'}
              </Text>
            </View>

            {/* Metric badge */}
            <Text style={[typography.caption, { color: goldColor, marginTop: spacing.xs }]}>
              {metricLabel(challenge.metric)}
            </Text>

            {/* Participant scores */}
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {sortedParticipants.slice(0, 5).map((p) => {
                const progress = maxScore > 0 ? Math.min(p.score / maxScore, 1) : 0;
                return (
                  <View key={p.id} style={styles.participantRow}>
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSecondary, width: 80 },
                      ]}
                      numberOfLines={1}
                    >
                      {p.displayName}
                    </Text>
                    <View
                      style={[
                        styles.progressTrack,
                        {
                          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          borderRadius: radius.sm,
                          flex: 1,
                          marginHorizontal: spacing.sm,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress * 100}%` as any,
                            backgroundColor: goldColor,
                            borderRadius: radius.sm,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[typography.caption, { color: colors.text, width: 40, textAlign: 'right' }]}>
                      {p.score}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        );
      })}

      {activeChallenges.length === 0 && (
        <Text style={[typography.body, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.base }]}>
          No active challenges
        </Text>
      )}

      {/* New Challenge button */}
      <Pressable
        onPress={() => {
          lightImpact();
          onCreateChallenge();
        }}
        style={[
          styles.createButton,
          {
            backgroundColor: dark ? 'rgba(207, 174, 128, 0.15)' : 'rgba(184, 148, 79, 0.12)',
            borderRadius: radius.md,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <Ionicons name="add" size={18} color={goldColor} />
        <Text style={[typography.label, { color: goldColor, marginLeft: spacing.xs }]}>
          New Challenge
        </Text>
      </Pressable>
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
  challengeItem: {
    gap: 0,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    minWidth: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
