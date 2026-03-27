import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';
import { lightImpact } from '../../lib/haptics';
import type { FriendProfile } from '../../stores/friends-store';

// ── Types ──────────────────────────────────────────────────────────

export interface FriendProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  friend: FriendProfile;
  onChallenge: (friendId: string) => void;
  onRemove: (friendId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────

const AVATAR_SIZE = 64;

// ── Component ──────────────────────────────────────────────────────

export function FriendProfileSheet({
  visible,
  onClose,
  friend,
  onChallenge,
  onRemove,
}: FriendProfileSheetProps) {
  const { colors, typography, spacing, radius, dark } = useTheme();
  const goldColor = dark ? '#CFAE80' : '#B8944F';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrapper}>
        {/* Avatar + Name header */}
        <View style={styles.header}>
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
              <Ionicons name="person" size={32} color={colors.textTertiary} />
            </View>
          )}
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md }]}>
            {friend.displayName}
          </Text>
        </View>

        {/* Stats row */}
        <View
          style={[
            styles.statsRow,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              paddingVertical: spacing.base,
              paddingHorizontal: spacing.md,
              marginTop: spacing.lg,
            },
          ]}
        >
          <View style={styles.statItem}>
            <Text style={[typography.statValue, { color: colors.text }]}>—</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              Total Workouts
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[typography.statValue, { color: colors.text }]}>—</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              Current Streak
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[typography.statValue, { color: colors.text }]}>—</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              PRs This Month
            </Text>
          </View>
        </View>

        {/* Head-to-head comparison placeholder */}
        <View
          style={[
            styles.comparisonSection,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing.base,
              marginTop: spacing.md,
            },
          ]}
        >
          <View style={styles.comparisonHeader}>
            <Ionicons name="swap-horizontal" size={18} color={colors.textTertiary} />
            <Text style={[typography.label, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
              Head-to-Head
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            Comparison stats will appear once both users have logged workouts.
          </Text>
        </View>

        {/* Challenge button */}
        <Pressable
          onPress={() => {
            lightImpact();
            onChallenge(friend.id);
          }}
          style={[
            styles.challengeButton,
            {
              backgroundColor: goldColor,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              marginTop: spacing.lg,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Challenge ${friend.displayName}`}
        >
          <Ionicons name="trophy" size={18} color="#FFFFFF" />
          <Text style={[typography.label, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
            Challenge
          </Text>
        </Pressable>

        {/* Remove friend */}
        <Pressable
          onPress={() => {
            lightImpact();
            onRemove(friend.id);
          }}
          style={[styles.removeButton, { paddingVertical: spacing.md, marginTop: spacing.sm }]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${friend.displayName}`}
        >
          <Text style={[typography.body, { color: colors.textTertiary }]}>
            Remove Friend
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  comparisonSection: {},
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
