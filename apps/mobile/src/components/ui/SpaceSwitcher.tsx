import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useSpaceStore, type TrainingSpace } from '../../stores/space-store';
import { QuickActionSheet, type QuickAction } from './QuickActionSheet';
import { cardExpand, lightImpact } from '../../lib/haptics';

// ── Types ──────────────────────────────────────────────────────────

export interface SpaceSwitcherProps {
  style?: ViewStyle;
  onCreatePress: () => void;
  onEditPress: (space: TrainingSpace) => void;
}

// ── Animated Pill ──────────────────────────────────────────────────

function SpacePill({
  space,
  isActive,
  onPress,
  onLongPress,
}: {
  space: TrainingSpace;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Scale pulse animation
    scale.value = withSequence(
      withSpring(0.92, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onPress();
  }, [onPress, scale]);

  const accentColor = space.accentColor ?? colors.primary;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: isActive ? accentColor + '18' : colors.surfaceSecondary,
            borderColor: isActive ? accentColor : colors.border,
            borderWidth: isActive ? 1.5 : 1,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            marginRight: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name={space.icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={isActive ? accentColor : colors.textSecondary}
          style={{ marginRight: spacing.xs }}
        />
        <Text
          style={[
            typography.label,
            {
              color: isActive ? accentColor : colors.textSecondary,
              fontSize: 13,
            },
          ]}
          numberOfLines={1}
        >
          {space.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function SpaceSwitcher({ style, onCreatePress, onEditPress }: SpaceSwitcherProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const spaces = useSpaceStore((s) => s.spaces);
  const activeSpaceId = useSpaceStore((s) => s.activeSpaceId);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const deleteSpace = useSpaceStore((s) => s.deleteSpace);

  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    space: TrainingSpace | null;
  }>({ visible: false, space: null });

  const handleSwitch = useCallback(
    (id: string) => {
      if (id === activeSpaceId) return;
      cardExpand();
      switchSpace(id);
    },
    [activeSpaceId, switchSpace],
  );

  const handleLongPress = useCallback((space: TrainingSpace) => {
    setActionSheet({ visible: true, space });
  }, []);

  const quickActions: QuickAction[] = actionSheet.space
    ? [
        {
          id: 'edit',
          label: 'Edit Space',
          icon: 'create-outline',
          onPress: () => {
            if (actionSheet.space) onEditPress(actionSheet.space);
          },
        },
        {
          id: 'delete',
          label: 'Delete Space',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => {
            if (actionSheet.space) deleteSpace(actionSheet.space.id);
          },
        },
      ]
    : [];

  if (spaces.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Pressable
          onPress={() => {
            lightImpact();
            onCreatePress();
          }}
          style={({ pressed }) => [
            styles.emptyPill,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text
            style={[
              typography.label,
              { color: colors.primary, marginLeft: spacing.xs, fontSize: 13 },
            ]}
          >
            Create Training Space
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {spaces.map((space) => (
          <SpacePill
            key={space.id}
            space={space}
            isActive={space.id === activeSpaceId}
            onPress={() => handleSwitch(space.id)}
            onLongPress={() => handleLongPress(space)}
          />
        ))}

        {/* Add button */}
        <Pressable
          onPress={() => {
            lightImpact();
            onCreatePress();
          }}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              borderRadius: radius.full,
              width: 34,
              height: 34,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>

      {/* Long-press action sheet */}
      <QuickActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false, space: null })}
        title={actionSheet.space?.name ?? 'Space'}
        subtitle={actionSheet.space?.description}
        actions={quickActions}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyContainer: {
    flexDirection: 'row',
  },
  emptyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
