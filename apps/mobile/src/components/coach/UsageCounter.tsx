import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from '../ui';
import { checkWorkoutLogLimit, checkMealLogLimit, type UsageCheck } from '../../lib/usage-limits';

// ── Usage Row ─────────────────────────────────────────────────────────

export function UsageRow({
  icon,
  label,
  used,
  limit,
  resets,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  used: number;
  limit: number;
  resets: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const ratio = limit > 0 ? used / limit : 0;
  const barColor = ratio >= 0.8 ? colors.warning : colors.primary;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name={icon} size={14} color={colors.textSecondary} />
          <Text style={[typography.bodySmall, { color: colors.text }]}>{label}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          {used}/{limit} · resets in {resets}
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: barColor,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  );
}

// ── Usage Counter Expandable ──────────────────────────────────────────

export function UsageCounterExpandable({
  aiUsage,
  onUpgrade,
}: {
  aiUsage: UsageCheck;
  onUpgrade: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [workoutUsage, setWorkoutUsage] = useState<UsageCheck | null>(null);
  const [mealUsage, setMealUsage] = useState<UsageCheck | null>(null);

  useEffect(() => {
    Promise.all([checkWorkoutLogLimit(), checkMealLogLimit()]).then(
      ([wk, ml]) => {
        setWorkoutUsage(wk);
        setMealUsage(ml);
      },
    );
  }, []);

  const formatResetDate = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours <= 24) return `${diffHours}h`;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  };

  return (
    <ExpandableCard
      style={{ borderRadius: 12 }}
      expandedContent={
        <View style={{ gap: spacing.md }}>
          {/* AI Messages */}
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Daily Limits
            </Text>
            <UsageRow
              icon="chatbubble-outline"
              label="AI Messages"
              used={aiUsage.used}
              limit={aiUsage.limit}
              resets={formatResetDate(aiUsage.resetDate)}
            />
            {mealUsage && (
              <UsageRow
                icon="restaurant-outline"
                label="Meal Logs"
                used={mealUsage.used}
                limit={mealUsage.limit}
                resets={formatResetDate(mealUsage.resetDate)}
              />
            )}
          </View>

          {/* Monthly Limits */}
          {workoutUsage && (
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                Monthly Limits
              </Text>
              <UsageRow
                icon="barbell-outline"
                label="Workout Logs"
                used={workoutUsage.used}
                limit={workoutUsage.limit}
                resets={formatResetDate(workoutUsage.resetDate)}
              />
            </View>
          )}

          {/* Tips */}
          <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Tip: Be specific with your questions to get the most out of each message.
            </Text>
          </View>

          {/* Upgrade CTA */}
          <TouchableOpacity
            onPress={onUpgrade}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.label, { color: colors.textInverse }]}>
              Upgrade for Unlimited
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Collapsed: usage badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text
          style={[
            typography.caption,
            {
              color: aiUsage.remaining <= 1 ? colors.warning : colors.textSecondary,
              fontWeight: '600',
            },
          ]}
        >
          {aiUsage.remaining}/{aiUsage.limit} left
        </Text>
        <Ionicons
          name="chevron-down-outline"
          size={10}
          color={aiUsage.remaining <= 1 ? colors.warning : colors.textTertiary}
        />
      </View>
    </ExpandableCard>
  );
}
