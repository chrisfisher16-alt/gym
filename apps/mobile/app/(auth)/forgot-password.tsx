import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, Input, ScreenContainer } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import { friendlyAuthError } from '../../src/lib/auth-utils';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const { resetPassword } = useAuthStore();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotForm) => {
    setFormError('');
    const { error } = await resetPassword(data.email);
    if (error) {
      setFormError(friendlyAuthError(error));
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <ScreenContainer>
        <View style={[styles.content, { paddingTop: spacing['4xl'] }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.completedMuted }]}>
              <Ionicons name="mail-outline" size={32} color={colors.completed} />
            </View>
            <Text style={[typography.displayMedium, { color: colors.text, marginTop: spacing.lg }]}>
              Check your email
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 },
              ]}
            >
              We sent a password reset link to{'\n'}
              <Text style={{ fontWeight: '600', color: colors.text }}>{getValues('email')}</Text>
            </Text>
          </View>

          <Button
            title="Back to Sign In"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: spacing['2xl'] }}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.content, { paddingTop: spacing['4xl'] }]}>
          <View style={styles.header}>
            <Text style={[typography.displayMedium, { color: colors.text }]}>
              Reset password
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
              ]}
            >
              Enter your email and we'll send you a reset link.
            </Text>
          </View>

          <View style={[styles.form, { gap: spacing.base }]}>
            {formError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.errorLight, borderRadius: 10, padding: spacing.md }]}>
                <Text style={[typography.bodySmall, { color: colors.error }]}>{formError}</Text>
              </View>
            ) : null}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  leftIcon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            <Button
              title="Send Reset Link"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />

            <Button
              title="Back to Sign In"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  errorBanner: {},
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
