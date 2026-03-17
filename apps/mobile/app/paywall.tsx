import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useEntitlement } from '../src/hooks/useEntitlement';
import {
  getPlanList,
  PRICING_FLAGS,
  type PlanConfig,
} from '../src/lib/pricing-config';
import { APP_CONFIG } from '@health-coach/shared';

type BillingPeriod = 'monthly' | 'yearly';

export default function PaywallScreen() {
  const params = useLocalSearchParams<{
    feature?: string;
    requiredPlan?: string;
    source?: string;
  }>();

  const { colors, spacing, radius, typography, dark } = useTheme();
  const { tier, tierName } = useEntitlement();
  const {
    isSubscribed,
    offerings,
    isLoading,
    purchase,
    restore,
  } = useSubscriptionStore();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>(
    params.requiredPlan ?? 'full_health_coach',
  );
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const plans = getPlanList();

  // Auto-select highlighted plan if no required plan specified
  useEffect(() => {
    if (!params.requiredPlan) {
      const highlighted = plans.find((p) => p.highlight);
      if (highlighted) setSelectedPlan(highlighted.id);
    }
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!offerings?.current) {
      Alert.alert(
        'Unavailable',
        'Subscription packages are not available right now. Please try again later.',
      );
      return;
    }

    // Find the matching package from offerings
    const packages = offerings.current.availablePackages;
    const suffix = billingPeriod === 'yearly' ? 'annual' : 'monthly';
    const packageId = `hc_${selectedPlan}_${suffix}`;
    const pkg = packages.find((p) => p.product.identifier === packageId);

    if (!pkg) {
      // In dev/test mode, show a simulated success
      if (__DEV__) {
        Alert.alert(
          'Development Mode',
          `Would purchase: ${selectedPlan} (${billingPeriod}).\nRevenueCat packages not available in dev mode.`,
        );
        return;
      }
      Alert.alert('Error', 'Package not found. Please try again.');
      return;
    }

    setPurchaseLoading(true);
    const result = await purchase(pkg);
    setPurchaseLoading(false);

    if (result.success) {
      setShowSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2000);
    } else if (result.error && result.error !== 'cancelled') {
      Alert.alert('Purchase Failed', result.error);
    }
  }, [offerings, billingPeriod, selectedPlan, purchase]);

  const handleRestore = useCallback(async () => {
    setRestoreLoading(true);
    const result = await restore();
    setRestoreLoading(false);

    if (result.success) {
      Alert.alert('Restored', 'Your purchases have been restored.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert(
        'Restore Failed',
        result.error ?? 'No previous purchases found.',
      );
    }
  }, [restore]);

  // Success overlay
  if (showSuccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: colors.successLight, borderRadius: radius.full },
            ]}
          >
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text
            style={[
              typography.h1,
              { color: colors.text, marginTop: spacing.xl, textAlign: 'center' },
            ]}
          >
            Welcome Aboard!
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: spacing.sm,
                textAlign: 'center',
              },
            ]}
          >
            Your subscription is now active. Enjoy your premium features!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button */}
      <View style={[styles.topBar, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[
            styles.closeButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.full,
              width: 36,
              height: 36,
            },
          ]}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>

        {isSubscribed && (
          <View
            style={[
              styles.currentPlanBadge,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Ionicons name="diamond" size={14} color={colors.primary} />
            <Text
              style={[
                typography.labelSmall,
                { color: colors.primary, marginLeft: spacing.xs },
              ]}
            >
              {tierName}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { marginBottom: spacing.xl }]}>
          <Text
            style={[
              typography.displayLarge,
              { color: colors.text, textAlign: 'center' },
            ]}
          >
            Unlock Your{'\n'}Full Potential
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            Choose the plan that fits your goals
          </Text>
        </View>

        {/* Billing Toggle */}
        {PRICING_FLAGS.annualPricingEnabled && (
          <View
            style={[
              styles.billingToggle,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.lg,
                padding: 4,
                marginBottom: spacing.xl,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.billingOption,
                {
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: spacing.md,
                },
                billingPeriod === 'monthly' && {
                  backgroundColor: colors.surface,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 1,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
              onPress={() => setBillingPeriod('monthly')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color:
                      billingPeriod === 'monthly'
                        ? colors.text
                        : colors.textSecondary,
                    textAlign: 'center',
                  },
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.billingOption,
                {
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: spacing.md,
                },
                billingPeriod === 'yearly' && {
                  backgroundColor: colors.surface,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 1,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
              onPress={() => setBillingPeriod('yearly')}
              activeOpacity={0.7}
            >
              <View style={styles.yearlyLabel}>
                <Text
                  style={[
                    typography.label,
                    {
                      color:
                        billingPeriod === 'yearly'
                          ? colors.text
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Yearly
                </Text>
                {PRICING_FLAGS.showSavingsPercentage && (
                  <View
                    style={[
                      styles.savingsBadge,
                      {
                        backgroundColor: colors.success + '20',
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.xs,
                        marginLeft: spacing.xs,
                      },
                    ]}
                  >
                    <Text
                      style={[typography.caption, { color: colors.success, fontWeight: '600' }]}
                    >
                      Save 16%
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan Cards */}
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingPeriod={billingPeriod}
            isSelected={selectedPlan === plan.id}
            isCurrent={tier === plan.id}
            onSelect={() => setSelectedPlan(plan.id)}
          />
        ))}

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.ctaButton,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing.base,
              marginTop: spacing.xl,
              opacity: purchaseLoading ? 0.7 : 1,
            },
          ]}
          onPress={handlePurchase}
          disabled={purchaseLoading || isLoading}
          activeOpacity={0.7}
        >
          {purchaseLoading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text
              style={[
                typography.labelLarge,
                { color: colors.textInverse, textAlign: 'center' },
              ]}
            >
              {PRICING_FLAGS.trialDays > 0
                ? `Start ${PRICING_FLAGS.trialDays}-Day Free Trial`
                : 'Subscribe Now'}
            </Text>
          )}
        </TouchableOpacity>

        {PRICING_FLAGS.trialDays > 0 && (
          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            Cancel anytime during your trial. No charge until trial ends.
          </Text>
        )}

        {/* Restore */}
        <TouchableOpacity
          style={[styles.restoreButton, { marginTop: spacing.xl }]}
          onPress={handleRestore}
          disabled={restoreLoading}
          activeOpacity={0.7}
        >
          {restoreLoading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text
              style={[
                typography.label,
                { color: colors.textSecondary, textAlign: 'center' },
              ]}
            >
              Restore Purchases
            </Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <View style={[styles.legalLinks, { marginTop: spacing.lg, marginBottom: spacing['3xl'] }]}>
          <TouchableOpacity onPress={() => Linking.openURL(APP_CONFIG.termsUrl)}>
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textDecorationLine: 'underline' },
              ]}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>
          <Text style={[typography.caption, { color: colors.textTertiary, marginHorizontal: spacing.sm }]}>
            ·
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(APP_CONFIG.privacyUrl)}>
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textDecorationLine: 'underline' },
              ]}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Plan Card Component ───────────────────────────────────────────────

