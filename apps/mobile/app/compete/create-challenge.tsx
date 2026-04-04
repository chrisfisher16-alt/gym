import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useChallengeStore } from '../../src/stores/challenge-store';
import { useFriendsStore } from '../../src/stores/friends-store';
import { createChallengeSchema } from '../../../../packages/shared/src/schemas/compete';
import { selectionFeedback, mediumImpact, successNotification } from '../../src/lib/haptics';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { Button } from '../../src/components/ui';
import type { ChallengeMetric } from '../../../../packages/shared/src/types/compete';

// ── Constants ───────────────────────────────────────────────────────

const METRICS: { key: ChallengeMetric; icon: keyof typeof Ionicons.glyphMap; label: string; desc: string }[] = [
  { key: 'volume', icon: 'barbell-outline', label: 'Volume', desc: 'Total weight lifted' },
  { key: 'workouts', icon: 'fitness-outline', label: 'Workouts', desc: 'Number of sessions' },
  { key: 'streak', icon: 'flame-outline', label: 'Streak', desc: 'Consecutive workout days' },
  { key: 'prs', icon: 'trophy-outline', label: 'PRs', desc: 'Personal records hit' },
  { key: 'consistency', icon: 'calendar-outline', label: 'Consistency', desc: 'Days trained per week' },
];

const DURATIONS: { label: string; days: number }[] = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
];

