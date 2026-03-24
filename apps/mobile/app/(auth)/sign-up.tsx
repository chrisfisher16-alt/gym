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
import { isSupabaseConfigured } from '../../src/lib/supabase';

function friendlyAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed')) return 'Please check your email to confirm your account.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment.';
  return 'Something went wrong. Please try again.';
}

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
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [formError, setFormError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setFormError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setFormError(friendlyAuthError(error.message || ''));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

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
      setFormError(friendlyAuthError(error.message || ''));
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

          {isSupabaseConfigured && (
            <>
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.7}
                style={[
                  styles.googleButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: spacing.md,
                  },
                ]}
              >
                <Ionicons name="logo-google" size={20} color={colors.text} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                  {googleLoading ? 'Signing in...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
                <Text style={[typography.caption, { color: colors.textTertiary, marginHorizontal: spacing.md }]}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
              </View>
            </>
          )}

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
                    I agree to the{' '}
                    <Text
                      style={{ color: colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => router.push('/terms')}
                    >
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={{ color: colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => router.push('/privacy')}
                    >
                      Privacy Policy
                    </Text>
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
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
