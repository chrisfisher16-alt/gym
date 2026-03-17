import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, EmptyState } from '../../src/components/ui';
import { CoachFAB } from '../../src/components/CoachFAB';

export default function ProgressTab() {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Progress</Text>
      </View>

      {/* Stats Overview */}
      <View style={[styles.statsRow, { marginBottom: spacing.base, gap: spacing.sm }]}>
        {[
          { label: 'Workouts', value: '0', icon: 'barbell-outline' as const },
          { label: 'Streak', value: '0 days', icon: 'flame-outline' as const },
          { label: 'Meals Logged', value: '0', icon: 'restaurant-outline' as const },
        ].map((stat) => (
          <Card key={stat.label} style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name={stat.icon} size={20} color={colors.primary} />
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
              {stat.value}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {stat.label}
            </Text>
          </Card>
        ))}
      </View>

      {/* Charts Placeholder */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Weight Trend
        </Text>
        <Card>
          <View
            style={[
              styles.chartPlaceholder,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                height: 180,
              },
            ]}
          >
            <Ionicons name="analytics-outline" size={40} color={colors.textTertiary} />
            <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              Chart will appear here
            </Text>
          </View>
        </Card>
      </View>

      {/* Personal Records */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Personal Records
        </Text>
        <EmptyState
          icon="trophy-outline"
          title="No PRs Yet"
          description="Complete workouts to start tracking your personal records."
        />
      </View>

      {/* Ask Coach */}
      <CoachFAB context="progress" label="Analyze My Progress" prefilledMessage="Analyze my progress this week" />

      {/* Body Measurements */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Body Measurements
        </Text>
        <EmptyState
          icon="body-outline"
          title="No Measurements"
          description="Track your body measurements to see your progress over time."
          actionLabel="Add Measurement"
          onAction={() => {}}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCard: {
    alignItems: 'center',
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