// ── Component ───────────────────────────────────────────────────────

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const createChallenge = useChallengeStore((s) => s.createChallenge);
  const friends = useFriendsStore((s) => s.friends);

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedMetric, setSelectedMetric] = useState<ChallengeMetric | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Derived
  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return friends;
    const q = friendSearch.toLowerCase();
    return friends.filter((f) => f.friend.displayName.toLowerCase().includes(q));
  }, [friends, friendSearch]);

  const autoTitle = useMemo(() => {
    if (!selectedMetric || selectedDuration == null) return '';
    const metricLabel = METRICS.find((m) => m.key === selectedMetric)?.label ?? selectedMetric;
    const durationLabel = DURATIONS.find((d) => d.days === selectedDuration)?.label ?? `${selectedDuration}d`;
    return `${metricLabel} Challenge - ${durationLabel}`;
  }, [selectedMetric, selectedDuration]);

  const canAdvance = useCallback(() => {
    switch (step) {
      case 1: return selectedMetric !== null;
      case 2: return selectedDuration !== null;
      case 3: return selectedFriendIds.size > 0;
      default: return true;
    }
  }, [step, selectedMetric, selectedDuration, selectedFriendIds]);

  const handleNext = useCallback(() => {
    if (!canAdvance()) return;
    mediumImpact();
    if (step === 3 && !title) {
      setTitle(autoTitle);
    }
    setStep((s) => Math.min(s + 1, 4));
  }, [canAdvance, step, title, autoTitle]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const toggleFriend = useCallback((friendId: string) => {
    selectionFeedback();
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedMetric || selectedDuration == null || selectedFriendIds.size === 0) return;

    const now = new Date();
    const startsAt = now.toISOString();
    const endsAt = new Date(now.getTime() + selectedDuration * 24 * 60 * 60 * 1000).toISOString();
    const finalTitle = title.trim() || autoTitle;

    const input = {
      title: finalTitle,
      metric: selectedMetric,
      startsAt,
      endsAt,
      participantIds: Array.from(selectedFriendIds),
    };

    // Validate with Zod
    const result = createChallengeSchema.safeParse(input);
    if (!result.success) {
      crossPlatformAlert('Validation Error', result.error.issues.map((i) => i.message).join('\n'));
      return;
    }

    setCreating(true);
    mediumImpact();

    const { error } = await createChallenge(result.data);
    setCreating(false);

    if (error) {
      crossPlatformAlert('Error', error);
      return;
    }

    successNotification();
    router.back();
  }, [selectedMetric, selectedDuration, selectedFriendIds, title, autoTitle, createChallenge, router]);

  // ── Step Indicator ──────────────────────────────────────────────

  const renderStepIndicator = () => (
    <View style={[styles.stepRow, { marginBottom: spacing.lg }]}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            {
              backgroundColor: s <= step ? colors.primary : colors.border,
              width: s === step ? 24 : 8,
              borderRadius: radius.full,
            },
          ]}
        />
      ))}
    </View>
  );

  // ── Step 1: Metric ─────────────────────────────────────────────

  const renderMetricStep = () => (
    <View>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
        Choose a Metric
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        What will you compete on?
      </Text>
      <View style={styles.cardGrid}>
        {METRICS.map((m) => {
          const selected = selectedMetric === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => {
                selectionFeedback();
                setSelectedMetric(m.key);
              }}
              style={[
                styles.metricCard,
                {
                  backgroundColor: selected ? colors.primaryMuted : colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: selected ? colors.gold : colors.border,
                  padding: spacing.base,
                },
              ]}
            >
              <Ionicons
                name={m.icon}
                size={28}
                color={selected ? colors.gold : colors.textSecondary}
              />
              <Text
                style={[
                  typography.label,
                  { color: selected ? colors.text : colors.textSecondary, marginTop: spacing.sm },
                ]}
              >
                {m.label}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
                ]}
              >
                {m.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // ── Step 2: Duration ───────────────────────────────────────────

  const renderDurationStep = () => (
    <View>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
        Set Duration
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        How long should the challenge run?
      </Text>
      {DURATIONS.map((d) => {
        const selected = selectedDuration === d.days;
        return (
          <Pressable
            key={d.days}
            onPress={() => {
              selectionFeedback();
              setSelectedDuration(d.days);
            }}
            style={[
              styles.durationCard,
              {
                backgroundColor: selected ? colors.primaryMuted : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: selected ? colors.gold : colors.border,
                padding: spacing.base,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.gold : colors.textTertiary}
            />
            <Text
              style={[
                typography.labelLarge,
                { color: selected ? colors.text : colors.textSecondary, marginLeft: spacing.md },
              ]}
            >
              {d.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ── Step 3: Participants ───────────────────────────────────────

  const renderParticipantsStep = () => (
    <View>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
        Invite Friends
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Select at least one friend to challenge.
      </Text>

      {/* Search */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.base,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm, paddingVertical: spacing.sm }]}
          placeholder="Search friends..."
          placeholderTextColor={colors.textTertiary}
          value={friendSearch}
          onChangeText={setFriendSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {filteredFriends.length === 0 ? (
        <Text style={[typography.body, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl }]}>
          {friends.length === 0 ? 'No friends yet. Add some friends first!' : 'No friends match your search.'}
        </Text>
      ) : (
        filteredFriends.map((f) => {
          const checked = selectedFriendIds.has(f.friend.id);
          return (
            <Pressable
              key={f.friend.id}
              onPress={() => toggleFriend(f.friend.id)}
              style={[
                styles.friendRow,
                {
                  backgroundColor: checked ? colors.primaryMuted : colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: checked ? colors.gold : colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.textSecondary }]}>
                  {f.friend.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                {f.friend.displayName}
              </Text>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? colors.gold : colors.textTertiary}
              />
            </Pressable>
          );
        })
      )}
    </View>
  );

  // ── Step 4: Review ─────────────────────────────────────────────

  const renderReviewStep = () => {
    const metricLabel = METRICS.find((m) => m.key === selectedMetric)?.label ?? '';
    const durationLabel = DURATIONS.find((d) => d.days === selectedDuration)?.label ?? '';
    const participantNames = friends
      .filter((f) => selectedFriendIds.has(f.friend.id))
      .map((f) => f.friend.displayName);

    return (
      <View>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.lg }]}>
          Review Challenge
        </Text>

        {/* Title */}
        <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
          Title
        </Text>
        <TextInput
          style={[
            typography.bodyLarge,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder={autoTitle}
          placeholderTextColor={colors.textTertiary}
        />

        {/* Summary cards */}
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
          <SummaryRow icon="speedometer-outline" label="Metric" value={metricLabel} colors={colors} typography={typography} spacing={spacing} />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
          <SummaryRow icon="time-outline" label="Duration" value={durationLabel} colors={colors} typography={typography} spacing={spacing} />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
          <SummaryRow
            icon="people-outline"
            label="Participants"
            value={`${participantNames.length} friend${participantNames.length !== 1 ? 's' : ''}`}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
        </View>

        {/* Participant list */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {participantNames.map((name) => (
            <View
              key={name}
              style={{
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              <Text style={[typography.labelSmall, { color: colors.primary }]}>{name}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ── Main Render ────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={[typography.h3, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Create Challenge
        </Text>
        <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
          {step} / 4
        </Text>
      </View>

      {renderStepIndicator()}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && renderMetricStep()}
        {step === 2 && renderDurationStep()}
        {step === 3 && renderParticipantsStep()}
        {step === 4 && renderReviewStep()}
      </ScrollView>

      {/* Bottom CTA */}
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
        {step < 4 ? (
          <Button
            title="Next"
            onPress={handleNext}
            disabled={!canAdvance()}
          />
        ) : (
          <Button
            title={creating ? 'Creating...' : 'Create Challenge'}
            onPress={handleCreate}
            loading={creating}
            disabled={creating}
            icon={
              !creating ? (
                <Ionicons name="trophy" size={18} color={colors.textInverse} style={{ marginRight: 6 }} />
              ) : undefined
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Summary Row ──────────────────────────────────────────────────

function SummaryRow({
  icon,
  label,
  value,
  colors,
  typography: typo,
  spacing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[typo.label, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>
        {label}
      </Text>
      <Text style={[typo.label, { color: colors.text }]}>{value}</Text>
    </View>
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stepDot: {
    height: 8,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47%',
    alignItems: 'center',
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
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
