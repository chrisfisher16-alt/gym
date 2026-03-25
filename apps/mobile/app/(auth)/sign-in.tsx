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

function friendlyAuthError(error: { code?: string; message?: string } | string): string {
  const code = typeof error === 'string' ? undefined : error.code;
  const msg = typeof error === 'string' ? error : error.message ?? '';
  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed')) return 'Please check your email to confirm your account.';
  if (code === 'user_not_found' || msg.includes('User not found')) return 'No account found with this email.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment.';
  return 'Something went wrong. Please try again.';
}

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { colors, spacing, typography } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [formError, setFormError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setFormError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setFormError(friendlyAuthError(error));
      } else {
        router.replace('/');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: SignInForm) => {
    setFormError('');
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        setFormError(friendlyAuthError(error));
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      setFormError(friendlyAuthError(e?.message || 'Something went wrong. Please try again.'));
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.content, { paddingTop: spacing['4xl'] }]}>
          <View style={styles.header}>
            <Text style={[typography.displayLarge, { color: colors.primary }]}>
              Health Coach
            </Text>
            <Text
              style={[
                typography.bodyLarge,
                { color: colors.textSecondary, marginTop: spacing.sm },
              ]}
            >
              Welcome back. Sign in to continue.
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
                  placeholder="Enter your password"
                  leftIcon="lock-closed-outline"
                  isPassword
                  autoComplete="password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />

            <Button
              title="Sign In"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'center', marginTop: spacing.md }}
            >
              <Text style={[typography.bodySmall, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.footer, { marginTop: spacing['2xl'] }]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Don&apos;t have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Text style={[typography.label, { color: colors.primary }]}>Sign Up</Text>
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
    marginBottom: 40,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
