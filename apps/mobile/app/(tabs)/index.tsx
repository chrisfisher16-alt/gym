import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer, ProgressRing, EmptyState, ExpandableCard, Sparkline, QuickActionSheet, SmartHeader } from '../../src/components/ui';
import { useQuickActions } from '../../src/hooks/useQuickActions';
import { useAuthStore } from '../../src/stores/auth-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { calculateDailyTotals } from '../../src/lib/nutrition-utils';
import { useWorkoutPrograms } from '../../src/hooks/useWorkoutPrograms';
import { useSupplements } from '../../src/hooks/useSupplements';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { generateDailyBriefing, cacheBriefing } from '../../src/lib/daily-briefing';
import {
  generateWeeklySummary, getLastWeekStart,
  isWeeklySummaryDismissed, dismissWeeklySummary, type WeeklySummary,
} from '../../src/lib/weekly-summary';
import { calculateStreak } from '../../src/lib/achievements';
import { isDemoMode, DEMO_STREAK, getDemoTodayNutrition, DEMO_NUTRITION_TARGETS } from '../../src/lib/demo-mode';
import { QuickLogMealSheet } from '../../src/components/QuickLogMealSheet';
import { QuickAddWaterSheet } from '../../src/components/QuickAddWaterSheet';
import { generateInsights, type InsightContext as InsightCtx } from '../../src/lib/insight-engine';
import { InsightBadge } from '../../src/components/ui';
import { useCoachStore } from '../../src/stores/coach-store';
import { useCoachPeekTrigger } from '../../src/hooks/useCoachPeekTrigger';

// ── Types & Constants ─────────────────────────────────────────────────
interface AIInsight {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  message: string;
}

const DISMISSED_KEY = '@today/dismissed-insights';
const fmt = (n: number) => Math.round(n).toLocaleString();