function PlanCard({
  plan,
  billingPeriod,
  isSelected,
  isCurrent,
  onSelect,
}: {
  plan: PlanConfig;
  billingPeriod: BillingPeriod;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  const price = billingPeriod === 'yearly' ? plan.priceYearly : plan.price;
  const monthlyEquiv =
    billingPeriod === 'yearly' && plan.monthlyEquivalent
      ? plan.monthlyEquivalent
      : null;

  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          marginBottom: spacing.md,
          borderWidth: 2,
          borderColor: isSelected ? colors.primary : colors.borderLight,
        },
        plan.highlight &&
          isSelected && {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 4,
          },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Badge */}
      {plan.badge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              position: 'absolute',
              top: -12,
              right: spacing.base,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textInverse, fontWeight: '700' }]}>
            {plan.badge}
          </Text>
        </View>
      )}

      {/* Current plan indicator */}
      {isCurrent && (
        <View
          style={[
            styles.currentBadge,
            {
              backgroundColor: colors.successLight,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              marginBottom: spacing.sm,
              alignSelf: 'flex-start',
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.success, fontWeight: '600' }]}>
            Current Plan
          </Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { color: colors.text }]}>{plan.name}</Text>
          <View style={styles.priceRow}>
            <Text style={[typography.h1, { color: colors.text }]}>{price}</Text>
            {monthlyEquiv && (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textTertiary, marginLeft: spacing.sm },
                ]}
              >
                ({monthlyEquiv})
              </Text>
            )}
          </View>
        </View>

        {/* Selection indicator */}
        <View
          style={[
            styles.radioOuter,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              borderWidth: 2,
              borderRadius: radius.full,
              width: 24,
              height: 24,
            },
          ]}
        >
          {isSelected && (
            <View
              style={[
                styles.radioInner,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.full,
                  width: 14,
                  height: 14,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Features */}
      <View style={[styles.features, { marginTop: spacing.md }]}>
        {plan.features.map((feature) => (
          <View
            key={feature}
            style={[styles.featureRow, { marginBottom: spacing.xs }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.success}
              style={{ marginRight: spacing.sm }}
            />
            <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
  },
  billingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billingOption: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearlyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingsBadge: {
    paddingVertical: 1,
  },
  planCard: {
    overflow: 'visible',
  },
  badge: {},
  currentBadge: {},
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  radioOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  radioInner: {},
  features: {},
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successIcon: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
