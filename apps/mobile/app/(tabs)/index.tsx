import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, MacroBar, ProgressBar } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import { CoachFAB } from '../../src/components/CoachFAB';

export default function TodayTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const profile = useAuthStore((s) => s.profile);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <View>
          <Text style={[typography.h1, { color: colors.text }]}>
            {greeting}, {profile?.display_name ?? 'there'}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {dateStr}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <View
            style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderRadius: radius.full }]}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Today's Workout */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.cardHeader}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
            Today&apos;s Workout
          </Text>
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          No workout scheduled for today.
        </Text>
        <TouchableOpacity
          style={[styles.cardAction, { marginTop: spacing.md }]}
          onPress={() => router.push('/(tabs)/workout')}
          activeOpacity={0.7}
        >
          <Text style={[typography.label, { color: colors.primary }]}>Start a workout</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </Card>

      {/* Nutrition Summary */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.cardHeader}>
          <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
            Nutrition
          </Text>
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <View style={styles.calorieRow}>
            <Text style={[typography.displayMedium, { color: colors.text }]}>0</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}> / 2,200 cal</Text>
          </View>
          <ProgressBar progress={0} color={colors.calories} height={8} />
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <MacroBar label="Protein" current={0} target={150} color={colors.protein} />
            <MacroBar label="Carbs" current={0} target={250} color={colors.carbs} />
            <MacroBar label="Fat" current={0} target={70} color={colors.fat} />
          </View>
        </View>
      </Card>

      {/* Coach Tip */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/coach')} activeOpacity={0.7}>
        <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}>
              Coach Tip
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
          <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
            Stay consistent with your workouts and nutrition tracking. Small daily habits lead to big results over time.
          </Text>
          <Text style={[typography.bodySmall, { color: colors.primary, marginTop: spacing.sm }]}>
            Ask Coach for personalized advice
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={[styles.quickActions, { marginBottom: spacing.lg, gap: spacing.sm }]}>
        {[
          { icon: 'barbell-outline' as const, label: 'Log Workout', route: '/(tabs)/workout' as const },
          { icon: 'restaurant-outline' as const, label: 'Log Meal', route: '/(tabs)/nutrition' as const },
          { icon: 'chatbubble-outline' as const, label: 'Ask Coach', route: '/(tabs)/coach' as const },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={() => router.push(action.route)}
            activeOpacity={0.7}
            style={[
              styles.quickActionBtn,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderColor: colors.borderLight,
                padding: spacing.md,
              },
            ]}
          >
            <Ionicons name={action.icon} size={24} color={colors.primary} />
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: spacing.xs }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Recent Activity
        </Text>
        <View
          style={[
            styles.emptyRecent,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing['2xl'],
            },
          ]}
        >
          <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
          <Text style={[typography.body, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            No recent activity yet
          </Text>
        </View>
      </View>
      <CoachFAB context="general" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  quickActions: {
    flexDirection: 'row',
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 72,
    justifyContent: 'center',
  },
  emptyRecent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
