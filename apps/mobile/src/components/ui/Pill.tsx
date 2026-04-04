import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface PillProps {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Pill({ label, icon, onPress, active, style }: PillProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      {...(onPress ? { accessibilityRole: 'button' as const } : {})}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected: active } : undefined}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.primaryMuted : colors.surfaceSecondary,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: active ? 1 : 0,
          borderColor: active ? colors.borderBrand : 'transparent',
        },
        style,
      ]}
    >
      {icon && <View style={{ marginRight: spacing.xs }}>{icon}</View>}
      <Text style={[typography.caption, { color: active ? colors.primary : colors.textSecondary }]}>
        {label}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
