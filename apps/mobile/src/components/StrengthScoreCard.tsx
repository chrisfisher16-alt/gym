import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Card } from './ui';
import type { StrengthScore, BenchmarkLift } from '../lib/strength-score';

export interface StrengthScoreCardProps {
  score: StrengthScore;
  style?: StyleProp<ViewStyle>;
}

// ── Helpers ──────────────────────────────────────────────────────

function scoreColor(value: number, colors: { gold: string; text: string; error: string }) {
  if (value > 60) return colors.gold;
  if (value >= 30) return colors.text;
  return colors.error;
}

function trendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return 'trending-up';
    case 'down': return 'trending-down';
    case 'stable': return 'remove-outline';
  }
}

function trendColor(
  trend: 'up' | 'down' | 'stable',
  colors: { success: string; error: string; textTertiary: string },
) {
  switch (trend) {
    case 'up': return colors.success;
    case 'down': return colors.error;
    case 'stable': return colors.textTertiary;
  }
}

// ── Category Row ─────────────────────────────────────────────────

function CategoryRow({
  label,
  score,
  trend,
  isLast,
}: {
  label: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  isLast?: boolean;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const tc = trendColor(trend, colors);

  return (
    <View
      style={[
        styles.categoryRow,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
        },
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.categoryLeft}>
        <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
        <View style={[styles.trendBadge, { marginLeft: spacing.sm }]}>
          <Ionicons name={trendIcon(trend) as any} size={14} color={tc} />
        </View>
      </View>
      <View style={styles.categoryRight}>
        <Text style={[typography.label, { color: scoreColor(score, colors) }]}>
          {score}
        </Text>
        <Text style={[typography.micro, { color: colors.textTertiary, marginLeft: 3 }]}>
          mSTR
        </Text>
      </View>
    </View>
  );
}

// ── Benchmark Lift Row ───────────────────────────────────────────

function LiftRow({ lift, isLast }: { lift: BenchmarkLift; isLast?: boolean }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.liftRow,
        { paddingVertical: spacing.sm, paddingHorizontal: spacing.base },
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.liftLeft}>
        <Text style={[typography.bodySmall, { color: colors.text }]} numberOfLines={1}>
          {lift.exerciseName}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {lift.bestWeight} × {lift.bestReps}
        </Text>
      </View>
      <View style={styles.liftRight}>
        <Ionicons
          name={trendIcon(lift.trend) as any}
          size={12}
          color={trendColor(lift.trend, colors)}
          style={{ marginRight: 4 }}
        />
        <Text style={[typography.label, { color: colors.text }]}>
          {lift.estimated1RM}
        </Text>
        <Text style={[typography.micro, { color: colors.textTertiary, marginLeft: 3 }]}>
          e1RM
        </Text>
      </View>
    </View>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const { colors, radius, spacing } = useTheme();
  const pct = Math.min(100, Math.max(0, value));

  return (
    <View
      style={[
        styles.barTrack,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.sm,
          height: 8,
          marginTop: spacing.sm,
        },
      ]}
    >
      <View
        style={[
          styles.barFill,
          {
            backgroundColor: colors.gold,
            borderRadius: radius.sm,
            width: `${pct}%`,
          },
        ]}
      />
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function StrengthScoreCard({ score, style }: StrengthScoreCardProps) {
  const { colors, spacing, typography, radius } = useTheme();

  const hasData = score.benchmarkLifts.length > 0;

  return (
    <Card variant="hero" style={style}>
      {/* Header */}
      <View style={[styles.headerRow, { marginBottom: spacing.base }]}>
        <Text style={[typography.h3, { color: colors.text }]}>Overall Strength</Text>
        <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
      </View>

      {hasData ? (
        <>
          {/* Overall Score */}
          <View style={[styles.scoreRow, { marginBottom: spacing.lg }]}>
            <Text
              style={[
                typography.displayLarge,
                { color: scoreColor(score.overall, colors), marginRight: spacing.md },
              ]}
            >
              {score.overall}
            </Text>
            <View style={{ flex: 1 }}>
              <ScoreBar value={score.overall} />
            </View>
          </View>

          {/* Category Cards */}
          <View
            style={[
              styles.categoriesContainer,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <CategoryRow label="Push Muscles" score={score.push} trend={score.pushTrend} />
            <CategoryRow label="Pull Muscles" score={score.pull} trend={score.pullTrend} />
            <CategoryRow label="Leg Muscles" score={score.legs} trend={score.legsTrend} isLast />
          </View>

          {/* Benchmark Lifts */}
          {score.benchmarkLifts.length > 0 && (
            <>
              <View style={[styles.headerRow, { marginBottom: spacing.sm }]}>
                <Text style={[typography.label, { color: colors.textSecondary }]}>
                  Benchmark Lifts
                </Text>
              </View>
              <View
                style={[
                  styles.liftsContainer,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                  },
                ]}
              >
                {score.benchmarkLifts.map((lift, i) => (
                  <LiftRow
                    key={lift.exerciseId}
                    lift={lift}
                    isLast={i === score.benchmarkLifts.length - 1}
                  />
                ))}
              </View>
            </>
          )}
        </>
      ) : (
        /* Empty State */
        <View style={[styles.emptyState, { paddingVertical: spacing.xl }]}>
          <Ionicons name="barbell-outline" size={32} color={colors.textTertiary} />
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
            ]}
          >
            Your strength score will appear after{'\n'}your first workout with benchmark lifts
          </Text>

          {/* Placeholder categories */}
          <View
            style={[
              styles.categoriesContainer,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                marginTop: spacing.base,
                width: '100%',
              },
            ]}
          >
            <CategoryRow label="Push Muscles" score={0} trend="stable" />
            <CategoryRow label="Pull Muscles" score={0} trend="stable" />
            <CategoryRow label="Leg Muscles" score={0} trend="stable" isLast />
          </View>
        </View>
      )}
    </Card>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesContainer: {
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  trendBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liftsContainer: {
    overflow: 'hidden',
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liftLeft: {
    flex: 1,
    marginRight: 12,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  barTrack: {
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  emptyState: {
    alignItems: 'center',
  },
});
