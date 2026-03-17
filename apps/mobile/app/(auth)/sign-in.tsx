import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../src/theme';
import { Button, Input, ScreenContainer } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { colors, spacing, typography } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [formError, setFormError] = useState('');

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
    const { error } = await signIn(data.email, data.password);
    if (error) {
      setFormError(error.message || 'Failed to sign in. Please try again.');
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
