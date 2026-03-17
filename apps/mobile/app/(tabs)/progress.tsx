import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, EmptyState } from '../../src/components/ui';
import { useHealthStore } from '../../src/stores/health-store';
import { getHealthProviderName } from '../../src/lib/health';
import { CoachFAB } from '../../src/components/CoachFAB';

export default function ProgressTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const isHealthConnected = useHealthStore((s) => s.isConnected);
  const todaySteps = useHealthStore((s) => s.todaySteps);
  const recentWeight = useHealthStore((s) => s.recentWeight);
  const todayActiveEnergy = useHealthStore((s) => s.todayActiveEnergy);
  const syncEnabled = useHealthStore((s) => s.syncEnabled);

  const providerLabel = getHealthProviderName();
  const showHealthData = isHealthConnected && Platform.OS !== 'web';

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

      {/* Health Activity Summary */}
      {showHealthData && (syncEnabled.steps || syncEnabled.activeEnergy) && (
        <View style={{ marginBottom: spacing.lg }}>
          <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
            <Text style={[typography.h3, { color: colors.text }]}>Activity</Text>
            {providerLabel && (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                via {providerLabel}
              </Text>
            )}
          </View>
          <Card>
            <View style={[styles.activityGrid, { gap: spacing.md }]}>
              {syncEnabled.steps && (
                <View style={styles.activityItem}>
                  <View style={styles.activityLabel}>
                    <Ionicons name="footsteps-outline" size={16} color={colors.primary} />
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      Steps Today
                    </Text>
                  </View>
                  <Text style={[typography.h2, { color: colors.text }]}>
                    {todaySteps.toLocaleString()}
                  </Text>
                </View>
              )}
              {syncEnabled.activeEnergy && (
                <View style={styles.activityItem}>
                  <View style={styles.activityLabel}>
                    <Ionicons name="flame-outline" size={16} color={colors.warning} />
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      Active Calories
                    </Text>
                  </View>
                  <Text style={[typography.h2, { color: colors.text }]}>
                    {todayActiveEnergy.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

      {/* Weight Trend */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Weight Trend
        </Text>
        <Card>
          {showHealthData && syncEnabled.bodyWeight && recentWeight ? (
            <View>
              <View style={styles.weightRow}>
                <View>
                  <Text style={[typography.displayMedium, { color: colors.text }]}>
                    {recentWeight} kg
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    via {providerLabel}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.chartPlaceholder,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    height: 140,
                    marginTop: spacing.md,
                  },
                ]}
              >
                <Ionicons name="analytics-outline" size={32} color={colors.textTertiary} />
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                  Chart coming soon
                </Text>
              </View>
            </View>
          ) : (
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
          )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCard: {
    alignItems: 'center',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityItem: {
    flex: 1,
    minWidth: 120,
  },
  activityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
