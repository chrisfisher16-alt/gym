import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

// ── Types ────────────────────────────────────────────────────────────

export type SupersetType = 'superset' | 'triset' | 'giantset';

export interface SupersetGroupProps {
  type: SupersetType;
  roundCount: number;
  currentRound?: number;
  children: React.ReactNode;
  isActive?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SupersetType, string> = {
  superset: 'SUPERSET',
  triset: 'TRI-SET',
  giantset: 'GIANT SET',
};

/**
 * Derive superset type from the number of exercises in the group.
 * 2 → superset, 3 → triset, 4+ → giantset
 */
export function getSupersetType(exerciseCount: number): SupersetType {
  if (exerciseCount <= 2) return 'superset';
  if (exerciseCount === 3) return 'triset';
  return 'giantset';
}

// ── Component ────────────────────────────────────────────────────────

export function SupersetGroup({
  type,
  roundCount,
  currentRound,
  children,
  isActive = false,
}: SupersetGroupProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // ── Animations ───────────────────────────────────────────────────
  const bracketProgress = useSharedValue(isActive ? 1 : 0);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    bracketProgress.value = withTiming(isActive ? 1 : 0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, bracketProgress]);

  useEffect(() => {
    // Fade header in on mount with slight delay
    headerOpacity.value = withDelay(
      150,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, [headerOpacity]);

  const bracketStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      bracketProgress.value,
      [0, 1],
      [colors.border, colors.gold],
    );
    return {
      backgroundColor: color,
    };
  });

  const bracketGlowStyle = useAnimatedStyle(() => ({
    opacity: bracketProgress.value * 0.4,
  }));

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const label = TYPE_LABELS[type];
  const roundLabel = `${roundCount} Round${roundCount !== 1 ? 's' : ''}`;
  const accentColor = isActive ? colors.gold : colors.textTertiary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.lg,
          marginBottom: spacing.md,
        },
      ]}
    >
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm },
          headerAnimStyle,
        ]}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[
              typography.overline,
              { color: accentColor, textTransform: 'uppercase' },
            ]}
          >
            {label} · {roundLabel}
          </Text>
        </View>
        {currentRound != null && (
          <Text style={[typography.labelSmall, { color: accentColor }]}>
            Round {currentRound} of {roundCount}
          </Text>
        )}
      </Animated.View>

      {/* Body with left bracket */}
      <View style={styles.body}>
        {/* Bracket column */}
        <View style={[styles.bracketColumn, { marginLeft: spacing.sm }]}>
          {/* Glow layer (visible when active) */}
          <Animated.View
            style={[
              styles.bracketGlow,
              { backgroundColor: colors.gold, borderRadius: 3 },
              bracketGlowStyle,
            ]}
          />
          {/* Bracket line */}
          <Animated.View
            style={[
              styles.bracketLine,
              { borderRadius: 1 },
              bracketStyle,
            ]}
          />
        </View>

        {/* Children (exercise cards) */}
        <View
          style={[
            styles.childrenContainer,
            {
              paddingRight: spacing.md,
              paddingBottom: spacing.md,
              paddingLeft: spacing.sm,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flexDirection: 'row',
  },
  bracketColumn: {
    width: 6,
    alignItems: 'center',
    position: 'relative',
  },
  bracketGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
  },
  bracketLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  childrenContainer: {
    flex: 1,
  },
});
