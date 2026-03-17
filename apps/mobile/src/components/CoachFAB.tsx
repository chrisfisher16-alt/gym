import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useCoachStore } from '../stores/coach-store';
import type { CoachContext } from '@health-coach/shared';

interface CoachFABProps {
  context: CoachContext;
  label?: string;
  prefilledMessage?: string;
}

export function CoachFAB({ context, label, prefilledMessage }: CoachFABProps) {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);

  const handlePress = () => {
    setPrefilledContext(context, prefilledMessage);
    router.push('/(tabs)/coach');
  };

  if (label) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.labeledFab,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.textInverse} />
        <Text
          style={[
            styles.labelText,
            { color: colors.textInverse, fontSize: 13, fontWeight: '600', marginLeft: spacing.xs },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          borderRadius: radius.full,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color={colors.textInverse} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  labeledFab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  labelText: {},
});
