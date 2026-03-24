import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { successNotification } from '../../lib/haptics';

export interface PRBannerData {
  exerciseName: string;
  weight: number;
  reps: number;
  unit: string;
}

export interface PRCelebrationBannerProps {
  data: PRBannerData | null;
  onDismiss: () => void;
}

const DISPLAY_DURATION = 4000;

export function PRCelebrationBanner({ data, onDismiss }: PRCelebrationBannerProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) {
      successNotification();

      // Slide down
      slideAnim.setValue(-200);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after delay
      dismissTimer.current = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -200,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, DISPLAY_DURATION);

      return () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      };
    }
  }, [data]);

  if (!data) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: 0,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Lighter accent strip at top */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.primaryLight, opacity: 0.3 },
        ]}
      />

      <View style={styles.content}>
        <Ionicons name="trophy" size={28} color="#FFD700" style={{ marginRight: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }]}>
            NEW PR!
          </Text>
          <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={1}>
            {data.exerciseName} — {data.weight} {data.unit} × {data.reps}
          </Text>
        </View>
        <Ionicons name="trophy" size={28} color="#FFD700" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
