import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, ProgressBar, LoadingSpinner } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { CoachFAB } from '../../src/components/CoachFAB';
import {
  isDemoMode,
  DEMO_STREAK,
  getDemoTodayNutrition,
  DEMO_NUTRITION_TARGETS,
} from '../../src/lib/demo-mode';
import { generateDailyBriefing, cacheBriefing } from '../../src/lib/daily-briefing';

// ── AI Insight type ───────────────────────────────────────────────────
interface AIInsight {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  message: string;
}

export default function TodayTab() {
  const { colors, spacing, typography, radius, dark } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  const { recentWorkouts, totalWorkouts, weeklyVolume, history } = useWorkoutHistory();
  const { targets, consumed, progress, waterIntake } = useNutritionDashboard();
  const { activeProgram, getTodayWorkout, programs } = useWorkoutPrograms();

  const demo = isDemoMode();
  const demoNutrition = useMemo(() => (demo ? getDemoTodayNutrition() : null), [demo]);

  // ── Date & greeting ─────────────────────────────────────────────────
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ── Nutrition display values ────────────────────────────────────────
  const displayConsumed = demo && demoNutrition ? demoNutrition.consumed : consumed;
  const displayTargets = demo ? DEMO_NUTRITION_TARGETS : targets;
  const displayWater = demo ? 1800 : waterIntake;

  const calProgress = displayTargets.calories > 0 ? displayConsumed.calories / displayTargets.calories : 0;
  const proteinProgress = displayTargets.protein_g > 0 ? displayConsumed.protein_g / displayTargets.protein_g : 0;
  const waterProgress = displayTargets.water_ml > 0 ? displayWater / displayTargets.water_ml : 0;

  // ── Streak calculation ──────────────────────────────────────────────
  const streak = useMemo(() => {
    if (demo) return DEMO_STREAK.currentStreak;
    if (totalWorkouts === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const hasWorkout = weeklyVolume.some((v) => v.date === dateKey && v.volume > 0);
      const hasRecent = recentWorkouts.some(
        (w) => new Date(w.completedAt).toISOString().split('T')[0] === dateKey,
      );
      if (hasWorkout || hasRecent) {
        count++;
      } else if (i > 0) {
        break;
      }
    }
    return count;
  }, [demo, totalWorkouts, weeklyVolume, recentWorkouts]);

  // ── Workouts this week ──────────────────────────────────────────────
  const workoutsThisWeek = useMemo(() => {
    if (demo) return 5;
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    return history.filter((w) => new Date(w.completedAt) >= startOfWeek).length;
  }, [demo, history]);

  // ── Completed programs count ────────────────────────────────────────
  const completedPrograms = useMemo(() => {
    if (demo) return 2;
    return programs.filter((p) => !p.isActive).length;
  }, [demo, programs]);

  // ── Daily Briefing ──────────────────────────────────────────────────
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);

  const loadBriefing = useCallback(async (forceRefresh = false) => {
    setBriefingLoading(true);
    try {
      if (forceRefresh) {
        const today = new Date().toISOString().split('T')[0];
        await cacheBriefing(today, '');
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem(`@briefing/${today}`);
      }
      const text = await generateDailyBriefing();
      setBriefing(text);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  // ── Today's Workout State ───────────────────────────────────────────
  const todayWorkout = activeProgram ? getTodayWorkout() : null;

  const todayCompletedWorkout = useMemo(() => {
    if (demo) return null; // demo shows scheduled workout
    const todayStr = new Date().toISOString().split('T')[0];
    return history.find(
      (w) => new Date(w.completedAt).toISOString().split('T')[0] === todayStr,
    ) ?? null;
  }, [demo, history]);

  // ── AI Insights ─────────────────────────────────────────────────────
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  const insights: AIInsight[] = useMemo(() => {
    const items: AIInsight[] = [];

    // Check protein under target for multiple days
    if (demo || proteinProgress < 0.7) {
      items.push({
        id: 'protein-low',
        icon: 'alert-circle-outline',
        iconColor: colors.warning,
        message:
          demo
            ? "You've been under on protein 3 days in a row. Try adding a shake post-workout."
            : `Protein is at ${Math.round(proteinProgress * 100)}% today. Aim for at least a shake or chicken breast to close the gap.`,
      });
    }

    // Check workout streak / consecutive training
    if (streak >= 4) {
      items.push({
        id: 'recovery-hint',
        icon: 'leaf-outline',
        iconColor: colors.success,
        message: `${streak} days training straight — impressive! Consider stretching or a rest day soon to let muscles recover.`,
      });
    }

    // Volume trend
    if (demo) {
      items.push({
        id: 'volume-up',
        icon: 'trending-up-outline',
        iconColor: colors.info,
        message: 'Your bench press is up 15% this month. Progressive overload is working!',
      });
    } else if (totalWorkouts >= 4) {
      const recentVolume = history.slice(0, 3).reduce((sum, w) => sum + w.totalVolume, 0);
      const olderVolume = history.slice(3, 6).reduce((sum, w) => sum + w.totalVolume, 0);
      if (olderVolume > 0 && recentVolume > olderVolume * 1.1) {
        items.push({
          id: 'volume-up',
          icon: 'trending-up-outline',
          iconColor: colors.info,
          message: `Training volume is up ${Math.round(((recentVolume - olderVolume) / olderVolume) * 100)}% recently. Great progress!`,
        });
      }
    }

    // Hydration nudge
    if (waterProgress < 0.5 && now.getHours() >= 14) {
      items.push({
        id: 'hydration',
        icon: 'water-outline',
        iconColor: colors.info,
        message: `You're only at ${Math.round(waterProgress * 100)}% of your water goal. Time to hydrate!`,
      });
    }

    return items.filter((i) => !dismissedInsights.has(i.id)).slice(0, 3);
  }, [
    demo, proteinProgress, streak, totalWorkouts, history,
    waterProgress, now, dismissedInsights, colors,
  ]);

  const dismissInsight = useCallback((id: string) => {
    setDismissedInsights((prev) => new Set(prev).add(id));
  }, []);

  // ── Gradient colors ─────────────────────────────────────────────────
  const heroGradient = dark
    ? [colors.primaryMuted, colors.surface] as const
    : [colors.primaryMuted, colors.background] as const;

  // ── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner fullScreen message="Loading your dashboard..." />
      </ScreenContainer>
    );
  }

  const displayName = profile?.display_name ?? 'there';

  return (
    <ScreenContainer padded={false}>
      {/* ── Hero Coaching Statement ──────────────────────────────────── */}
      <LinearGradient colors={heroGradient} style={styles.heroGradient}>
        <View style={[styles.heroContent, { paddingHorizontal: spacing.base }]}>
          {/* Top row: greeting + settings */}
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {dateStr}
              </Text>
              <Text style={[typography.h1, { color: colors.text, marginTop: spacing.xs }]}>
                {greeting}, {displayName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
              style={[styles.avatarBtn, { backgroundColor: colors.surface, borderRadius: radius.full }]}
            >
              <Ionicons name="person" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* AI Coaching Message */}
          <View style={[styles.coachingCard, {
            backgroundColor: dark ? colors.surface : colors.surface,
            borderRadius: radius.lg,
            marginTop: spacing.lg,
            padding: spacing.base,
            shadowColor: colors.shadow,
          }]}>
            <View style={styles.coachingHeader}>
              <View style={[styles.sparkleIcon, { backgroundColor: colors.primaryMuted, borderRadius: radius.md }]}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}>
                YOUR DAILY COACHING
              </Text>
              <TouchableOpacity
                onPress={() => loadBriefing(true)}
                disabled={briefingLoading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={briefingLoading ? colors.textTertiary : colors.primary}
                />
              </TouchableOpacity>
            </View>
            {briefingLoading ? (
              <View style={[styles.briefingLoading, { marginTop: spacing.md }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                  Generating your briefing...
                </Text>
              </View>
            ) : (
              <Text style={[typography.bodyLarge, { color: colors.text, marginTop: spacing.md, lineHeight: 24 }]}>
                {briefing ??
                  "New day, new opportunity. Stay consistent with your training and nutrition — that's where real results come from."}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: spacing.base }}>
        {/* ── Today's Action Card ──────────────────────────────────────── */}
        {todayCompletedWorkout ? (
          /* Completed workout state */
          <Card style={{ marginTop: spacing.base }}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconCircle, { backgroundColor: colors.successLight }]}>
                <Ionicons name="trophy" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.labelSmall, { color: colors.success, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  WORKOUT COMPLETE
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>
                  {todayCompletedWorkout.name}
                </Text>
              </View>
            </View>
            <View style={[styles.completedStats, { marginTop: spacing.base, gap: spacing.base }]}>
              <View style={styles.completedStatItem}>
                <Text style={[typography.h2, { color: colors.text }]}>
                  {Math.round(todayCompletedWorkout.durationSeconds / 60)}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>minutes</Text>
              </View>
              <View style={[styles.completedStatDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.completedStatItem}>
                <Text style={[typography.h2, { color: colors.text }]}>
                  {Math.round(todayCompletedWorkout.totalVolume).toLocaleString()}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>kg volume</Text>
              </View>
              <View style={[styles.completedStatDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.completedStatItem}>
                <Text style={[typography.h2, { color: colors.text }]}>
                  {todayCompletedWorkout.totalSets}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>sets</Text>
              </View>
            </View>
          </Card>
        ) : todayWorkout ? (
          /* Scheduled workout state */
          <Card style={{ marginTop: spacing.base }}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name="barbell" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.labelSmall, { color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  TODAY&apos;S WORKOUT
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>
                  {todayWorkout.name}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {todayWorkout.exercises.length} exercises
                  {activeProgram ? ` · ${activeProgram.name}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.startWorkoutBtn, {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                marginTop: spacing.base,
                paddingVertical: spacing.md,
              }]}
              onPress={() => router.push('/(tabs)/workout')}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={18} color={colors.textInverse} />
              <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.sm }]}>
                Start Workout
              </Text>
            </TouchableOpacity>
          </Card>
        ) : (
          /* Rest day / no workout state */
          <Card style={{ marginTop: spacing.base }}>
            <View style={styles.actionCardHeader}>
              <View style={[styles.actionIconCircle, { backgroundColor: colors.successLight }]}>
                <Ionicons name="leaf" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.labelSmall, { color: colors.success, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  REST DAY
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>
                  Active Recovery
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Stretch, walk, or light mobility work
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.startWorkoutBtn, {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                marginTop: spacing.base,
                paddingVertical: spacing.md,
                borderWidth: 1,
                borderColor: colors.primary,
              }]}
              onPress={() => router.push('/(tabs)/workout')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm }]}>
                Start a Workout Anyway
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Nutrition Dashboard Strip ────────────────────────────────── */}
        <Card style={{ marginTop: spacing.base }}>
          <View style={styles.nutritionHeader}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>Nutrition</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/nutrition')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[typography.labelSmall, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>

          {/* Macro strips */}
          <View style={[styles.macroStrip, { marginTop: spacing.md, gap: spacing.md }]}>
            {/* Calories */}
            <View style={styles.macroItem}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: colors.calories }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Calories</Text>
              </View>
              <Text style={[typography.h3, { color: colors.text }]}>
                {Math.round(displayConsumed.calories).toLocaleString()}
                <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                  {' '}/ {displayTargets.calories.toLocaleString()}
                </Text>
              </Text>
              <ProgressBar
                progress={Math.min(calProgress, 1)}
                color={calProgress > 1 ? colors.warning : colors.calories}
                height={4}
                style={{ marginTop: spacing.xs }}
              />
            </View>

            {/* Protein */}
            <View style={styles.macroItem}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: colors.protein }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Protein</Text>
              </View>
              <Text style={[typography.h3, { color: colors.text }]}>
                {Math.round(displayConsumed.protein_g)}
                <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                  {' '}/ {displayTargets.protein_g}g
                </Text>
              </Text>
              <ProgressBar
                progress={Math.min(proteinProgress, 1)}
                color={proteinProgress > 1 ? colors.warning : colors.protein}
                height={4}
                style={{ marginTop: spacing.xs }}
              />
            </View>

            {/* Water */}
            <View style={styles.macroItem}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: colors.info }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Water</Text>
              </View>
              <Text style={[typography.h3, { color: colors.text }]}>
                {(displayWater / 1000).toFixed(1)}
                <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                  {' '}/ {(displayTargets.water_ml / 1000).toFixed(1)}L
                </Text>
              </Text>
              <ProgressBar
                progress={Math.min(waterProgress, 1)}
                color={colors.info}
                height={4}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </View>

          {/* Quick-add buttons */}
          <View style={[styles.nutritionActions, { marginTop: spacing.md, gap: spacing.sm }]}>
            <TouchableOpacity
              style={[styles.nutritionActionBtn, {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }]}
              onPress={() => router.push('/(tabs)/nutrition')}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.xs }]}>
                Log Meal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nutritionActionBtn, {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }]}
              onPress={() => router.push('/(tabs)/nutrition')}
              activeOpacity={0.7}
            >
              <Ionicons name="water-outline" size={16} color={colors.info} />
              <Text style={[typography.labelSmall, { color: colors.info, marginLeft: spacing.xs }]}>
                Log Water
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── AI Insights ──────────────────────────────────────────────── */}
        {insights.length > 0 && (
          <View style={{ marginTop: spacing.base }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              Insights
            </Text>
            {insights.map((insight) => (
              <View
                key={insight.id}
                style={[styles.insightCard, {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderColor: colors.borderLight,
                  shadowColor: colors.shadow,
                }]}
              >
                <View style={[styles.insightIcon, { backgroundColor: `${insight.iconColor}15`, borderRadius: radius.md }]}>
                  <Ionicons name={insight.icon} size={18} color={insight.iconColor} />
                </View>
                <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                  {insight.message}
                </Text>
                <TouchableOpacity
                  onPress={() => dismissInsight(insight.id)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                  style={{ marginLeft: spacing.sm }}
                >
                  <Ionicons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Stats Strip ──────────────────────────────────────────────── */}
        <View style={[styles.statsStrip, {
          marginTop: spacing.base,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderColor: colors.borderLight,
          shadowColor: colors.shadow,
        }]}>
          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Ionicons name="flame" size={18} color={colors.warning} />
              <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.xs }]}>
                {streak}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Day Streak
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.xs }]}>
                {workoutsThisWeek}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              This Week
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Ionicons name="ribbon-outline" size={18} color={colors.success} />
              <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.xs }]}>
                {completedPrograms}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Programs
            </Text>
          </View>
        </View>

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <View style={[styles.quickActionsRow, { marginTop: spacing.lg, marginBottom: spacing['2xl'] }]}>
          {([
            { icon: 'barbell-outline' as const, label: 'Workout', route: '/(tabs)/workout' as const, color: colors.primary },
            { icon: 'restaurant-outline' as const, label: 'Log Meal', route: '/(tabs)/nutrition' as const, color: colors.calories },
            { icon: 'chatbubble-outline' as const, label: 'Coach', route: '/(tabs)/coach' as const, color: colors.success },
            { icon: 'scale-outline' as const, label: 'Weight', route: '/(tabs)/nutrition' as const, color: colors.info },
          ]).map((action) => (
            <TouchableOpacity
              key={action.label}
              onPress={() => router.push(action.route)}
              activeOpacity={0.7}
              style={styles.quickActionItem}
            >
              <View style={[styles.quickActionCircle, {
                backgroundColor: `${action.color}15`,
                borderRadius: radius.full,
              }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <CoachFAB context="general" />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Hero
  heroGradient: {
    paddingBottom: 4,
  },
  heroContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingCard: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  coachingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefingLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Action Card
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  completedStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  completedStatDivider: {
    width: 1,
    height: 32,
  },

  // Nutrition
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroStrip: {
    flexDirection: 'row',
  },
  macroItem: {
    flex: 1,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  nutritionActions: {
    flexDirection: 'row',
  },
  nutritionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Insights
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 1,
  },
  insightIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionItem: {
    alignItems: 'center',
  },
  quickActionCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
