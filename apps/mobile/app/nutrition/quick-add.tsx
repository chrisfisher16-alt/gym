import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/theme';
import { useMealLog } from '../../src/hooks/useMealLog';
import { Button, ScreenContainer } from '../../src/components/ui';
import { getMealTypeLabel } from '../../src/lib/nutrition-utils';
import type { MealType } from '../../src/types/nutrition';

export default function QuickAddScreen() {
  const router = useRouter();
  const { mealType = 'snack' } = useLocalSearchParams<{ mealType: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { quickAddCalories } = useMealLog();

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const handleSave = () => {
    const cal = parseInt(calories) || 0;
    if (cal === 0 && !name) return;

    quickAddCalories(
      name || 'Quick Add',
      cal,
      parseFloat(protein) || 0,
      parseFloat(carbs) || 0,
      parseFloat(fat) || 0,
      mealType as MealType,
    );

    router.dismiss();
  };

  return (
    <ScreenContainer scrollable={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
            Quick Add
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {getMealTypeLabel(mealType)}
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Name (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  color: colors.text,
                  paddingHorizontal: spacing.md,
                  ...typography.body,
                },
              ]}
              placeholder="e.g., Afternoon snack"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Calories */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.label, { color: colors.calories, marginBottom: spacing.xs }]}>
              Calories *
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.largeInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.calories,
                  borderRadius: radius.md,
                  color: colors.text,
                  paddingHorizontal: spacing.md,
                  ...typography.displayMedium,
                },
              ]}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              autoFocus
            />

            {/* Quick preset buttons */}
            <View style={[styles.presetRow, { marginTop: spacing.md }]}>
              {[100, 200, 300, 500].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBtn,
                    {
                      backgroundColor: calories === preset.toString() ? colors.calories : colors.surfaceSecondary,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: calories === preset.toString() ? colors.calories : colors.border,
                    },
                  ]}
                  onPress={() => setCalories(preset.toString())}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      typography.label,
                      {
                        color: calories === preset.toString() ? '#FFFFFF' : colors.text,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {preset}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: calories === preset.toString() ? 'rgba(255,255,255,0.8)' : colors.textTertiary },
                    ]}
                  >
                    cal
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Macros */}
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Macros (optional)
          </Text>
          <View style={[styles.macroRow, { marginBottom: spacing.xl }]}>
            <View style={styles.macroCol}>
              <Text style={[typography.labelSmall, { color: colors.protein, marginBottom: spacing.xs }]}>
                Protein (g)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    color: colors.text,
                    paddingHorizontal: spacing.md,
                    ...typography.body,
                    textAlign: 'center',
                  },
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroCol}>
              <Text style={[typography.labelSmall, { color: colors.carbs, marginBottom: spacing.xs }]}>
                Carbs (g)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    color: colors.text,
                    paddingHorizontal: spacing.md,
                    ...typography.body,
                    textAlign: 'center',
                  },
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroCol}>
              <Text style={[typography.labelSmall, { color: colors.fat, marginBottom: spacing.xs }]}>
                Fat (g)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    color: colors.text,
                    paddingHorizontal: spacing.md,
                    ...typography.body,
                    textAlign: 'center',
                  },
                ]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Button
            title="Add"
            onPress={handleSave}
            disabled={!(parseInt(calories) > 0 || name.trim().length > 0)}
            icon={<Ionicons name="flash" size={20} color={colors.textInverse} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: 12,
  },
  largeInput: {
    minHeight: 64,
    borderWidth: 2,
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCol: {
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
});