// ── Component ─────────────────────────────────────────────────────────
export default function TodayTab() {
  useCoachPeekTrigger();
  const { colors, spacing, typography, radius, dark } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const authLoading = useAuthStore((s) => s.isLoading);
  const isLoading = Platform.OS === 'web' ? false : authLoading;
  const profileStore = useProfileStore((s) => s.profile);
  const personalRecords = useWorkoutStore((s) => s.personalRecords);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const startEmptyWorkout = useWorkoutStore((s) => s.startEmptyWorkout);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const isWorkoutInitialized = useWorkoutStore((s) => s.isInitialized);
  const initializeWorkout = useWorkoutStore((s) => s.initialize);
  const { tier } = useEntitlement();

  const { recentWorkouts, totalWorkouts, weeklyVolume, history } = useWorkoutHistory();
  const { targets, consumed, waterIntake, meals: todayMeals } = useNutritionDashboard();
  const { activeProgram, getTodayWorkout, programs } = useWorkoutPrograms();
  const { activeSupplements, isSupplementTaken, logSupplement } = useSupplements();

  // Ensure workout store is initialized so programs / activeProgram are available
  useEffect(() => {
    if (!isWorkoutInitialized) {
      initializeWorkout();
    }
  }, [isWorkoutInitialized, initializeWorkout]);

  const demo = isDemoMode();
  const demoNutrition = useMemo(() => (demo ? getDemoTodayNutrition() : null), [demo]);
  const showWorkout = tier !== 'nutrition_coach';
  const showNutrition = tier !== 'workout_coach';

  // Sheet states
  const [mealSheetVisible, setMealSheetVisible] = useState(false);
  const [waterSheetVisible, setWaterSheetVisible] = useState(false);

  // Quick Actions
  const { show: showQuickActions, sheetProps: quickActionSheetProps } = useQuickActions();

  // Workout status for contextual header
  const todayWorkoutStatus = useWorkoutStore((s) => s.todayWorkoutStatus);

  // 7-day sparkline data from nutrition store dailyLogs
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);
  const sparklineData = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const calories: number[] = [];
    const protein: number[] = [];
    const water: number[] = [];
    for (const day of days) {
      const log = dailyLogs[day];
      if (log) {
        const totals = calculateDailyTotals(log.meals);
        calories.push(totals.calories);
        protein.push(totals.protein_g);
        water.push(log.waterIntake_oz);
      } else {
        calories.push(0);
        protein.push(0);
        water.push(0);
      }
    }
    return { calories, protein, water };
  }, [dailyLogs]);

  // ── Date & Greeting ───────────────────────────────────────────────
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greeting = timeOfDay === 'morning' ? 'Good morning' : timeOfDay === 'afternoon' ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const displayName = profile?.display_name?.split(' ')[0] || profileStore?.displayName?.split(' ')[0] || 'there';

  // ── Nutrition ─────────────────────────────────────────────────────
  const dC = demo && demoNutrition ? demoNutrition.consumed : consumed;
  const dT = demo ? DEMO_NUTRITION_TARGETS : targets;
  const dW = demo ? 60 : waterIntake;
  const calP = dT.calories > 0 ? dC.calories / dT.calories : 0;
  const proP = dT.protein_g > 0 ? dC.protein_g / dT.protein_g : 0;
  const watP = dT.water_oz > 0 ? dW / dT.water_oz : 0;
  const pm = hour >= 14; // afternoon mode

  // ── Streak & Stats ────────────────────────────────────────────────
  const streak = useMemo(() => (demo ? DEMO_STREAK.currentStreak : calculateStreak(history)), [demo, history]);
  const workoutsThisWeek = useMemo(() => {
    if (demo) return 5;
    const s = new Date(); const d = s.getDay();
    s.setDate(s.getDate() - (d === 0 ? 6 : d - 1)); s.setHours(0, 0, 0, 0);
    return history.filter((w) => new Date(w.completedAt) >= s).length;
  }, [demo, history]);
  const prCount = useMemo(() => (demo ? 12 : Object.keys(personalRecords).length), [demo, personalRecords]);
  const showStats = (streak > 0 || totalWorkouts > 0 || demo) && showWorkout;

  // ── Daily Briefing ────────────────────────────────────────────────
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);

  const loadBriefing = useCallback(async (force = false) => {
    setBriefingLoading(true);
    try {
      if (force) {
        const today = new Date().toISOString().split('T')[0];
        await cacheBriefing(today, '');
        await AsyncStorage.removeItem(`@briefing/${today}`);
      }
      setBriefing(await generateDailyBriefing());
    } catch { setBriefing(null); }
    finally { setBriefingLoading(false); }
  }, []);

  useEffect(() => { loadBriefing(); }, [loadBriefing]);

  const fallback = timeOfDay === 'morning'
    ? 'Start your day strong. Check your workout plan and hit your nutrition targets.'
    : timeOfDay === 'afternoon'
    ? 'Halfway through the day — check in on your macros and stay hydrated.'
    : "Day's winding down. Review what you accomplished and rest well tonight.";

  // ── Today's Workout ───────────────────────────────────────────────
  const todayWorkout = activeProgram ? getTodayWorkout() : null;
  const todayDone = useMemo(() => {
    if (demo) return null;
    const ts = new Date().toISOString().split('T')[0];
    return history.find((w) => new Date(w.completedAt).toISOString().split('T')[0] === ts) ?? null;
  }, [demo, history]);

  // ── Persistent Dismissed Insights ─────────────────────────────────
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => { if (v) setDismissed(new Set(JSON.parse(v))); }).catch(() => {});
  }, []);
  const dismiss = useCallback((id: string) => {
    setDismissed((p) => { const n = new Set(p).add(id); AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(n))).catch(() => {}); return n; });
  }, []);

  // ── AI Insights ───────────────────────────────────────────────────
  const insights: AIInsight[] = useMemo(() => {
    if (demo) {
      const demoItems: AIInsight[] = [
        { id: 'protein-low', icon: 'alert-circle-outline', iconColor: colors.warning,
          message: "You've been under on protein 3 days in a row. Try adding a shake post-workout." },
        { id: 'volume-up', icon: 'trending-up-outline', iconColor: colors.info,
          message: 'Bench press volume up 15% this month. Progressive overload is working!' },
      ];
      return demoItems.filter((i) => !dismissed.has(i.id)).slice(0, 2);
    }
    const items: AIInsight[] = [];
    if (showNutrition && proP < 0.7 && hour >= 14)
      items.push({ id: 'protein-low', icon: 'alert-circle-outline', iconColor: colors.warning,
        message: `Protein at ${Math.round(proP * 100)}%. A shake or chicken breast can close the gap.` });
    if (streak >= 5)
      items.push({ id: 'recovery-hint', icon: 'leaf-outline', iconColor: colors.success,
        message: `${streak} days straight — listen to your body. A rest day helps muscles grow.` });
    if (totalWorkouts >= 6) {
      const r = history.slice(0, 3).reduce((s, w) => s + w.totalVolume, 0);
      const o = history.slice(3, 6).reduce((s, w) => s + w.totalVolume, 0);
      if (o > 0 && r > o * 1.1)
        items.push({ id: 'volume-up', icon: 'trending-up-outline', iconColor: colors.info,
          message: `Volume up ${Math.round(((r - o) / o) * 100)}%! Progressive overload is working.` });
    }
    if (showNutrition && watP < 0.5 && hour >= 14)
      items.push({ id: 'hydration', icon: 'water-outline', iconColor: colors.info,
        message: `Only ${Math.round(watP * 100)}% hydrated. Time for a glass.` });
    return items.filter((i) => !dismissed.has(i.id)).slice(0, 2);
  }, [demo, proP, streak, totalWorkouts, history, watP, hour, dismissed, colors, showNutrition]);

  // ── Smart Inline Insights (rule-based) ──────────────────────────
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);
  const smartInsights = useMemo(() => {
    const ctx: InsightCtx = {
      caloriesConsumed: dC.calories,
      caloriesTarget: dT.calories,
      proteinConsumed: dC.protein_g,
      proteinTarget: dT.protein_g,
      waterConsumed: dW,
      waterTarget: dT.water_oz,
      timeOfDay: hour,
      workoutsThisWeek,
      currentStreak: streak,
      lastWorkoutDate: history[0]?.completedAt?.split('T')[0],
    };
    return generateInsights(ctx).slice(0, 2);
  }, [dC, dT, dW, hour, workoutsThisWeek, streak, history]);

  const handleAskInsight = useCallback((prompt: string) => {
    setPrefilledContext('general', prompt);
    router.push('/(tabs)/coach');
  }, [setPrefilledContext, router]);

  // ── Weekly Check-In ───────────────────────────────────────────────
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [weekLoad, setWeekLoad] = useState(false);
  const [weekHidden, setWeekHidden] = useState(true);
  const weekStart = useMemo(() => getLastWeekStart(), []);
  const isWeekDay = now.getDay() === 0 || now.getDay() === 1;

  useEffect(() => {
    if (!isWeekDay) return;
    let c = false;
    (async () => {
      if (await isWeeklySummaryDismissed(weekStart)) return;
      if (c) return;
      setWeekHidden(false); setWeekLoad(true);
      try { const s = await generateWeeklySummary(); if (!c) setWeekly(s); }
      catch {} finally { if (!c) setWeekLoad(false); }
    })();
    return () => { c = true; };
  }, [isWeekDay, weekStart]);

  const dismissWeek = useCallback(async () => { setWeekHidden(true); await dismissWeeklySummary(weekStart); }, [weekStart]);

  // ── Quick Actions (product-mode aware) ────────────────────────────

  // ── Workout Start Handler ─────────────────────────────────────────
  const handleStartToday = useCallback(() => {
    if (activeSession) {
      router.push('/workout/active');
      return;
    }
    if (!todayWorkout || !activeProgram) return;
    startWorkout({
      name: `${activeProgram.name} — ${todayWorkout.name}`,
      programId: activeProgram.id,
      dayId: todayWorkout.id,
      exercises: todayWorkout.exercises.map((e: any) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        supersetGroupId: e.supersetGroupId,
      })),
    });
    router.push('/workout/active');
  }, [activeSession, todayWorkout, activeProgram, startWorkout]);

  const handleEmptyStart = useCallback(() => {
    if (activeSession) {
      router.push('/workout/active');
      return;
    }
    startEmptyWorkout();
    router.push('/workout/active');
  }, [activeSession, startEmptyWorkout]);

  // ── Contextual Header Subtext ─────────────────────────────────────
  const contextualSubtext = useMemo(() => {
    const status = todayWorkoutStatus();
    if (status === 'active') {
      return '💪 Workout in progress — keep pushing!';
    }
    if (status === 'completed') {
      const vol = todayDone?.totalVolume;
      return vol ? `Great session today — ${fmt(vol)} lbs total volume!` : 'Workout complete — nice work today!';
    }
    // Pending workout
    if (timeOfDay === 'morning' && todayWorkout && showWorkout) {
      const muscleLabel = todayWorkout.focusArea?.replace('_', ' ') ?? '';
      return `${todayWorkout.name}${muscleLabel ? ` · ${muscleLabel}` : ''} on deck today`;
    }
    if (timeOfDay === 'evening' && showNutrition && calP < 0.9) {
      const calsLeft = Math.max(0, Math.round(dT.calories - dC.calories));
      return `${fmt(calsLeft)} calories left — finish strong`;
    }
    return undefined;
  }, [todayWorkoutStatus, todayDone, todayWorkout, timeOfDay, showWorkout, showNutrition, calP, dT, dC]);

  // ── Gradient ──────────────────────────────────────────────────────
  const grad = dark ? [colors.primaryMuted, colors.surface] as const : [colors.primaryMuted, colors.background] as const;

  // ── Loading ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={S.loadWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>Loading your dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Ring labels
  const calLbl = pm ? fmt(Math.max(0, dT.calories - dC.calories)) : fmt(dC.calories);
  const calSub = pm ? 'left' : 'cal';
  const proLbl = pm ? `${Math.round(Math.max(0, dT.protein_g - dC.protein_g))}g` : `${Math.round(dC.protein_g)}g`;
  const proSub = pm ? 'left' : 'protein';
  const watLbl = pm ? `${Math.round(Math.max(0, dT.water_oz - dW))}` : `${Math.round(dW)}`;
  const watSub = pm ? 'oz left' : 'oz';

  // ════════════════════════════════════════════════════════════════════
  return (
    <ScreenContainer padded={false}>
      {/* ── 1. HEADER ─────────────────────────────────────────────────── */}
      <LinearGradient colors={grad} style={S.heroGrad}>
        <View style={[S.heroInner, { paddingHorizontal: spacing.base }]}>
          <View style={S.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{dateStr}</Text>
              <Text style={[typography.h1, { color: colors.text, marginTop: spacing.xs }]}>{greeting}, {displayName}</Text>
              <SmartHeader tab="today" displayName={displayName} />
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── 2. DAILY COACHING ─────────────────────────────────────── */}
          <ExpandableCard
            style={{ marginTop: spacing.lg }}
            expandedContent={
              <View>
                {!briefingLoading && (
                  <Text style={[typography.bodyLarge, { color: colors.text, lineHeight: 24 }]}>{briefing ?? fallback}</Text>
                )}
                <TouchableOpacity
                  style={[S.row, { marginTop: spacing.md, alignSelf: 'flex-start' }]}
                  onPress={() => router.push('/(tabs)/coach')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                  <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.xs }]}>Ask more...</Text>
                </TouchableOpacity>
              </View>
            }
          >
            <View style={S.coachHead}>
              <View style={[S.sparkle, { backgroundColor: colors.primaryMuted, borderRadius: radius.md }]}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}>YOUR DAILY COACHING</Text>
              <TouchableOpacity onPress={() => loadBriefing(true)} disabled={briefingLoading} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
                <Ionicons name="refresh" size={16} color={briefingLoading ? colors.textTertiary : colors.primary} />
              </TouchableOpacity>
            </View>
            {briefingLoading ? (
              <View style={[S.row, { marginTop: spacing.md }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>Preparing your briefing...</Text>
              </View>
            ) : (
              <Text style={[typography.bodyLarge, { color: colors.text, marginTop: spacing.md, lineHeight: 24 }]} numberOfLines={2}>{briefing ?? fallback}</Text>
            )}
          </ExpandableCard>
        </View>
      </LinearGradient>

      {/* ── QUICK ACTIONS ──────────────────────────────────────────── */}
      <View style={[S.quickActions, { paddingHorizontal: spacing.base, paddingVertical: spacing.sm }]}>
        {showWorkout && (
          <TouchableOpacity
            style={S.quickBtn}
            onPress={activeSession ? () => router.push('/workout/active') : handleEmptyStart}
            activeOpacity={0.7}
          >
            <Ionicons name="barbell-outline" size={24} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {activeSession ? 'Resume' : 'Workout'}
            </Text>
          </TouchableOpacity>
        )}
        {showNutrition && (
          <TouchableOpacity
            style={S.quickBtn}
            onPress={() => setMealSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="restaurant-outline" size={24} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>Log Meal</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={S.quickBtn}
          onPress={() => router.push('/(tabs)/coach')}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>AI Coach</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.base }}>
        {/* ── 3. TODAY'S WORKOUT ───────────────────────────────────────── */}
        {showWorkout && renderWorkoutCard()}

        {/* ── 4. NUTRITION SNAPSHOT ────────────────────────────────────── */}
        {showNutrition && (
          <ExpandableCard
            style={{ marginTop: spacing.base }}
            expandedContent={
              <View>
                {/* Per-meal breakdown */}
                {todayMeals.length > 0 && (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>TODAY&apos;S MEALS</Text>
                    {todayMeals.map((meal) => {
                      const mealCals = meal.items.reduce((sum, it) => sum + it.calories, 0);
                      const mealPro = meal.items.reduce((sum, it) => sum + it.protein_g, 0);
                      return (
                        <View key={meal.id} style={[S.row, { justifyContent: 'space-between', paddingVertical: spacing.xs }]}>
                          <View style={S.row}>
                            <Ionicons
                              name={meal.mealType === 'breakfast' ? 'sunny-outline' : meal.mealType === 'lunch' ? 'restaurant-outline' : meal.mealType === 'dinner' ? 'moon-outline' : 'cafe-outline'}
                              size={14}
                              color={colors.textTertiary}
                            />
                            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, textTransform: 'capitalize' }]}>{meal.mealType}</Text>
                          </View>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{Math.round(mealCals)} cal · {Math.round(mealPro)}g protein</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {/* 7-day sparklines */}
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>7-DAY TRENDS</Text>
                  {[
                    { label: 'Calories', data: sparklineData.calories, color: colors.calories },
                    { label: 'Protein', data: sparklineData.protein, color: colors.protein },
                    { label: 'Water', data: sparklineData.water, color: colors.info },
                  ].map((trend) => (
                    <View key={trend.label} style={[S.row, { justifyContent: 'space-between', paddingVertical: spacing.xs }]}>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{trend.label}</Text>
                      <Sparkline variant="inline" data={trend.data} color={trend.color} />
                    </View>
                  ))}
                </View>
                {/* Coach shortcut */}
                <TouchableOpacity
                  style={[S.row, { alignSelf: 'flex-start' }]}
                  onPress={() => router.push('/(tabs)/coach')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                  <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.xs }]}>What should I eat?</Text>
                </TouchableOpacity>
              </View>
            }
          >
            {/* Collapsed: header + rings */}
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() => showQuickActions({
                title: 'Nutrition',
                subtitle: `${fmt(dC.calories)} / ${fmt(dT.calories)} cal today`,
                actions: [
                  { id: 'log-meal', label: 'Log a Meal', icon: 'restaurant-outline', onPress: () => setMealSheetVisible(true) },
                  { id: 'ask-coach', label: 'What should I eat?', icon: 'chatbubble-outline', onPress: () => router.push('/(tabs)/coach'), badge: 'AI' },
                  { id: 'edit-targets', label: 'Edit Targets', icon: 'options-outline', onPress: () => router.push('/(tabs)/nutrition') },
                ],
              })}
            >
            <View style={S.secHead}>
              <Text style={[typography.labelLarge, { color: colors.text }]}>Nutrition</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/nutrition')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Text style={[typography.labelSmall, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {dC.calories === 0 && dC.protein_g === 0 ? (
              <EmptyState
                icon="nutrition-outline"
                title="Track Your Nutrition"
                description="Log your meals to see your daily nutrition breakdown here."
                actionLabel="Log a Meal"
                onAction={() => router.push('/nutrition/log')}
              />
            ) : (
              <>
                <View style={[S.ringsRow, { marginTop: spacing.base }]}>
                  {[
                    { p: calP, c: colors.calories, l: calLbl, sl: calSub, t: 'Calories', sd: sparklineData.calories },
                    { p: proP, c: colors.protein, l: proLbl, sl: proSub, t: 'Protein', sd: sparklineData.protein },
                    { p: watP, c: colors.info, l: watLbl, sl: watSub, t: 'Water', sd: sparklineData.water },
                  ].map((r) => (
                    <View key={r.t} style={S.ringItem}>
                      <ProgressRing progress={Math.min(r.p, 1)} size={64} strokeWidth={5} color={r.c} label={r.l} sublabel={r.sl} />
                      <View style={[S.row, { marginTop: spacing.xs, justifyContent: 'center' }]}>
                        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{r.t}</Text>
                        <Sparkline variant="inline" data={r.sd} color={r.c} style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
                <View style={[S.row, { marginTop: spacing.md, gap: spacing.sm }]}>
                  <TouchableOpacity style={[S.pill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
                    onPress={() => setMealSheetVisible(true)} activeOpacity={0.7}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.xs }]}>Log Meal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.pill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
                    onPress={() => setWaterSheetVisible(true)} activeOpacity={0.7}>
                    <Ionicons name="water-outline" size={16} color={colors.info} />
                    <Text style={[typography.labelSmall, { color: colors.info, marginLeft: spacing.xs }]}>Add Water</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {activeSupplements.length > 0 && (
              <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {activeSupplements.map((s) => {
                    const t = isSupplementTaken(s.id);
                    return (
                      <TouchableOpacity key={s.id} onPress={() => { if (!t) logSupplement(s.id); }} activeOpacity={0.7}
                        style={[S.pill, { backgroundColor: t ? colors.successLight : colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginRight: spacing.sm }]}>
                        <Ionicons name={t ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={t ? colors.success : colors.textTertiary} />
                        <Text style={[typography.caption, { color: t ? colors.success : colors.textSecondary, marginLeft: spacing.xs }]}>{s.supplementName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            </TouchableOpacity>
          </ExpandableCard>
        )}

        {/* ── 4b. INLINE INSIGHTS ──────────────────────────────────── */}
        {smartInsights.length > 0 && (
          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {smartInsights.map((si) => (
              <InsightBadge
                key={si.id}
                insight={si}
                onAskMore={si.coachPrompt ? () => handleAskInsight(si.coachPrompt!) : undefined}
              />
            ))}
          </View>
        )}

        {/* ── 5. STREAKS & MOMENTUM ───────────────────────────────────── */}
        {showStats && (
          <View style={[S.strip, { marginTop: spacing.base, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base, borderColor: colors.borderLight, shadowColor: colors.shadow }]}>
            <View style={S.statC}>
              <View style={S.row}>
                <Ionicons name="flame" size={18} color={colors.warning} />
                <Text style={[typography.h2, { color: streak >= 3 ? colors.warning : colors.text, marginLeft: spacing.xs }]}>{streak}</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>Day Streak</Text>
            </View>
            <View style={[S.vDiv, { backgroundColor: colors.borderLight }]} />
            <View style={S.statC}>
              <View style={S.row}>
                <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.xs }]}>{workoutsThisWeek}</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>This Week</Text>
            </View>
            <View style={[S.vDiv, { backgroundColor: colors.borderLight }]} />
            <View style={S.statC}>
              <View style={S.row}>
                <Ionicons name="ribbon-outline" size={18} color={colors.gold} />
                <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.xs }]}>{prCount}</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>PRs</Text>
            </View>
          </View>
        )}

        {/* ── 6. INSIGHTS ─────────────────────────────────────────────── */}
        {insights.length > 0 && (
          <View style={{ marginTop: spacing.base }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>Insights</Text>
            {insights.map((i) => (
              <View key={i.id} style={[S.insight, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderColor: colors.borderLight, shadowColor: colors.shadow }]}>
                <View style={[S.insightIco, { backgroundColor: `${i.iconColor}15`, borderRadius: radius.md }]}>
                  <Ionicons name={i.icon} size={18} color={i.iconColor} />
                </View>
                <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>{i.message}</Text>
                <TouchableOpacity onPress={() => dismiss(i.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7} style={{ marginLeft: spacing.sm }}>
                  <Ionicons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── 7. WEEKLY CHECK-IN ──────────────────────────────────────── */}
        {isWeekDay && !weekHidden && (
          <Card style={{ marginTop: spacing.base }}>
            <Text style={[typography.labelSmall, { color: colors.primary, letterSpacing: 1 }]}>📊  WEEKLY CHECK-IN</Text>
            {weekLoad || !weekly ? (
              <View style={[S.row, { marginTop: spacing.md, justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>Analyzing your week...</Text>
              </View>
            ) : (
              <>
                <View style={[S.wGrid, { marginTop: spacing.base }]}>
                  {([
                    [weekly.workoutsCompleted, 'Workouts'],
                    [fmt(weekly.totalVolume), 'Volume'],
                    [weekly.prsHit, 'PRs'],
                    [fmt(weekly.avgCalories), 'Avg Cal'],
                    [`${Math.round(weekly.nutritionAdherence * 100)}%`, 'Adherence'],
                  ] as const).map(([v, l]) => (
                    <View key={l} style={S.wItem}>
                      <Text style={[typography.h3, { color: colors.text }]}>{v}</Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{l}</Text>
                    </View>
                  ))}
                </View>
                {weekly.aiInsight ? <Text style={[typography.body, { color: colors.text, marginTop: spacing.md, lineHeight: 22 }]}>{weekly.aiInsight}</Text> : null}
                <View style={[S.row, { marginTop: spacing.base, gap: spacing.sm }]}>
                  <TouchableOpacity onPress={dismissWeek} style={[S.pill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]} activeOpacity={0.7}>
                    <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/progress')} style={[S.pill, { backgroundColor: colors.primaryMuted, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]} activeOpacity={0.7}>
                    <Text style={[typography.labelSmall, { color: colors.primary }]}>See Progress</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>
        )}

        {/* ── TIMELINE LINK ─────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/timeline')}
          activeOpacity={0.7}
          style={{ alignItems: 'center', paddingVertical: spacing.lg }}
        >
          <Text style={[typography.label, { color: colors.primary }]}>View Timeline →</Text>
        </TouchableOpacity>

        <View style={{ marginBottom: spacing['2xl'] }} />
      </View>

      {/* Bottom Sheets */}
      <QuickLogMealSheet visible={mealSheetVisible} onClose={() => setMealSheetVisible(false)} />
      <QuickAddWaterSheet visible={waterSheetVisible} onClose={() => setWaterSheetVisible(false)} />
      <QuickActionSheet {...quickActionSheetProps} />
    </ScreenContainer>
  );

  // ── Workout Card (extracted for clarity) ──────────────────────────
  function renderWorkoutCard() {
    if (activeSession) {
      const completedSets = activeSession.exercises.reduce((acc, e) => acc + e.sets.filter(s => s.isCompleted).length, 0);
      const totalSets = activeSession.exercises.reduce((acc, e) => acc + e.sets.length, 0);
      const elapsedMin = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000);
      const visibleExercises = activeSession.exercises.filter(e => !e.isSkipped).slice(0, 3);
      return (
        <Card style={{ marginTop: spacing.base, borderColor: colors.success, borderWidth: 2 }}>
          <View style={S.actHead}>
            <View style={[S.actCircle, { backgroundColor: colors.successLight }]}>
              <Ionicons name="flash" size={24} color={colors.success} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.labelSmall, { color: colors.success, textTransform: 'uppercase', letterSpacing: 1 }]}>WORKOUT IN PROGRESS</Text>
              <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>{activeSession.name}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{completedSets} of {totalSets} sets completed · {elapsedMin} min</Text>
            </View>
          </View>
          {visibleExercises.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              {visibleExercises.map((ex) => {
                const done = ex.sets.every(s => s.isCompleted);
                return (
                  <View key={ex.id} style={[S.row, { paddingVertical: spacing.xs }]}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={done ? colors.success : colors.textTertiary}
                    />
                    <Text style={[typography.body, { color: done ? colors.success : colors.text, marginLeft: spacing.sm }]}>{ex.exerciseName}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <TouchableOpacity
            style={[S.cta, { backgroundColor: colors.success, borderRadius: radius.md, marginTop: spacing.base, paddingVertical: spacing.md }]}
            onPress={() => router.push('/workout/active')} activeOpacity={0.8}>
            <Ionicons name="play" size={18} color={colors.textInverse} />
            <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.sm }]}>Resume Workout</Text>
          </TouchableOpacity>
        </Card>
      );
    }
    if (todayDone) {
      return (
        <>
          <Card style={{ marginTop: spacing.base }}>
            <View style={S.actHead}>
              <View style={[S.actCircle, { backgroundColor: colors.successLight }]}>
                <Ionicons name="trophy" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.labelSmall, { color: colors.success, textTransform: 'uppercase', letterSpacing: 1 }]}>WORKOUT COMPLETE</Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>{todayDone.name}</Text>
              </View>
            </View>
            <View style={[S.statsR, { marginTop: spacing.base }]}>
              <View style={S.statC}><Text style={[typography.h2, { color: colors.text }]}>{Math.round(todayDone.durationSeconds / 60)}</Text><Text style={[typography.caption, { color: colors.textSecondary }]}>minutes</Text></View>
              <View style={[S.vDiv, { backgroundColor: colors.borderLight }]} />
              <View style={S.statC}><Text style={[typography.h2, { color: colors.text }]}>{fmt(todayDone.totalVolume)}</Text><Text style={[typography.caption, { color: colors.textSecondary }]}>volume</Text></View>
              <View style={[S.vDiv, { backgroundColor: colors.borderLight }]} />
              <View style={S.statC}><Text style={[typography.h2, { color: colors.text }]}>{todayDone.totalSets}</Text><Text style={[typography.caption, { color: colors.textSecondary }]}>sets</Text></View>
            </View>
            {todayDone.prCount > 0 && (
              <View style={[S.row, { backgroundColor: colors.goldLight, borderRadius: radius.sm, marginTop: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, alignSelf: 'flex-start' }]}>
                <Ionicons name="ribbon" size={14} color={colors.gold} />
                <Text style={[typography.labelSmall, { color: colors.gold, marginLeft: spacing.xs }]}>{todayDone.prCount} PR{todayDone.prCount > 1 ? 's' : ''} hit!</Text>
              </View>
            )}
          </Card>
          {todayWorkout ? (
            <Card style={{ marginTop: spacing.sm }}>
              <View style={S.actHead}>
                <View style={[S.actCircle, { backgroundColor: colors.primaryMuted }]}><Ionicons name="barbell" size={24} color={colors.primary} /></View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[typography.labelSmall, { color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>NEXT WORKOUT</Text>
                  <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>{todayWorkout.name}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{todayWorkout.exercises.length} exercises{activeProgram ? ` · ${activeProgram.name}` : ''}</Text>
                </View>
              </View>
              <TouchableOpacity style={[S.cta, { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.base, paddingVertical: spacing.md }]}
                onPress={handleStartToday} activeOpacity={0.8}>
                <Ionicons name="play" size={18} color={colors.textInverse} />
                <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.sm }]}>Start Workout</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card style={{ marginTop: spacing.sm }}>
              <TouchableOpacity style={[S.cta, { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.primary }]}
                onPress={() => router.push('/workout/ai-generate')} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm }]}>Build AI Workout</Text>
              </TouchableOpacity>
            </Card>
          )}
        </>
      );
    }
    if (todayWorkout) {
      const estMinutes = todayWorkout.exercises.reduce((sum, e) => sum + e.targetSets * (e.restSeconds + 45), 0) / 60;
      return (
        <ExpandableCard
          style={{ marginTop: spacing.base }}
          expandedContent={
            <View>
              {/* Exercise list */}
              {todayWorkout.exercises.map((ex) => (
                <View key={ex.id} style={[S.row, { justifyContent: 'space-between', paddingVertical: spacing.xs }]}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>{ex.exerciseName}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{ex.targetSets} × {ex.targetReps}</Text>
                </View>
              ))}
              {/* Duration & muscle tags */}
              <View style={[S.row, { flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }]}>
                <View style={[S.pill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }]}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 2 }]}>~{Math.round(estMinutes)} min</Text>
                </View>
                {todayWorkout.focusArea && (
                  <View style={[S.pill, { backgroundColor: colors.primaryMuted, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }]}>
                    <Text style={[typography.caption, { color: colors.primary, textTransform: 'capitalize' }]}>{todayWorkout.focusArea.replace('_', ' ')}</Text>
                  </View>
                )}
              </View>
              {/* Action buttons */}
              <TouchableOpacity style={[S.cta, { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.base, paddingVertical: spacing.md }]}
                onPress={handleStartToday} activeOpacity={0.8}>
                <Ionicons name="play" size={18} color={colors.textInverse} />
                <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.sm }]}>Start Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.cta, { backgroundColor: colors.surface, borderRadius: radius.md, marginTop: spacing.sm, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.primary }]}
                onPress={() => router.push('/workout/ai-generate')} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm }]}>Build AI Workout</Text>
              </TouchableOpacity>
            </View>
          }
        >
          {/* Collapsed: workout header */}
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => showQuickActions({
              title: todayWorkout.name,
              subtitle: `${todayWorkout.exercises.length} exercises · ${activeProgram?.name ?? ''}`,
              actions: [
                { id: 'start', label: 'Start Workout', icon: 'play-circle-outline', onPress: handleStartToday },
                { id: 'view-program', label: 'View Program', icon: 'list-outline', onPress: () => router.push('/(tabs)/workout') },
                { id: 'ask-coach', label: 'Ask Coach', icon: 'chatbubble-outline', onPress: () => router.push('/(tabs)/coach'), badge: 'AI' },
              ],
            })}
          >
            <View style={S.actHead}>
              <View style={[S.actCircle, { backgroundColor: colors.primaryMuted }]}><Ionicons name="barbell" size={24} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.labelSmall, { color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>TODAY&apos;S WORKOUT</Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>{todayWorkout.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{todayWorkout.exercises.length} exercises{activeProgram ? ` · ${activeProgram.name}` : ''}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </ExpandableCard>
      );
    }
    if (totalWorkouts === 0 && !demo) {
      return (
        <Card style={{ marginTop: spacing.base }}>
          <View style={S.actHead}>
            <View style={[S.actCircle, { backgroundColor: colors.primaryMuted }]}><Ionicons name="fitness" size={24} color={colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.h2, { color: colors.text }]}>Ready for your first workout?</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>Start with a guided workout or create your own.</Text>
            </View>
          </View>
          <View style={[S.row, { marginTop: spacing.base, gap: spacing.sm }]}>
            <TouchableOpacity style={[S.cta, { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, flex: 1 }]}
              onPress={handleEmptyStart} activeOpacity={0.8}>
              <Ionicons name="play" size={16} color={colors.textInverse} />
              <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.xs }]}>Let&apos;s Go</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.cta, { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.primary, flex: 1 }]}
              onPress={() => router.push('/workout/ai-generate')} activeOpacity={0.8}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.xs }]}>AI Workout</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }
    if (!activeProgram && totalWorkouts > 0 && !demo) {
      return (
        <Card style={{ marginTop: spacing.base }}>
          <View style={S.actHead}>
            <View style={[S.actCircle, { backgroundColor: colors.primaryMuted }]}><Ionicons name="flash" size={24} color={colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.labelSmall, { color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>QUICK START</Text>
              <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>No workout scheduled</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>Start an AI workout or empty session</Text>
            </View>
          </View>
          <View style={[S.row, { marginTop: spacing.base, gap: spacing.sm }]}>
            <TouchableOpacity style={[S.cta, { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, flex: 1 }]}
              onPress={() => router.push('/workout/ai-generate')} activeOpacity={0.8}>
              <Ionicons name="sparkles" size={16} color={colors.textInverse} />
              <Text style={[typography.labelLarge, { color: colors.textInverse, marginLeft: spacing.xs }]}>AI Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.cta, { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.primary, flex: 1 }]}
              onPress={handleEmptyStart} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.xs }]}>Empty Workout</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }
    // Rest Day
    return (
      <Card style={{ marginTop: spacing.base }}>
        <View style={S.actHead}>
          <View style={[S.actCircle, { backgroundColor: colors.successLight }]}><Ionicons name="leaf" size={24} color={colors.success} /></View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.labelSmall, { color: colors.success, textTransform: 'uppercase', letterSpacing: 1 }]}>REST DAY</Text>
            <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>Active Recovery</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>Stretch, walk, or light mobility work</Text>
          </View>
        </View>
        <View style={[S.row, { marginTop: spacing.base, gap: spacing.sm }]}>
          <TouchableOpacity style={[S.cta, { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.primary, flex: 1 }]}
            onPress={handleEmptyStart} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.xs }]}>Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cta, { backgroundColor: colors.primaryMuted, borderRadius: radius.md, paddingVertical: spacing.md, flex: 1 }]}
            onPress={() => router.push('/workout/ai-generate')} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.xs }]}>AI Workout</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }
}

// ── Styles ─────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Hero
  heroGrad: { paddingBottom: 4 },
  heroInner: { paddingTop: 12, paddingBottom: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  avatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  // Coaching
  coachCard: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  coachHead: { flexDirection: 'row', alignItems: 'center' },
  sparkle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  // Shared
  row: { flexDirection: 'row', alignItems: 'center' },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Workout
  actHead: { flexDirection: 'row', alignItems: 'center' },
  actCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  // Stats
  statsR: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statC: { alignItems: 'center', flex: 1 },
  vDiv: { width: 1, height: 32 },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 1 },
  // Quick Actions
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  quickBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  // Nutrition
  ringsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  ringItem: { alignItems: 'center', flex: 1, minHeight: 100 },
  // Insights
  insight: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 1 },
  insightIco: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  // Weekly
  wGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  wItem: { alignItems: 'center', width: '30%', marginBottom: 12 },
});
