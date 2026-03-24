import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './ui/BottomSheet';
import { useNutritionStore } from '../stores/nutrition-store';
import { useTheme } from '../theme';

interface QuickAddWaterSheetProps {
  visible: boolean;
  onClose: () => void;
}

const PRESETS = [
  { amount: 8, label: 'Glass', icon: 'water-outline' as const },
  { amount: 12, label: 'Can', icon: 'cafe-outline' as const },
  { amount: 16, label: 'Bottle', icon: 'pint-outline' as const },
  { amount: 24, label: 'Large', icon: 'beer-outline' as const },
];

export function QuickAddWaterSheet({ visible, onClose }: QuickAddWaterSheetProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [customOz, setCustomOz] = useState('');

  const handlePreset = (amount: number) => {
    useNutritionStore.getState().logWater(amount);
    onClose();
  };

  const handleCustomAdd = () => {
    const amount = parseFloat(customOz);
    if (!amount || amount <= 0) return;
    useNutritionStore.getState().logWater(amount);
    setCustomOz('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.5} scrollable={false}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Ionicons name="water-outline" size={22} color={colors.info} />
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.sm }]}>
          Add Water
        </Text>
      </View>

      {/* Preset Grid */}
      <View style={[styles.grid, { gap: spacing.md, marginTop: spacing.lg }]}>
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.amount}
            activeOpacity={0.7}
            onPress={() => handlePreset(preset.amount)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                padding: spacing.md,
              },
            ]}
          >
            <Ionicons
              name={preset.icon}
              size={28}
              color={colors.info}
              style={{ marginBottom: spacing.xs }}
            />
            <Text style={[typography.labelLarge, { color: colors.text }]}>
              {preset.amount} oz
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Row */}
      <View
        style={[
          styles.customRow,
          {
            marginTop: spacing.lg,
            gap: spacing.sm,
          },
        ]}
      >
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.borderLight,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <TextInput
            style={[
              typography.body,
              {
                color: colors.text,
                flex: 1,
                height: 44,
              },
            ]}
            placeholder="Custom oz"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={customOz}
            onChangeText={setCustomOz}
            returnKeyType="done"
            onSubmitEditing={handleCustomAdd}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCustomAdd}
          style={[
            styles.addButton,
            {
              backgroundColor: colors.info,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.textInverse }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
