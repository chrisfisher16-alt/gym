import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePaywall } from '../hooks/usePaywall';
import {
  type FeatureKey,
  getRequiredPlanForFeature,
} from '../lib/pricing-config';

interface LockedFeatureProps {
  feature: FeatureKey;
  children: React.ReactNode;
  /** Optional custom message for the lock overlay */
  message?: string;
  /** Whether to show a blurred/dimmed preview of the content */
  showPreview?: boolean;
}

export function LockedFeature({
  feature,
  children,
  message,
  showPreview = true,
}: LockedFeatureProps) {
  const { canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const { colors, spacing, radius, typography } = useTheme();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlanForFeature(feature);

  return (
    <View style={styles.container}>
      {/* Dimmed preview or placeholder */}
      {showPreview ? (
        <View style={styles.previewWrapper} pointerEvents="none">
          <View style={[styles.dimOverlay, { opacity: 0.6 }]}>{children}</View>
        </View>
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing['2xl'],
            },
          ]}
        />
      )}

      {/* Lock overlay */}
      <View
        style={[
          styles.lockOverlay,
          {
            backgroundColor: colors.overlay,
            borderRadius: radius.lg,
          },
        ]}
      >
        <View
          style={[
            styles.lockContent,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
        >
          <View
            style={[
              styles.lockIcon,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
                width: 48,
                height: 48,
              },
            ]}
          >
            <Ionicons name="lock-closed" size={22} color={colors.primary} />
          </View>

          <Text
            style={[
              typography.label,
              { color: colors.text, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            {message ?? `Upgrade to ${requiredPlan.name}`}
          </Text>

          <Text
            style={[
              typography.bodySmall,
              {
                color: colors.textSecondary,
                marginTop: spacing.xs,
                textAlign: 'center',
              },
            ]}
          >
            Starting at {requiredPlan.price}
          </Text>

          <TouchableOpacity
            style={[
              styles.upgradeButton,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                marginTop: spacing.base,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => showPaywall({ feature })}
          >
            <Ionicons
              name="diamond-outline"
              size={16}
              color={colors.textInverse}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={[typography.label, { color: colors.textInverse }]}>
              Upgrade
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  previewWrapper: {
    opacity: 1,
  },
  dimOverlay: {
    opacity: 0.3,
  },
  placeholder: {
    minHeight: 120,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lockContent: {
    alignItems: 'center',
    maxWidth: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  lockIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
