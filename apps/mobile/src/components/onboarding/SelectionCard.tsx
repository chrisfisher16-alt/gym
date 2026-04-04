/**
 * SelectionCard — tappable card with selection state for onboarding.
 *
 * Used for goal selection, gym type, etc.
 * Animates with scale spring + brand-primary highlight + haptic on select.
 */

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { selectionFeedback } from '../../lib/haptics';

interface SelectionCardProps {
  label: string;
  description?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}

export function SelectionCard({
  label,
  description,
  icon,
  selected,
  onPress,
  compact = false,
}: SelectionCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const scale = useSharedValue(1);
  const selection = useSharedValue(selected ? 1 : 0);

  // Drive selection animation when prop changes
  React.useEffect(() => {
    selection.value = withSpring(selected ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [selected]);

  const handlePress = () => {
    selectionFeedback();

    // Scale pop animation
    scale.value = withSpring(1.02, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    });

    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      [colors.border, colors.primary],
    ),
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      ['transparent', colors.primaryMuted],
    ),
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          compact ? styles.compactCard : styles.card,
          { borderRadius: radius.md },
          animatedStyle,
        ]}
      >
        {icon && !compact && (
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: selected ? colors.primaryMuted : colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Ionicons
              name={icon as any}
              size={22}
              color={selected ? colors.primary : colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text
            style={[
              compact ? typography.label : typography.h3,
              { color: selected ? colors.primary : colors.text },
            ]}
          >
            {label}
          </Text>
          {description && !compact && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 14,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    marginBottom: 8,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
});
