import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../src/theme';
import { Button, Input, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import type { Gender } from '@health-coach/shared';

const GENDER_VALUES = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const;

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Please enter your name'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  gender: z.enum(GENDER_VALUES),
});

type ProfileForm = z.infer<typeof profileFormSchema>;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function ProfileScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const store = useOnboardingStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: store.displayName,
      dateOfBirth: store.dateOfBirth,
      gender: (store.gender ?? 'prefer_not_to_say') as ProfileForm['gender'],
    },
  });

  const onSubmit: SubmitHandler<ProfileForm> = (data) => {
    store.setDisplayName(data.displayName);
    store.setDateOfBirth(data.dateOfBirth);
    store.setGender(data.gender as Gender);
    router.push('/(onboarding)/body');
  };

  return (
    <ScreenContainer>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={1 / 6} style={{ marginBottom: spacing.xl }} />

        <Text style={[typography.h1, { color: colors.text }]}>About You</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] }]}>
          Let&apos;s personalize your experience.
        </Text>

        <View style={{ gap: spacing.lg }}>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Display Name"
                placeholder="What should we call you?"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.displayName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Date of Birth"
                placeholder="YYYY-MM-DD"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.dateOfBirth?.message}
                keyboardType="numbers-and-punctuation"
              />
            )}
          />

          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
              Gender
            </Text>
            <Controller
              control={control}
              name="gender"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.genderGrid, { gap: spacing.sm }]}>
                  {GENDER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onChange(opt.value)}
                      activeOpacity={0.7}
                      style={[
                        styles.genderOption,
                        {
                          borderColor: value === opt.value ? colors.primary : colors.border,
                          backgroundColor: value === opt.value ? colors.primaryMuted : colors.surface,
                          borderRadius: radius.md,
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.base,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.label,
                          { color: value === opt.value ? colors.primary : colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
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
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genderOption: {
    borderWidth: 1,
    alignItems: 'center',
    minWidth: '47%',
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttons: {},
});
