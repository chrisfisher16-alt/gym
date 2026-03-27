import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform, Animated as RNAnimated, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { scale } from '../../src/theme/scale';

import { useToast } from '../../src/components/Toast';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';

// Lazy-load haptics (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWaterTracking } from '../../src/hooks/useWaterTracking';
import { useSupplements } from '../../src/hooks/useSupplements';
import { useNutritionHistory } from '../../src/hooks/useNutritionHistory';
import { useQuickActions } from '../../src/hooks/useQuickActions';
import {
  Button,
  Card,
  ScreenContainer,
  MacroBar,
  Badge,
  ErrorState,
  EmptyState,
  ExpandableCard,
  Sparkline,
  QuickActionSheet,
  AnimatedNumber,
  SwipeableRow,
  ProgressRing,
} from '../../src/components/ui';
import type { SwipeAction } from '../../src/components/ui';
import { CoachFAB } from '../../src/components/CoachFAB';
import { InNutritionCoach } from '../../src/components/InNutritionCoach';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { UpgradeBanner } from '../../src/components/UpgradeBanner';
import { checkMealLogLimit, type UsageCheck } from '../../src/lib/usage-limits';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SmartHeader } from '../../src/components/ui';
import { NutritionTabSkeleton } from '../../src/components/ui/SkeletonLayouts';
import {
  formatCalories,
  formatMealTime,
  getMealTypeLabel,
  getMealTypeIcon,
  formatDateDisplay,
  getDateString,
  calculateMealTotals,
} from '../../src/lib/nutrition-utils';
import type { MealEntry, MealType } from '../../src/types/nutrition';
import { generateInsights, type InsightContext as InsightCtx } from '../../src/lib/insight-engine';
import { InsightBadge } from '../../src/components/ui';
import { useCoachStore } from '../../src/stores/coach-store';
import { pullToRefreshThreshold } from '../../src/lib/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const RING_SIZE = scale(160);
const RING_STROKE = scale(12);


// ── Helpers ──────────────────────────────────────────────────────────

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Group today's meals by type and sum calories per group */
function getMealTypeBreakdown(meals: MealEntry[]) {
  const breakdown: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const meal of meals) {
    const totals = calculateMealTotals(meal.items);
    breakdown[meal.mealType] += totals.calories;
  }
  return breakdown;
}

