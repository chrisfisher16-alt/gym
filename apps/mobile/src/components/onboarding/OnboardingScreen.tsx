/**
 * OnboardingScreen — shared wrapper for all onboarding screens.
 *
 * Provides:
 * - Animated gold progress bar at top
 * - Back button (left) and Skip button (right)
 * - Scrollable content area with entrance animation
 * - Bottom-pinned CTA button
 * - SafeArea handling
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { Button } from '../ui';
import { lightImpact } from '../../lib/haptics';
import { useEntrance } from '../../lib/animations';
import type { OnboardingStep } from '../../types/onboarding';

interface OnboardingScreenProps {
  /** The step identifier for progress tracking */
  step: OnboardingStep;
  /** Main headline */
  title: string;
  /** Optional subtitle below the headline */
  subtitle?: string;
  /** Screen content */
  children: React.ReactNode;
  /** Bottom CTA button text */
  ctaLabel?: string;
  /** Whether the CTA is enabled */
  ctaEnabled?: boolean;
  /** CTA press handler — if not provided, defaults to onNext */
  onCtaPress?: () => void;
  /** Custom next navigation handler */
  onNext?: () => void;
  /** Whether to show the skip button (default: true) */
  showSkip?: boolean;
  /** Custom skip handler */
  onSkip?: () => void;
  /** Whether to show the back button (default: true) */
  showBack?: boolean;
  /** Whether to show the bottom CTA (default: true) */
  showCta?: boolean;
  /** Optional secondary (ghost) button */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  /** Whether the CTA is loading */
  ctaLoading?: boolean;
  /** Whether to use keyboard avoiding (for forms) */
  keyboardAvoiding?: boolean;
  /** Custom content below the CTA buttons */
  bottomContent?: React.ReactNode;
}

export function OnboardingScreen({
  step,
  title,
  subtitle,
  children,
  ctaLabel = 'Next',
  ctaEnabled = true,
  onCtaPress,
  onNext,
  showSkip = true,
  onSkip,
  showBack = true,
  showCta = true,
  secondaryLabel,
  onSecondaryPress,
  ctaLoading = false,
  keyboardAvoiding = false,
  bottomContent,
}: OnboardingScreenProps) {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useOnboardingStore((s) => s.getProgress());
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep);
  const { animatedStyle } = useEntrance();

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentStep(step);
  }, [step]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const handleBack = () => {
    lightImpact();
    router.back();
  };

  const handleSkip = () => {
    lightImpact();
    if (onSkip) {
      onSkip();
    } else if (onNext) {
      onNext();
    }
  };

  const handleCta = () => {
    lightImpact();
    if (onCtaPress) {
      onCtaPress();
    } else if (onNext) {
      onNext();
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const content = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress Bar */}
      <View style={[styles.progressTrack, { top: insets.top, backgroundColor: colors.surfaceSecondary }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressWidth,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>

      {/* Header: Back + Skip */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {showBack ? (
          <Pressable onPress={handleBack} style={styles.headerButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}

        {showSkip ? (
          <Pressable onPress={handleSkip} style={styles.headerButton} hitSlop={12}>
            <Text style={[typography.label, { color: colors.primary }]}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: showCta ? 120 : spacing['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={animatedStyle}>
          <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.sm }]}>
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                typography.bodyLarge,
                { color: colors.textSecondary, marginBottom: spacing.xl },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {children}
        </Animated.View>
      </ScrollView>

      {/* Bottom Pinned CTA */}
      {showCta && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, spacing.base),
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          {secondaryLabel && onSecondaryPress ? (
            <View style={styles.dualButtons}>
              <Button
                title={secondaryLabel}
                onPress={onSecondaryPress}
                variant="ghost"
                fullWidth={false}
                style={styles.secondaryButton}
              />
              <Button
                title={ctaLabel}
                onPress={handleCta}
                disabled={!ctaEnabled}
                loading={ctaLoading}
                fullWidth={false}
                style={styles.primaryButton}
              />
            </View>
          ) : (
            <Button
              title={ctaLabel}
              onPress={handleCta}
              disabled={!ctaEnabled}
              loading={ctaLoading}
              fullWidth
            />
          )}
          {bottomContent}
        </View>
      )}
    </View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dualButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 0.4,
  },
  primaryButton: {
    flex: 0.6,
  },
});
