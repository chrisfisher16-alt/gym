import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useChallengeStore } from '../../../src/stores/challenge-store';
import { useFriendsStore } from '../../../src/stores/friends-store';
import { successNotification, lightImpact } from '../../../src/lib/haptics';
import type { ChallengeMetric } from '../../../../../packages/shared/src/types/compete';
import type { CreateChallengeInput } from '../../../../../packages/shared/src/schemas/compete';

// ── Constants ──────────────────────────────────────────────────────────

const METRICS: { key: ChallengeMetric; label: string; icon: string; description: string }[] = [
  { key: 'volume', label: 'Volume', icon: 'barbell-outline', description: 'Total weight lifted' },
  { key: 'workouts', label: 'Workouts', icon: 'fitness-outline', description: 'Number of sessions' },
  { key: 'streak', label: 'Streak', icon: 'flame-outline', description: 'Consecutive days' },
  { key: 'prs', label: 'PRs', icon: 'trophy-outline', description: 'Personal records hit' },
  { key: 'consistency', label: 'Consistency', icon: 'calendar-outline', description: 'Days active per week' },
];

type DurationOption = { label: string; days: number };
const DURATIONS: DurationOption[] = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
];

// ── Component ──────────────────────────────────────────────────────────

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography, dark } = useTheme();
  const goldColor = dark ? '#CFAE80' : '#B8944F';

  const { createChallenge } = useChallengeStore();
  const { friends } = useFriendsStore();

  // ── Step state ────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<ChallengeMetric | null>(null);
  const [title, setTitle] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [customDays, setCustomDays] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────
  const effectiveDays = useCustom ? parseInt(customDays, 10) || 0 : durationDays;

  const canProceedStep0 = selectedMetric !== null;
  const canProceedStep1 = title.trim().length > 0 && effectiveDays > 0 && selectedFriendIds.size > 0;

  const selectedFriendsList = useMemo(
    () => friends.filter((f) => selectedFriendIds.has(f.friend.id)),
    [friends, selectedFriendIds],
  );

  const toggleFriend = useCallback((id: string) => {
    lightImpact();
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const handleNext = useCallback(() => {
    lightImpact();
    setStep((s) => s + 1);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedMetric) return;
    setIsSubmitting(true);

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + effectiveDays);

    const input: CreateChallengeInput = {
      title: title.trim(),
      metric: selectedMetric,
      startsAt: now.toISOString(),
      endsAt: end.toISOString(),
      participantIds: Array.from(selectedFriendIds),
    };

    const { error } = await createChallenge(input);
    setIsSubmitting(false);

    if (!error) {
      successNotification();
      router.back();
    }
  }, [selectedMetric, title, effectiveDays, selectedFriendIds, createChallenge, router]);

  // ── Step indicator ────────────────────────────────────────────────
  const StepIndicator = () => (
    <View style={[styles.stepRow, { gap: spacing.sm, marginBottom: spacing.lg }]}>
      {['Metric', 'Configure', 'Confirm'].map((label, i) => (
        <View key={label} style={[styles.stepItem, { gap: spacing.xs }]}>
          <View
            style={[
              styles.stepDot,
              {
                width: 28,
                height: 28,
                borderRadius: radius.full,
                backgroundColor: i <= step ? goldColor : colors.surfaceSecondary,
              },
            ]}
          >
            {i < step ? (
              <Ionicons name="checkmark" size={14} color={dark ? '#1A1A1A' : '#FFFFFF'} />
            ) : (
              <Text
                style={[
                  typography.labelSmall,
                  { color: i === step ? (dark ? '#1A1A1A' : '#FFFFFF') : colors.textTertiary },
                ]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          <Text
            style={[
              typography.labelSmall,
              { color: i <= step ? colors.text : colors.textTertiary },
            ]}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );

  // ── Step 0: Select Metric ─────────────────────────────────────────
  const renderMetricStep = () => (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.h2, { color: colors.text }]}>Choose a Metric</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        What do you want to compete on?
      </Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {METRICS.map((m) => {
          const isSelected = selectedMetric === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => {
                lightImpact();
                setSelectedMetric(m.key);
              }}
              activeOpacity={0.7}
              style={[
                styles.metricCard,
                {
                  backgroundColor: isSelected
                    ? dark
                      ? 'rgba(207, 174, 128, 0.15)'
                      : 'rgba(184, 148, 79, 0.12)'
                    : colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.base,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected ? goldColor : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${m.label} metric`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={[styles.metricIcon, { backgroundColor: isSelected ? goldColor : colors.surfaceSecondary, borderRadius: radius.md, width: 40, height: 40 }]}>
                <Ionicons
                  name={m.icon as any}
                  size={20}
                  color={isSelected ? (dark ? '#1A1A1A' : '#FFFFFF') : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.label, { color: colors.text }]}>{m.label}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {m.description}
                </Text>
              </View>
              {isSelected && <Ionicons name="checkmark-circle" size={22} color={goldColor} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Step 1: Configure ─────────────────────────────────────────────
  const renderConfigureStep = () => (
    <View style={{ gap: spacing.lg }}>
      <Text style={[typography.h2, { color: colors.text }]}>Configure Challenge</Text>

      {/* Title */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>Challenge Title</Text>
        <TextInput
          style={[
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.base,
              minHeight: 48,
            },
          ]}
          placeholder={`e.g. ${selectedMetric === 'volume' ? 'Volume War' : selectedMetric === 'streak' ? 'Streak Showdown' : 'Weekly Challenge'}`}
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          autoCapitalize="words"
        />
      </View>

      {/* Duration */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>Duration</Text>
        <View style={[styles.durationRow, { gap: spacing.sm }]}>
          {DURATIONS.map((d) => {
            const isSelected = !useCustom && durationDays === d.days;
            return (
              <TouchableOpacity
                key={d.days}
                onPress={() => {
                  lightImpact();
                  setUseCustom(false);
                  setDurationDays(d.days);
                }}
                style={[
                  styles.durationChip,
                  {
                    backgroundColor: isSelected ? goldColor : colors.surface,
                    borderRadius: radius.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderWidth: 1,
                    borderColor: isSelected ? goldColor : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    typography.label,
                    { color: isSelected ? (dark ? '#1A1A1A' : '#FFFFFF') : colors.text },
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              lightImpact();
              setUseCustom(true);
            }}
            style={[
              styles.durationChip,
              {
                backgroundColor: useCustom ? goldColor : colors.surface,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderWidth: 1,
                borderColor: useCustom ? goldColor : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: useCustom }}
          >
            <Text
              style={[
                typography.label,
                { color: useCustom ? (dark ? '#1A1A1A' : '#FFFFFF') : colors.text },
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {useCustom && (
          <View style={[styles.customRow, { gap: spacing.sm, marginTop: spacing.xs }]}>
            <TextInput
              style={[
                typography.body,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.sm,
                  width: 80,
                  textAlign: 'center',
                },
              ]}
              placeholder="Days"
              placeholderTextColor={colors.textTertiary}
              value={customDays}
              onChangeText={setCustomDays}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[typography.body, { color: colors.textSecondary }]}>days</Text>
          </View>
        )}
      </View>

      {/* Friend Selection */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.textSecondary }]}>
          Invite Friends ({selectedFriendIds.size} selected)
        </Text>
        {friends.length === 0 ? (
          <View
            style={[
              styles.emptyFriends,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.lg,
              },
            ]}
          >
            <Ionicons name="people-outline" size={24} color={colors.textTertiary} />
            <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              No friends added yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {friends.map((f) => {
              const isSelected = selectedFriendIds.has(f.friend.id);
              return (
                <TouchableOpacity
                  key={f.friend.id}
                  onPress={() => toggleFriend(f.friend.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.friendRow,
                    {
                      backgroundColor: isSelected
                        ? dark
                          ? 'rgba(207, 174, 128, 0.1)'
                          : 'rgba(184, 148, 79, 0.08)'
                        : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: isSelected ? goldColor : colors.border,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`Select ${f.friend.displayName}`}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: isSelected ? goldColor : colors.primaryMuted,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.label,
                        {
                          color: isSelected ? (dark ? '#1A1A1A' : '#FFFFFF') : colors.primary,
                        },
                      ]}
                    >
                      {f.friend.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                    {f.friend.displayName}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? goldColor : colors.textTertiary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );

  // ── Step 2: Confirm ───────────────────────────────────────────────
  const selectedMetricInfo = METRICS.find((m) => m.key === selectedMetric);
  const durationLabel = useCustom
    ? `${effectiveDays} days`
    : DURATIONS.find((d) => d.days === durationDays)?.label ?? `${durationDays} days`;

  const renderConfirmStep = () => (
    <View style={{ gap: spacing.lg }}>
      <Text style={[typography.h2, { color: colors.text }]}>Review Challenge</Text>

      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.base,
          },
        ]}
      >
        {/* Title */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>TITLE</Text>
          <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
        </View>

        {/* Metric */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>METRIC</Text>
          <View style={styles.summaryRow}>
            <Ionicons name={selectedMetricInfo?.icon as any} size={18} color={goldColor} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
              {selectedMetricInfo?.label}
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>DURATION</Text>
          <View style={styles.summaryRow}>
            <Ionicons name="time-outline" size={18} color={goldColor} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
              {durationLabel}
            </Text>
          </View>
        </View>

        {/* Participants */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
            PARTICIPANTS ({selectedFriendsList.length})
          </Text>
          {selectedFriendsList.map((f) => (
            <View key={f.friend.id} style={styles.summaryRow}>
              <View
                style={[
                  styles.avatarSmall,
                  { backgroundColor: colors.primaryMuted, borderRadius: radius.full },
                ]}
              >
                <Text style={[typography.labelSmall, { color: colors.primary }]}>
                  {f.friend.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                {f.friend.displayName}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ── Layout ────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Close' : 'Go back'}
        >
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text, flex: 1, textAlign: 'center' }]}>
          New Challenge
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.base }}>
        <StepIndicator />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { padding: spacing.base, paddingBottom: spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && renderMetricStep()}
        {step === 1 && renderConfigureStep()}
        {step === 2 && renderConfirmStep()}
      </ScrollView>

      {/* Footer Button */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {step < 2 ? (
          <TouchableOpacity
            onPress={handleNext}
            disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
            style={[
              styles.primaryButton,
              {
                backgroundColor: (step === 0 ? canProceedStep0 : canProceedStep1)
                  ? goldColor
                  : colors.surfaceSecondary,
                borderRadius: radius.lg,
                paddingVertical: spacing.base,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue to next step"
          >
            <Text
              style={[
                typography.label,
                {
                  color: (step === 0 ? canProceedStep0 : canProceedStep1)
                    ? dark ? '#1A1A1A' : '#FFFFFF'
                    : colors.textTertiary,
                },
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[
              styles.primaryButton,
              {
                backgroundColor: goldColor,
                borderRadius: radius.lg,
                paddingVertical: spacing.base,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start challenge"
          >
            {isSubmitting ? (
              <ActivityIndicator color={dark ? '#1A1A1A' : '#FFFFFF'} />
            ) : (
              <Text style={[typography.label, { color: dark ? '#1A1A1A' : '#FFFFFF' }]}>
                🚀 Start Challenge
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  stepItem: { alignItems: 'center' },
  stepDot: { alignItems: 'center', justifyContent: 'center' },
  metricCard: { flexDirection: 'row', alignItems: 'center' },
  metricIcon: { alignItems: 'center', justifyContent: 'center' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap' },
  durationChip: { alignItems: 'center', justifyContent: 'center' },
  customRow: { flexDirection: 'row', alignItems: 'center' },
  friendRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyFriends: { alignItems: 'center' },
  summaryCard: {},
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  footer: {},
  primaryButton: { alignItems: 'center', justifyContent: 'center' },
});
