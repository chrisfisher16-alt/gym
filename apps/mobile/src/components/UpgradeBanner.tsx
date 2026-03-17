import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePaywall } from '../hooks/usePaywall';
import type { FeatureKey } from '../lib/pricing-config';
import { PLANS } from '../lib/pricing-config';

interface UpgradeBannerProps {
  /** The feature being promoted */
  feature?: FeatureKey;
  /** Custom message to display */
  message?: string;
  /** Target plan to promote (defaults to full_health_coach) */
  plan?: 'workout_coach' | 'nutrition_coach' | 'full_health_coach';
  /** Source screen for analytics */
  source?: string;
}

export function UpgradeBanner({
  feature,
  message,
  plan = 'full_health_coach',
  source,
}: UpgradeBannerProps) {
  const { isSubscribed } = useEntitlement();
  const { showPaywall } = usePaywall();
  const { colors, spacing, radius, typography } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if subscribed or dismissed
  if (isSubscribed || dismissed) return null;

  const planConfig = PLANS[plan];
  const displayMessage =
    message ?? `Try ${planConfig.name} — ${planConfig.features[0].toLowerCase()} and more`;

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: colors.primaryMuted,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: 1,
          borderColor: colors.primary + '30',
        },
      ]}
      activeOpacity={0.7}
      onPress={() => showPaywall({ feature, source })}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.primary + '20',
              borderRadius: radius.md,
              width: 36,
              height: 36,
            },
          ]}
        >
          <Ionicons name="diamond" size={18} color={colors.primary} />
        </View>

        <View style={styles.textContent}>
          <Text
            style={[typography.label, { color: colors.text }]}
            numberOfLines={2}
          >
            {displayMessage}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.primary, marginTop: 2 },
            ]}
          >
            Starting at {planConfig.price} →
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
    marginRight: 8,
  },
});
