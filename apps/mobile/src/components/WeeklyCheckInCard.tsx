import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Card } from './ui';
import {
  generateWeeklySummary,
  getLastWeekStart,
  isWeeklySummaryDismissed,
  dismissWeeklySummary,
  type WeeklySummary,
} from '../lib/weekly-summary';

interface WeeklyCheckInCardProps {
  onViewDetails?: (summary: WeeklySummary) => void;
}

export function WeeklyCheckInCard({ onViewDetails }: WeeklyCheckInCardProps) {
  const { colors, spacing, typography, radius } = useTheme();

  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const weekStart = getLastWeekStart();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isDismissed = await isWeeklySummaryDismissed(weekStart);
      if (isDismissed) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      try {
        const result = await generateWeeklySummary();
        if (!cancelled) setSummary(result);
      } catch {
        // Silently fail — card just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [weekStart]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    await dismissWeeklySummary(weekStart);
  }, [weekStart]);

  // Don't render if dismissed or still loading with no data
  if (dismissed) return null;
  if (loading) {
    return (
      <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[typography.bodySmall, { color: colors.primary, marginLeft: spacing.sm }]}>
            Preparing your weekly check-in...
          </Text>
        </View>
      </Card>
    );
  }
  if (!summary) return null;

  return (
    <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.textInverse} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>Weekly Check-in</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Week of {new Date(summary.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={[styles.statsGrid, { marginTop: spacing.md, gap: spacing.sm }]}>
        <StatCell
          label="Workouts"
          value={String(summary.workoutsCompleted)}
          icon="barbell-outline"
          colors={colors}
          spacing={spacing}
          typography={typography}
          radius={radius}
        />
        <StatCell
          label="Volume"
          value={summary.totalVolume >= 1000 ? `${(summary.totalVolume / 1000).toFixed(1)}t` : `${summary.totalVolume}kg`}
          icon="trending-up-outline"
          colors={colors}
          spacing={spacing}
          typography={typography}
          radius={radius}
        />
        <StatCell
          label="PRs"
          value={String(summary.prsHit)}
          icon="trophy-outline"
          colors={colors}
          spacing={spacing}
          typography={typography}
          radius={radius}
        />
        <StatCell
          label="Adherence"
          value={`${Math.round(summary.nutritionAdherence * 100)}%`}
          icon="nutrition-outline"
          colors={colors}
          spacing={spacing}
          typography={typography}
          radius={radius}
        />
      </View>

      {/* AI Insight */}
      <View
        style={[
          styles.insightBox,
          { marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
        ]}
      >
        <View style={styles.insightHeader}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, marginLeft: 4, fontWeight: '600' }]}>
            AI Insight
          </Text>
        </View>
        <Text
          style={[typography.bodySmall, { color: colors.text, marginTop: spacing.xs }]}
          numberOfLines={expanded ? undefined : 3}
        >
          {summary.aiInsight}
        </Text>
        {summary.aiInsight.length > 120 && (
          <TouchableOpacity onPress={() => setExpanded(!expanded)}>
            <Text style={[typography.caption, { color: colors.primary, marginTop: 2 }]}>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions */}
      {onViewDetails && (
        <TouchableOpacity
          style={[styles.detailsBtn, { marginTop: spacing.md }]}
          onPress={() => onViewDetails(summary)}
          activeOpacity={0.7}
        >
          <Text style={[typography.label, { color: colors.primary }]}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ── StatCell ──────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  icon,
  colors,
  spacing,
  typography,
  radius,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: any;
  spacing: any;
  typography: any;
  radius: any;
}) {
  return (
    <View
      style={[
        styles.statCell,
        { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
      ]}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[typography.h3, { color: colors.text, marginTop: 2 }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  insightBox: {},
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
