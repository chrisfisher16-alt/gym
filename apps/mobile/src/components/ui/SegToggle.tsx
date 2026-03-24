import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { selectionFeedback } from '../../lib/haptics';

interface SegToggleProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

export function SegToggle<T extends string>({ options, selected, onSelect }: SegToggleProps<T>) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }]} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => { selectionFeedback(); onSelect(opt.value); }}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: isActive, selected: isActive }}
            style={[
              styles.option,
              {
                backgroundColor: isActive ? colors.surface : 'transparent',
                borderRadius: radius.md - 2,
                paddingVertical: spacing.sm,
                borderWidth: isActive ? 1 : 0,
                borderColor: isActive ? colors.borderBrand : 'transparent',
              },
            ]}
          >
            <Text style={[
              typography.label,
              { color: isActive ? colors.text : colors.textTertiary, fontSize: 13 },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
