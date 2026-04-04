import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Compact horizontal layout with smaller icon and inline action */
  compact?: boolean;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors, spacing, radius, typography } = useTheme();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[
            styles.compactIcon,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Ionicons name={icon} size={22} color={colors.textTertiary} />
        </View>
        <View style={styles.compactBody}>
          <Text style={[typography.label, { color: colors.text }]}>{title}</Text>
          {description && (
            <Text
              style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}
        </View>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={[styles.compactAction, { backgroundColor: colors.primary, borderRadius: radius.md }]}
            activeOpacity={0.7}
          >
            <Text style={[typography.labelSmall, { color: colors.textOnPrimary }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: colors.surfaceSecondary, marginBottom: spacing.base },
        ]}
      >
        <Ionicons name={icon} size={40} color={colors.textTertiary} />
      </View>
      <Text style={[typography.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {description && (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={actionLabel} onPress={onAction} size="md" fullWidth={false} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  compactAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
