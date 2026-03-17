import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Dimensions, Alert, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';

import { useToast } from '../../src/components/Toast';

// Lazy-load haptics (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useNutritionDashboard } from '../../src/hooks/useNutritionDashboard';
import { useWaterTracking } from '../../src/hooks/useWaterTracking';
import { useSupplements } from '../../src/hooks/useSupplements';
import {
  Button,
  Card,
  ScreenContainer,
  MacroBar,
  Badge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
} from '../../src/components/ui';
import { CoachFAB } from '../../src/components/CoachFAB';
import { InNutritionCoach } from '../../src/components/InNutritionCoach';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { UpgradeBanner } from '../../src/components/UpgradeBanner';
import { checkMealLogLimit, incrementUsage, type UsageCheck } from '../../src/lib/usage-limits';
import {
  formatCalories,
  formatMealTime,
  getMealTypeLabel,
  getMealTypeIcon,
  formatDateDisplay,
  getDateString,
  calculateMealTotals,
} from '../../src/lib/nutrition-utils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function NutritionTab() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const initialize = useNutritionStore((s) => s.initialize);
  const isInitialized = useNutritionStore((s) => s.isInitialized);
  const {
    selectedDate,
    setSelectedDate,
    targets,
    consumed,
    progress,
    meals,
    supplementsTaken,
  } = useNutritionDashboard();
  const { waterIntake, waterTarget, glasses, targetGlasses, addGlass, add8oz, add16oz, addCustom } = useWaterTracking();
  const [showCustomWater, setShowCustomWater] = useState(false);
  const [customWaterAmount, setCustomWaterAmount] = useState('');
  const { activeSupplements, isSupplementTaken, logSupplement, unlogSupplement } = useSupplements();
  const [showSupplements, setShowSupplements] = useState(false);
  const [showNutritionCoach, setShowNutritionCoach] = useState(false);
  const { showToast } = useToast();
  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [mealUsage, setMealUsage] = useState<UsageCheck | null>(null);
  const waterRipple = React.useRef(new Animated.Value(0)).current;

  const playWaterRipple = () => {
    waterRipple.setValue(0);
    Animated.timing(waterRipple, {
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
        incrementUsage('meal_logs');
        router.push('/nutrition/log-meal');
      } else {
        Alert.alert(
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

  const navigateDate = (direction: -1 | 1) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + direction);
    setSelectedDate(getDateString(current));
  };

  const calorieStroke = Math.min(progress.calories, 1) * RING_CIRCUMFERENCE;
  const calorieOffset = RING_CIRCUMFERENCE - calorieStroke;

  if (!isInitialized) {
    return (
      <ScreenContainer>
        <LoadingSpinner fullScreen message="Loading nutrition data..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
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
        <Text style={[typography.h1, { color: colors.text }]}>Nutrition</Text>
        <TouchableOpacity onPress={() => router.push('/nutrition/targets')}>
          <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigateDate(1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Calorie Ring + Macros */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.ringContainer}>
          {/* SVG-like ring using View borders */}
          <View style={[styles.ring, { width: RING_SIZE, height: RING_SIZE }]}>
            {/* Background ring */}
            <View
              style={[
                styles.ringTrack,
                {
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderRadius: RING_SIZE / 2,
                  borderWidth: RING_STROKE,
                  borderColor: colors.surfaceSecondary,
                },
              ]}
            />
            {/* Progress ring - using a clever approach with rotating half circles */}
            <View
              style={[
                styles.ringProgress,
                {
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderRadius: RING_SIZE / 2,
                  borderWidth: RING_STROKE,
                  borderColor: progress.calories > 1 ? colors.warning : colors.calories,
                  borderTopColor: progress.calories >= 0.25 ? (progress.calories > 1 ? colors.warning : colors.calories) : 'transparent',
                  borderRightColor: progress.calories >= 0.5 ? (progress.calories > 1 ? colors.warning : colors.calories) : 'transparent',
                  borderBottomColor: progress.calories >= 0.75 ? (progress.calories > 1 ? colors.warning : colors.calories) : 'transparent',
                  borderLeftColor: progress.calories > 0 ? (progress.calories > 1 ? colors.warning : colors.calories) : 'transparent',
                  transform: [{ rotate: '-90deg' }],
                },
              ]}
            />
            {/* Center text */}
            <View style={styles.ringCenter}>
              <Text style={[typography.displayMedium, { color: colors.text }]}>
                {formatCalories(consumed.calories)}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                / {formatCalories(targets.calories)} cal
              </Text>
            </View>
          </View>

          {/* Remaining */}
          <View style={[styles.remainingContainer, { marginTop: spacing.sm }]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {consumed.calories <= targets.calories
                ? `${formatCalories(targets.calories - consumed.calories)} remaining`
                : `${formatCalories(consumed.calories - targets.calories)} over`}
            </Text>
          </View>
        </View>

        {/* Macro Bars */}
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <MacroBar label="Protein" current={consumed.protein_g} target={targets.protein_g} color={colors.protein} />
          <MacroBar label="Carbs" current={consumed.carbs_g} target={targets.carbs_g} color={colors.carbs} />
          <MacroBar label="Fat" current={consumed.fat_g} target={targets.fat_g} color={colors.fat} />
          <MacroBar label="Fiber" current={consumed.fiber_g} target={targets.fiber_g} color={colors.fiber} />
        </View>
      </Card>

      {/* Hydration Tracker */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.waterHeader}>
          <View style={styles.waterLeft}>
            <Ionicons name="water" size={20} color="#3B82F6" />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
              Hydration
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {glasses}/{targetGlasses} glasses
          </Text>
        </View>

        {/* Water Progress Ring */}
        <View style={styles.waterRingContainer}>
          <View style={[styles.waterRing, { width: 100, height: 100 }]}>
            <View
              style={[
                styles.waterRingTrack,
                {
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 8,
                  borderColor: colors.surfaceSecondary,
                },
              ]}
            />
            {(() => {
              const waterProgress = Math.min(waterIntake / waterTarget, 1);
              return (
                <View
                  style={[
                    styles.waterRingProgress,
                    {
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      borderWidth: 8,
                      borderColor: waterProgress >= 1 ? '#22C55E' : '#3B82F6',
                      borderTopColor: waterProgress >= 0.25 ? (waterProgress >= 1 ? '#22C55E' : '#3B82F6') : 'transparent',
                      borderRightColor: waterProgress >= 0.5 ? (waterProgress >= 1 ? '#22C55E' : '#3B82F6') : 'transparent',
                      borderBottomColor: waterProgress >= 0.75 ? (waterProgress >= 1 ? '#22C55E' : '#3B82F6') : 'transparent',
                      borderLeftColor: waterProgress > 0 ? (waterProgress >= 1 ? '#22C55E' : '#3B82F6') : 'transparent',
                      transform: [{ rotate: '-90deg' }],
                    },
                  ]}
                />
              );
            })()}
            <View style={styles.waterRingCenter}>
              <Ionicons name="water" size={18} color="#3B82F6" />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {Math.round((waterIntake / waterTarget) * 100)}%
              </Text>
            </View>
          </View>
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <Text style={[typography.h2, { color: colors.text }]}>
              {waterIntake}ml
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              of {waterTarget}ml goal
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
              {Math.round(waterIntake / 29.574)}oz / {Math.round(waterTarget / 29.574)}oz
            </Text>
          </View>
        </View>

        {/* Quick-Add Buttons */}
        {/* Water ripple overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#3B82F6',
            borderRadius: radius.lg,
            opacity: waterRipple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.15, 0.08, 0] }),
            transform: [{ scale: waterRipple.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.02] }) }],
          }}
        />

        <View style={[styles.waterQuickActions, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: '#EFF6FF', borderRadius: radius.md }]}
            onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); add8oz(); playWaterRipple(); showToast('+8oz water logged', 'info', 1500); }}
            activeOpacity={0.7}
          >
            <Ionicons name="water-outline" size={18} color="#3B82F6" />
            <Text style={[typography.label, { color: '#3B82F6', marginLeft: 6 }]}>8oz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: '#EFF6FF', borderRadius: radius.md }]}
            onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); add16oz(); playWaterRipple(); showToast('+16oz water logged', 'info', 1500); }}
            activeOpacity={0.7}
          >
            <Ionicons name="water" size={18} color="#3B82F6" />
            <Text style={[typography.label, { color: '#3B82F6', marginLeft: 6 }]}>16oz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterQuickButton, { backgroundColor: '#EFF6FF', borderRadius: radius.md }]}
            onPress={() => setShowCustomWater(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={18} color="#3B82F6" />
            <Text style={[typography.label, { color: '#3B82F6', marginLeft: 6 }]}>Custom</Text>
          </TouchableOpacity>
        </View>
      </Card>

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
                placeholder="Amount in ml"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                {customWaterAmount ? `${Math.round(parseInt(customWaterAmount) / 29.574)}oz` : 'Enter amount in milliliters'}
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
                      backgroundColor: '#3B82F6',
                      borderRadius: radius.md,
                      opacity: customWaterAmount && parseInt(customWaterAmount) > 0 ? 1 : 0.5,
                    },
                  ]}
                  onPress={() => {
                    const ml = parseInt(customWaterAmount);
                    if (ml > 0) {
                      addCustom(ml);
                      setShowCustomWater(false);
                      setCustomWaterAmount('');
                    }
                  }}
                  disabled={!customWaterAmount || parseInt(customWaterAmount) <= 0}
                >
                  <Text style={[typography.label, { color: '#FFFFFF' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Today's Meals */}
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
              return (
                <TouchableOpacity
                  key={meal.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/nutrition/meal-detail?mealId=${meal.id}`)}
                >
                  <Card style={{ marginBottom: spacing.sm }}>
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
                        <Text style={[typography.labelLarge, { color: colors.text }]}>
                          {Math.round(mealTotals.calories)}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>cal</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
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
                      color={taken ? colors.success : colors.textTertiary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[typography.label, { color: taken ? colors.textSecondary : colors.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
                        {supp.supplementName}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {supp.dose} {supp.unit}
                        {supp.streak > 0 ? ` · ${supp.streak} day streak` : ''}
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
  ringTrack: {
    position: 'absolute',
  },
  ringProgress: {
    position: 'absolute',
  },
  ringCenter: {
    alignItems: 'center',
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
  waterRingTrack: {
    position: 'absolute',
  },
  waterRingProgress: {
    position: 'absolute',
  },
  waterRingCenter: {
    alignItems: 'center',
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
});
