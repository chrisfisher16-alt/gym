import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../src/theme';
import { Button, Input, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import type { UnitPreference } from '@health-coach/shared';

const bodyFormSchema = z.object({
  height: z.string().min(1, 'Enter your height'),
  weight: z.string().min(1, 'Enter your weight'),
  unitPreference: z.enum(['metric', 'imperial']),
});

type BodyForm = z.infer<typeof bodyFormSchema>;

export default function BodyScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const store = useOnboardingStore();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BodyForm>({
    resolver: zodResolver(bodyFormSchema),
    defaultValues: {
      height: store.heightCm ? String(store.heightCm) : '',
      weight: store.weightKg ? String(store.weightKg) : '',
      unitPreference: store.unitPreference,
    },
  });

  const unitPref = watch('unitPreference');

  const onSubmit = (data: BodyForm) => {
    const heightNum = parseFloat(data.height);
    const weightNum = parseFloat(data.weight);
    // Convert imperial to metric for storage
    if (data.unitPreference === 'imperial') {
      store.setHeightCm(Math.round(heightNum * 2.54)); // inches to cm
      store.setWeightKg(Math.round(weightNum * 0.453592 * 10) / 10); // lbs to kg
    } else {
      store.setHeightCm(heightNum);
      store.setWeightKg(weightNum);
    }
    store.setUnitPreference(data.unitPreference);
    router.push('/(onboarding)/goals');
  };

  return (
    <ScreenContainer>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={2 / 6} style={{ marginBottom: spacing.xl }} />

        <Text style={[typography.h1, { color: colors.text }]}>Your Body</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] }]}>
          This helps us calculate your nutrition needs.
        </Text>

        <View style={{ gap: spacing.lg }}>
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
              Units
            </Text>
            <Controller
              control={control}
              name="unitPreference"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.unitToggle, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
                  {(['imperial', 'metric'] as UnitPreference[]).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => onChange(unit)}
                      activeOpacity={0.7}
                      style={[
                        styles.unitOption,
                        {
                          backgroundColor: value === unit ? colors.surface : 'transparent',
                          borderRadius: radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.label,
                          { color: value === unit ? colors.text : colors.textTertiary },
                        ]}
                      >
                        {unit === 'imperial' ? 'Imperial' : 'Metric'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          <Controller
            control={control}
            name="height"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={`Height (${unitPref === 'imperial' ? 'inches' : 'cm'})`}
                placeholder={unitPref === 'imperial' ? 'e.g. 70' : 'e.g. 178'}
                keyboardType="numeric"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.height?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="weight"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={`Weight (${unitPref === 'imperial' ? 'lbs' : 'kg'})`}
                placeholder={unitPref === 'imperial' ? 'e.g. 165' : 'e.g. 75'}
                keyboardType="numeric"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.weight?.message}
              />
            )}
          />
        </View>

        <View style={[styles.buttons, { marginTop: spacing['2xl'], gap: spacing.md }]}>
          <Button title="Continue" onPress={handleSubmit(onSubmit)} />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    padding: 4,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttons: {},
});
