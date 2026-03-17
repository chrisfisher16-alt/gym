import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, Input, ScreenContainer } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';

const signUpSchema = z
  .object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => data.acceptTerms, {
    message: 'You must accept the terms',
    path: ['acceptTerms'],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const { colors, spacing, typography } = useTheme();
  const signUp = useAuthStore((s) => s.signUp);
  const [formError, setFormError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: SignUpForm) => {
    setFormError('');
    const { error } = await signUp(data.email, data.password);
    if (error) {
      setFormError(error.message || 'Failed to create account. Please try again.');
    } else {
      router.replace('/');
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.content, { paddingTop: spacing['2xl'] }]}>
          <View style={styles.header}>
            <Text style={[typography.displayLarge, { color: colors.primary }]}>
              Create Account
            </Text>
            <Text
              style={[
                typography.bodyLarge,
                { color: colors.textSecondary, marginTop: spacing.sm },
              ]}
            >
              Start your health journey today.
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  placeholder="At least 8 characters"
                  leftIcon="lock-closed-outline"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  leftIcon="lock-closed-outline"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="acceptTerms"
              render={({ field: { onChange, value } }) => (
                <TouchableOpacity
                  onPress={() => onChange(!value)}
                  activeOpacity={0.7}
                  style={styles.termsRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: errors.acceptTerms ? colors.error : colors.border,
                        backgroundColor: value ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {value && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                    I agree to the Terms of Service and Privacy Policy
                  </Text>
                </TouchableOpacity>
              )}
            />
            {errors.acceptTerms && (
              <Text style={[typography.bodySmall, { color: colors.error, marginTop: -8 }]}>
                {errors.acceptTerms.message}
              </Text>
            )}

            <Button
              title="Create Account"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />
          </View>

          <View style={[styles.footer, { marginTop: spacing['2xl'] }]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Text style={[typography.label, { color: colors.primary }]}>Sign In</Text>
            </Link>
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