export default function NutritionTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const initialize = useNutritionStore((s) => s.initialize);
  const isInitialized = useNutritionStore((s) => s.isInitialized);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);
  const saveMealAsTemplate = useNutritionStore((s) => s.saveMealAsTemplate);
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);
  const logMeal = useNutritionStore((s) => s.logMeal);
  const {
    selectedDate,
    setSelectedDate,
    targets,
    consumed,
    progress,
    meals,
    supplementsTaken,
  } = useNutritionDashboard();
  const { waterIntake, waterTarget, progress: waterProgress_hook, add8oz, add16oz, addCustom, subtract8oz } = useWaterTracking();
  const [showCustomWater, setShowCustomWater] = useState(false);
  const [customWaterAmount, setCustomWaterAmount] = useState('');
  const { activeSupplements, isSupplementTaken, logSupplement, unlogSupplement } = useSupplements();
  const [showSupplements, setShowSupplements] = useState(false);
  const [showNutritionCoach, setShowNutritionCoach] = useState(false);
  const { showToast } = useToast();
  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [mealUsage, setMealUsage] = useState<UsageCheck | null>(null);
  const waterRipple = React.useRef(new RNAnimated.Value(0)).current;
  const history = useNutritionHistory(7);
  const { show: showQuickActions, sheetProps } = useQuickActions();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    pullToRefreshThreshold();
    setRefreshing(true);
    try {
      await Promise.all([
        initialize(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [initialize]);

  // ── Inline Insights (nutrition only) ─────────────────────────────
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);
  const nutritionInsight = useMemo(() => {
    const hour = new Date().getHours();
    const ctx: InsightCtx = {
      caloriesConsumed: consumed.calories,
      caloriesTarget: targets.calories,
      proteinConsumed: consumed.protein_g,
      proteinTarget: targets.protein_g,
      waterConsumed: waterIntake,
      waterTarget: waterTarget,
      timeOfDay: hour,
    };
    return generateInsights(ctx)
      .filter((i) => i.category === 'nutrition')
      .slice(0, 1)[0] ?? null;
  }, [consumed, targets, waterIntake, waterTarget]);

  const handleAskInsight = useCallback((prompt: string) => {
    setPrefilledContext('nutrition', prompt);
    router.push('/(tabs)/coach');
  }, [setPrefilledContext, router]);

  const playWaterRipple = () => {
    waterRipple.setValue(0);
    RNAnimated.timing(waterRipple, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Check free tier meal limits
  useEffect(() => {
    if (tier === 'free') {
      checkMealLogLimit().then(setMealUsage);
    }
  }, [tier, meals.length]);

  const handleLogMeal = useCallback(() => {
    if (canAccess('unlimited_meals')) {
      router.push('/nutrition/log-meal');
      return;
    }
    checkMealLogLimit().then((usage) => {
      setMealUsage(usage);
      if (usage.allowed) {
        router.push('/nutrition/log-meal');
      } else {
        crossPlatformAlert(
          'Daily Meal Limit Reached',
          `You've logged ${usage.limit} meals today. Upgrade to Nutrition Coach for unlimited meal logging.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_meals', source: 'nutrition_tab' }) },
          ],
        );
      }
    });
  }, [canAccess, showPaywall, router]);

  const isToday = selectedDate === getDateString(new Date());

  const navigateDate = (direction: -1 | 1) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + direction);
    // Don't allow future dates
    if (direction > 0 && getDateString(current) > getDateString(new Date())) return;
    setSelectedDate(getDateString(current));
  };

  // ── Meal type breakdown for expanded calorie section ──
  const mealTypeBreakdown = useMemo(() => getMealTypeBreakdown(meals), [meals]);

  // ── Meal-by-meal macro breakdown for expanded macros section ──
  const mealMacroBreakdown = useMemo(() => {
    return meals.map((meal) => {
      const totals = calculateMealTotals(meal.items);
      return { name: meal.name, mealType: meal.mealType, ...totals };
    });
  }, [meals]);

  // ── Water streak (consecutive days with water logged) ──
  const waterStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    const todayStr = getDateString(today);
    const todayLog = dailyLogs[todayStr];
    const hasTodayWater = todayLog && todayLog.waterIntake_oz > 0;
    // If today has no water logged yet, start counting from yesterday
    const startOffset = hasTodayWater ? 0 : 1;
    for (let i = startOffset; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = getDateString(d);
      const log = dailyLogs[dateStr];
      if (log && log.waterIntake_oz > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [dailyLogs]);

  // ── Swipe: Re-log a meal (always logs to today) ──
  const handleRelogMeal = useCallback((meal: MealEntry) => {
    const today = getDateString(new Date());
    logMeal({
      mealType: meal.mealType,
      name: meal.name,
      source: meal.source,
      timestamp: new Date().toISOString(),
      items: meal.items.map((item) => ({
        ...item,
        id: `${item.id}_dup_${Date.now()}`,
      })),
    }, today);
    showToast('Meal re-logged for today', 'success', 1500);
  }, [logMeal, showToast]);

  // ── Swipe: Delete meal (with confirmation + brief toast) ──
  const handleDeleteMealSwipe = useCallback((meal: MealEntry) => {
    crossPlatformAlert('Delete Meal', 'Are you sure you want to delete this meal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteMeal(meal.id);
        showToast('Meal deleted', 'info', 2000);
      }},
    ]);
  }, [deleteMeal, showToast]);

  // ── Quick Actions for meal long-press ──
  const handleMealLongPress = useCallback((meal: MealEntry) => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mealTotals = calculateMealTotals(meal.items);
    showQuickActions({
      title: meal.name,
      subtitle: `${Math.round(mealTotals.calories)} cal · ${getMealTypeLabel(meal.mealType)}`,
      actions: [
        {
          id: 'edit',
          label: 'Edit Meal',
          icon: 'create-outline',
          onPress: () => router.push(`/nutrition/meal-detail?mealId=${meal.id}`),
        },
        {
          id: 'save_template',
          label: 'Save as Template',
          icon: 'bookmark-outline',
          onPress: () => {
            saveMealAsTemplate(meal);
            showToast('Meal saved as template', 'success', 1500);
          },
        },
        {
          id: 'log_again',
          label: 'Log Again',
          icon: 'copy-outline',
          onPress: () => {
            logMeal({
              mealType: meal.mealType,
              name: meal.name,
              source: meal.source,
              timestamp: new Date().toISOString(),
              items: meal.items.map((item) => ({
                ...item,
                id: `${item.id}_dup_${Date.now()}`,
              })),
            }, getDateString(new Date()));
            showToast('Meal logged again', 'success', 1500);
          },
        },
        {
          id: 'get_recipe',
          label: 'Get Recipe',
          icon: 'restaurant-outline',
          badge: 'AI',
          onPress: () => {
            setShowNutritionCoach(true);
          },
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => {
            crossPlatformAlert(
              'Delete Meal',
              `Are you sure you want to delete "${meal.name}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteMeal(meal.id);
                    showToast('Meal deleted', 'info', 1500);
                  },
                },
              ],
            );
          },
        },
      ],
    });
  }, [showQuickActions, router, saveMealAsTemplate, logMeal, deleteMeal, showToast]);

  if (!isInitialized) {
    return (
      <ScreenContainer>
        <NutritionTabSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      {/* Upgrade Banner for free users */}
      {tier === 'free' && (
        <UpgradeBanner
          plan="nutrition_coach"
          feature="unlimited_meals"
          source="nutrition_tab"
          message="Unlock unlimited meal logging with Nutrition Coach"
        />
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: colors.text }]}>Nutrition</Text>
          <SmartHeader tab="nutrition" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => router.push('/nutrition/targets')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="nutrition-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Selector */}
      <View style={[styles.dateSelector, { marginBottom: spacing.base }]}>
        <TouchableOpacity onPress={() => navigateDate(-1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedDate(getDateString())}>
          <Text style={[typography.labelLarge, { color: colors.text }]}>
            {formatDateDisplay(selectedDate)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigateDate(1)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          disabled={isToday}
          style={{ opacity: isToday ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ═══════════════════════════════════════════════════════════════
          A. Calorie Ring / Summary — ExpandableCard
          ═══════════════════════════════════════════════════════════════ */}
      <ExpandableCard
        style={{ marginBottom: spacing.base }}
        expandedContent={
          <View style={{ gap: spacing.md }}>
            {/* Meal-type breakdown */}
            <Text style={[typography.label, { color: colors.text }]}>By Meal Type</Text>
            {MEAL_TYPE_ORDER.map((type) => {
              const cal = mealTypeBreakdown[type];
              return (
                <View key={type} style={styles.breakdownRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons
                      name={getMealTypeIcon(type) as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={[typography.body, { color: colors.text }]}>{getMealTypeLabel(type)}</Text>
                  </View>
                  <Text style={[typography.label, { color: colors.text }]}>
                    {formatCalories(cal)} cal
                  </Text>
                </View>
              );
            })}

            {/* 7-day calorie trend */}
            {history.calories.length >= 2 && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
                  7-Day Calorie Trend
                </Text>
                <Sparkline
                  data={history.calories}
                  width={SCREEN_WIDTH - spacing.base * 4}
                  height={40}
                  showFill
                  showDots
                />
              </View>
            )}

            {/* Coach link */}
            <TouchableOpacity
              onPress={() => setShowNutritionCoach(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary }]}>What should I eat?</Text>
            </TouchableOpacity>
          </View>
        }
      >
        {/* Collapsed: Calorie ring + remaining (original layout) */}
        <View style={styles.ringContainer}>
          <View style={[styles.ring, { width: RING_SIZE, height: RING_SIZE }]}>
            <ProgressRing
              progress={Math.min(progress.calories, 1)}
              size={RING_SIZE}
              strokeWidth={RING_STROKE}
              color={progress.calories > 1 ? colors.warning : colors.calories}
              trackColor={colors.surfaceSecondary}
            >
              <AnimatedNumber
                value={consumed.calories}
                style={[typography.displayMedium, { color: colors.text }]}
                formatter={formatCalories}
              />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                / {formatCalories(targets.calories)} cal
              </Text>
            </ProgressRing>
          </View>

          <View style={[styles.remainingContainer, { marginTop: spacing.sm }]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {consumed.calories <= targets.calories
                ? `${formatCalories(targets.calories - consumed.calories)} remaining`
                : `${formatCalories(consumed.calories - targets.calories)} over`}
            </Text>
          </View>
        </View>
      </ExpandableCard>

      {/* Inline insight */}
      {nutritionInsight && (
        <View style={{ marginBottom: spacing.base }}>
          <InsightBadge
            insight={nutritionInsight}
            onAskMore={nutritionInsight.coachPrompt ? () => handleAskInsight(nutritionInsight.coachPrompt!) : undefined}
          />
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          B. Macro Bars — ExpandableCard
          ═══════════════════════════════════════════════════════════════ */}
      <ExpandableCard
        style={{ marginBottom: spacing.base }}
        expandedContent={
          <View style={{ gap: spacing.lg }}>
            {/* 7-day sparklines per macro */}
            <Text style={[typography.label, { color: colors.text }]}>7-Day Trends</Text>
            {([
              { label: 'Protein', data: history.protein, current: consumed.protein_g, target: targets.protein_g, color: colors.protein },
              { label: 'Carbs', data: history.carbs, current: consumed.carbs_g, target: targets.carbs_g, color: colors.carbs },
              { label: 'Fat', data: history.fat, current: consumed.fat_g, target: targets.fat_g, color: colors.fat },
              { label: 'Fiber', data: history.fiber, current: consumed.fiber_g, target: targets.fiber_g, color: colors.fiber },
            ] as const).map((macro) => (
              <View key={macro.label} style={{ gap: spacing.xs }}>
                <View style={styles.macroTrendRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>{macro.label}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {Math.round(macro.current)}g / {macro.target}g ({macro.target > 0 ? Math.round((macro.current / macro.target) * 100) : 0}%)
                    </Text>
                  </View>
                  {macro.data.length >= 2 && (
                    <Sparkline variant="inline" data={macro.data} trendColor={macro.color} />
                  )}
                </View>
              </View>
            ))}

            {/* Meal-by-meal breakdown */}
            {mealMacroBreakdown.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>By Meal</Text>
                {mealMacroBreakdown.map((m, i) => (
                  <View key={i} style={[styles.breakdownRow, { paddingVertical: spacing.xs }]}>
                    <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      P:{Math.round(m.protein_g)} C:{Math.round(m.carbs_g)} F:{Math.round(m.fat_g)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        }
      >
        {/* Collapsed: Macro progress bars + inline sparklines */}
        <View style={{ gap: spacing.md }}>
          {([
            { label: 'Protein', current: consumed.protein_g, target: targets.protein_g, color: colors.protein, data: history.protein },
            { label: 'Carbs', current: consumed.carbs_g, target: targets.carbs_g, color: colors.carbs, data: history.carbs },
            { label: 'Fat', current: consumed.fat_g, target: targets.fat_g, color: colors.fat, data: history.fat },
            { label: 'Fiber', current: consumed.fiber_g, target: targets.fiber_g, color: colors.fiber, data: history.fiber },
          ] as const).map((macro) => (
            <View key={macro.label} style={{ gap: spacing.xs }}>
              <MacroBar label={macro.label} current={macro.current} target={macro.target} color={macro.color} />
              {macro.data.length >= 2 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Sparkline variant="inline" data={macro.data} trendColor={macro.color} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ExpandableCard>

      {/* ═══════════════════════════════════════════════════════════════
          C. Hydration Tracker — ExpandableCard
          ═══════════════════════════════════════════════════════════════ */}
      <ExpandableCard
        style={{ marginBottom: spacing.base }}
        expandedContent={
          <View style={{ gap: spacing.md }}>
            {/* Weekly water sparkline */}
            {history.water.length >= 2 && (
              <View>
                <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
                  7-Day Water Intake
                </Text>
                <Sparkline
                  data={history.water}
                  width={SCREEN_WIDTH - spacing.base * 4}
                  height={40}
                  showFill
                  showDots
                  color={colors.info}
                />
              </View>
            )}

            {/* Streak */}
            {waterStreak > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="flame" size={18} color={colors.warning} />
                <Text style={[typography.body, { color: colors.text }]}>
                  {waterStreak} day hydration streak!
                </Text>
              </View>
            )}

            {/* Daily goal progress detail */}
            <View style={styles.breakdownRow}>
              <Text style={[typography.body, { color: colors.text }]}>Daily Goal</Text>
              <Text style={[typography.label, { color: colors.text }]}>
                {Math.round(waterIntake)} / {Math.round(waterTarget)} oz ({waterTarget > 0 ? Math.round((waterIntake / waterTarget) * 100) : 0}%)
              </Text>
            </View>
          </View>
        }
      >
        {/* Collapsed: Water display with add buttons */}
        <View style={styles.waterHeader}>
          <View style={styles.waterLeft}>
            <Ionicons name="water" size={20} color={colors.info} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
              Hydration
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            <AnimatedNumber value={Math.round(waterIntake)} style={[typography.body, { color: colors.textSecondary }]} /> / {Math.round(waterTarget)} oz
          </Text>
        </View>

        {/* Water Progress Ring */}
        <View style={styles.waterRingContainer}>
          <View style={[styles.waterRing, { width: scale(100), height: scale(100) }]}>
            <ProgressRing
              progress={waterTarget > 0 ? Math.min(waterIntake / waterTarget, 1) : 0}
              size={scale(100)}
              strokeWidth={scale(8)}
              color={(waterTarget > 0 && waterIntake >= waterTarget) ? colors.active : colors.info}
              trackColor={colors.surfaceSecondary}
            >
              <Ionicons name="water" size={18} color={colors.info} />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {waterTarget > 0 ? Math.round((waterIntake / waterTarget) * 100) : 0}%
              </Text>
            </ProgressRing>
          </View>
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <AnimatedNumber
              value={Math.round(waterIntake)}
              style={[typography.h2, { color: colors.text }]}
              formatter={(n: number) => `${Math.round(n)} oz`}
            />
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              of {Math.round(waterTarget)} oz goal
            </Text>
          </View>
        </View>

        {/* Quick-Add Buttons */}
        {/* Water ripple overlay */}
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: colors.info,
            borderRadius: radius.lg,
            opacity: waterRipple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.15, 0.08, 0] }),
            transform: [{ scale: waterRipple.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.02] }) }],
          }}
        />

        <View style={[styles.waterQuickActions, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: colors.infoLight, borderRadius: radius.md }]}
            onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); add8oz(); playWaterRipple(); showToast('+8oz water logged', 'info', 1500); }}
            activeOpacity={0.7}
          >
            <Ionicons name="water-outline" size={18} color={colors.info} />
            <Text style={[typography.label, { color: colors.info, marginLeft: 6 }]}>8oz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: colors.infoLight, borderRadius: radius.md }]}
            onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); add16oz(); playWaterRipple(); showToast('+16oz water logged', 'info', 1500); }}
            activeOpacity={0.7}
          >
            <Ionicons name="water" size={18} color={colors.info} />
            <Text style={[typography.label, { color: colors.info, marginLeft: 6 }]}>16oz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: colors.infoLight, borderRadius: radius.md }]}
            onPress={() => setShowCustomWater(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.info} />
            <Text style={[typography.label, { color: colors.info, marginLeft: 6 }]}>Custom</Text>
          </TouchableOpacity>
        </View>
      </ExpandableCard>

      {/* Custom Water Modal */}
      <Modal
        visible={showCustomWater}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomWater(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomWater(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.customWaterModal, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
                Add Water
              </Text>
              <TextInput
                style={[
                  styles.customWaterInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    color: colors.text,
                    ...typography.h2,
                  },
                ]}
                value={customWaterAmount}
                onChangeText={setCustomWaterAmount}
                keyboardType="numeric"
                placeholder="Amount in oz"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                {customWaterAmount ? `${customWaterAmount} oz` : 'Enter amount in ounces'}
              </Text>
              <View style={[styles.customWaterButtons, { marginTop: spacing.lg }]}>
                <TouchableOpacity
                  style={[styles.customWaterCancel, { borderRadius: radius.md }]}
                  onPress={() => {
                    setShowCustomWater(false);
                    setCustomWaterAmount('');
                  }}
                >
                  <Text style={[typography.label, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customWaterConfirm,
                    {
                      backgroundColor: colors.info,
                      borderRadius: radius.md,
                      opacity: customWaterAmount && parseInt(customWaterAmount, 10) > 0 ? 1 : 0.5,
                    },
                  ]}
                  onPress={() => {
                    let oz = parseInt(customWaterAmount, 10);
                    if (oz > 0) {
                      if (oz > 200) {
                        showToast('Maximum 200 oz', 'warning', 1500);
                        oz = 200;
                      }
                      addCustom(oz);
                      setShowCustomWater(false);
                      setCustomWaterAmount('');
                    }
                  }}
                  disabled={!customWaterAmount || parseInt(customWaterAmount, 10) <= 0}
                >
                  <Text style={[typography.label, { color: colors.textOnPrimary }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          D. Today's Meals — Each meal is an ExpandableCard
          ═══════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: spacing.base }}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {formatDateDisplay(selectedDate) === 'Today' ? "Today's Meals" : 'Meals'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {meals.length} logged
          </Text>
        </View>

        {meals.length === 0 ? (
          <Card>
            <EmptyState
              icon="restaurant-outline"
              title="No Meals Logged"
              description={formatDateDisplay(selectedDate) === 'Today' ? 'Start tracking your nutrition by logging your first meal.' : 'No meals were logged on this day.'}
              actionLabel={formatDateDisplay(selectedDate) === 'Today' ? 'Log Your First Meal' : undefined}
              onAction={formatDateDisplay(selectedDate) === 'Today' ? handleLogMeal : undefined}
            />
          </Card>
        ) : (
          meals
            .slice()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((meal) => {
              const mealTotals = calculateMealTotals(meal.items);
              const relogAction: SwipeAction = {
                label: 'Re-log',
                icon: 'repeat',
                color: colors.primary,
                onTrigger: () => handleRelogMeal(meal),
              };
              const deleteAction: SwipeAction = {
                label: 'Delete',
                icon: 'trash',
                color: colors.error,
                onTrigger: () => handleDeleteMealSwipe(meal),
              };
              return (
                <SwipeableRow
                  key={meal.id}
                  leftAction={relogAction}
                  rightAction={deleteAction}
                  style={{ marginBottom: spacing.sm }}
                >
                <ExpandableCard
                  expandedContent={
                    <View style={{ gap: spacing.sm }}>
                      {/* Full item list */}
                      {meal.items.length > 0 && (
                        <View style={{ gap: spacing.xs }}>
                          <Text style={[typography.label, { color: colors.text }]}>Items</Text>
                          {meal.items.map((item) => (
                            <View key={item.id} style={[styles.breakdownRow, { paddingVertical: 2 }]}>
                              <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                                {item.name} {item.quantity > 1 ? `× ${item.quantity}` : ''}
                              </Text>
                              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                                {Math.round(item.calories)} cal
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Nutrition facts detail */}
                      <View style={[styles.nutritionFacts, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm }]}>
                        <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>Nutrition Facts</Text>
                        <View style={styles.breakdownRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Calories</Text>
                          <Text style={[typography.bodySmall, { color: colors.text }]}>{Math.round(mealTotals.calories)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Protein</Text>
                          <Text style={[typography.bodySmall, { color: colors.text }]}>{Math.round(mealTotals.protein_g)}g</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Carbs</Text>
                          <Text style={[typography.bodySmall, { color: colors.text }]}>{Math.round(mealTotals.carbs_g)}g</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Fat</Text>
                          <Text style={[typography.bodySmall, { color: colors.text }]}>{Math.round(mealTotals.fat_g)}g</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Fiber</Text>
                          <Text style={[typography.bodySmall, { color: colors.text }]}>{Math.round(mealTotals.fiber_g)}g</Text>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <TouchableOpacity
                          style={[styles.mealActionButton, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
                          onPress={() => router.push(`/nutrition/meal-detail?mealId=${meal.id}`)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.primary} />
                          <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.xs }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.mealActionButton, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
                          onPress={() => {
                            saveMealAsTemplate(meal);
                            showToast('Saved as template', 'success', 1500);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                          <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.xs }]}>Save as Template</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  }
                >
                  {/* Collapsed: Meal name + total macros summary — with long-press */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push(`/nutrition/meal-detail?mealId=${meal.id}`)}
                    onLongPress={() => handleMealLongPress(meal)}
                    delayLongPress={400}
                  >
                    <View style={styles.mealCard}>
                      <View style={styles.mealLeft}>
                        <View style={styles.mealHeader}>
                          <Badge
                            label={getMealTypeLabel(meal.mealType)}
                            variant={
                              meal.mealType === 'breakfast' ? 'warning' :
                              meal.mealType === 'lunch' ? 'info' :
                              meal.mealType === 'dinner' ? 'pro' : 'default'
                            }
                          />
                          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginLeft: spacing.sm }]}>
                            {formatMealTime(meal.timestamp)}
                          </Text>
                        </View>
                        <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>
                          {meal.name}
                        </Text>
                        {meal.items.length > 0 && (
                          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                            {meal.items.map((i) => i.name).join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.mealRight}>
                        <AnimatedNumber
                          value={Math.round(mealTotals.calories)}
                          style={[typography.labelLarge, { color: colors.text }]}
                        />
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>cal</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </ExpandableCard>
                </SwipeableRow>
              );
            })
        )}
      </View>

      {/* Supplements Section */}
      {activeSupplements.length > 0 && (
        <View style={{ marginBottom: spacing.base }}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowSupplements(!showSupplements)}
            activeOpacity={0.7}
          >
            <View style={styles.supplementsTitle}>
              <Text style={[typography.h3, { color: colors.text }]}>Supplements</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                {supplementsTaken.length}/{activeSupplements.length}
              </Text>
            </View>
            <Ionicons
              name={showSupplements ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showSupplements && (
            <Card>
              {activeSupplements.map((supp, index) => {
                const taken = isSupplementTaken(supp.id);
                return (
                  <TouchableOpacity
                    key={supp.id}
                    style={[
                      styles.supplementRow,
                      index < activeSupplements.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                        paddingBottom: spacing.md,
                        marginBottom: spacing.md,
                      },
                    ]}
                    onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); taken ? unlogSupplement(supp.id) : logSupplement(supp.id); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={taken ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={taken ? colors.completed : colors.textTertiary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[typography.label, { color: taken ? colors.textSecondary : colors.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
                        {supp.supplementName}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {supp.dose} {supp.unit}
                        {supp.streak > 0 ? ` · ${supp.streak} day${supp.streak !== 1 ? 's' : ''} streak` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Card>
          )}

          <TouchableOpacity
            style={{ marginTop: spacing.sm }}
            onPress={() => router.push('/nutrition/supplements')}
          >
            <Text style={[typography.label, { color: colors.primary, textAlign: 'center' }]}>
              Manage Supplements
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Links */}
      <View style={[styles.quickLinks, { marginBottom: spacing.base }]}>
        <TouchableOpacity
          style={[styles.quickLink, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
          onPress={() => router.push('/nutrition/saved-meals')}
          activeOpacity={0.7}
        >
          <Ionicons name="bookmark-outline" size={24} color={colors.primary} />
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>Saved Meals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickLink, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
          onPress={() => router.push('/nutrition/recipes')}
          activeOpacity={0.7}
        >
          <Ionicons name="book-outline" size={24} color={colors.primary} />
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickLink, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
          onPress={() => router.push('/nutrition/grocery-list')}
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={24} color={colors.primary} />
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>Grocery List</Text>
        </TouchableOpacity>
        {activeSupplements.length === 0 && (
          <TouchableOpacity
            style={[styles.quickLink, { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight }]}
            onPress={() => router.push('/nutrition/supplements')}
            activeOpacity={0.7}
          >
            <Ionicons name="medical-outline" size={24} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>Supplements</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ask Nutrition Coach (inline) */}
      <TouchableOpacity
        onPress={() => setShowNutritionCoach(true)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: colors.primary,
          borderRadius: 20,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.sm,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.textInverse} />
        <Text
          style={{
            color: colors.textInverse,
            fontSize: 13,
            fontWeight: '600',
            marginLeft: spacing.xs,
          }}
        >
          Ask Coach
        </Text>
      </TouchableOpacity>

      {/* Inline Nutrition Coach */}
      <InNutritionCoach
        visible={showNutritionCoach}
        onClose={() => setShowNutritionCoach(false)}
      />

      {/* Spacer for FAB */}
      <View style={{ height: 80 }} />

      {/* FAB - Log Meal */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: spacing['2xl'] }]}
        onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleLogMeal(); }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
        <Text style={[typography.label, { color: colors.textInverse, marginLeft: spacing.xs }]}>
          Log Meal{tier === 'free' && mealUsage ? ` (${mealUsage.remaining})` : ''}
        </Text>
      </TouchableOpacity>
      </Animated.View>

      {/* QuickActionSheet — single instance at bottom */}
      <QuickActionSheet {...sheetProps} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  ringContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  remainingContainer: {
    alignItems: 'center',
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterRingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  waterRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  waterQuickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  waterQuickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customWaterModal: {
    width: 300,
    padding: 24,
  },
  customWaterInput: {
    textAlign: 'center',
    paddingVertical: 12,
    minHeight: 52,
  },
  customWaterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  customWaterCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  customWaterConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
  },
  emptyMeals: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  mealCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealLeft: {
    flex: 1,
    marginRight: 12,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  supplementsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  // ── New styles for expandable sections ──
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroTrendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionFacts: {
    gap: 4,
  },
  mealActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
