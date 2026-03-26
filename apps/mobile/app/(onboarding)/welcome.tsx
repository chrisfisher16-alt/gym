import { useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/auth-store';
import { isSupabaseConfigured } from '../../src/lib/supabase';

export default function WelcomeScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signUp = useAuthStore((s) => s.signUp);
  const signIn = useAuthStore((s) => s.signIn);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message || 'Google sign-in failed');
        return;
      }
      const isOnboarded = useAuthStore.getState().isOnboarded;
      if (isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.push('/(onboarding)/health-sync');
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setEmailLoading(true);
    try {
      // Try sign-up first; if user exists, fall back to sign-in
      const { error: signUpErr, needsConfirmation } = await signUp(email.trim(), password);
      if (!signUpErr && needsConfirmation) {
        crossPlatformAlert('Check Your Email', 'Please verify your email address before signing in.');
        return;
      }
      if (signUpErr) {
        if (signUpErr.message?.includes('already registered') || signUpErr.message?.includes('already exists')) {
          const { error: signInErr } = await signIn(email.trim(), password);
          if (signInErr) {
            setError('Unable to sign in. Please check your email and password.');
            return;
          }
        } else {
          setError(signUpErr.message || 'Sign-up failed');
          return;
        }
      }
      const isOnboarded = useAuthStore.getState().isOnboarded;
      if (isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.push('/(onboarding)/health-sync');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const continueWithoutAccount = () => {
    Alert.alert(
      'Continue without an account?',
      "Your data won't be synced across devices.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.push('/(onboarding)/health-sync') },
      ],
    );
  };

  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="heart-outline" size={56} color={colors.primary} />
          </View>
          <Text style={[typography.displayLarge, { color: colors.text, marginTop: spacing.xl, textAlign: 'center' }]}>
            Health Coach
          </Text>
          <Text
            style={[
              typography.bodyLarge,
              { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
            ]}
          >
            Your AI-powered personal health coach for workouts, nutrition, and overall wellness.
          </Text>
        </View>

        {/* Features */}
        <View style={[styles.features, { gap: spacing.md }]}>
          {[
            { icon: 'barbell-outline' as const, label: 'Smart Workout Programming' },
            { icon: 'nutrition-outline' as const, label: 'AI-Powered Nutrition Tracking' },
            { icon: 'chatbubble-ellipses-outline' as const, label: 'Personal AI Coach' },
          ].map((item) => (
            <View key={item.label} style={styles.featureRow}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Auth section */}
        <View style={[styles.bottom, { paddingBottom: spacing.xl }]}>
          {error ? (
            <Text style={[typography.bodySmall, { color: colors.error, textAlign: 'center', marginBottom: spacing.sm }]}>
              {error}
            </Text>
          ) : null}

          {isSupabaseConfigured && !showEmail && (
            <>
              {/* Google sign-in */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.7}
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Ionicons name="logo-google" size={20} color={colors.text} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                  {googleLoading ? 'Signing in...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              {/* Email sign-up option */}
              <TouchableOpacity
                onPress={() => setShowEmail(true)}
                activeOpacity={0.7}
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <Ionicons name="mail-outline" size={20} color={colors.text} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                  Continue with Email
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={[styles.divider, { marginVertical: spacing.md }]}>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
                <Text style={[typography.caption, { color: colors.textTertiary, marginHorizontal: spacing.md }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
              </View>

              {/* Skip */}
              <Button
                title="Get Started"
                onPress={continueWithoutAccount}
                variant="secondary"
              />
              <Text style={[typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs }]}>
                You can create an account later
              </Text>
            </>
          )}

          {isSupabaseConfigured && showEmail && (
            <>
              <TextInput
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={[
                  styles.input,
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}
              />
              <TextInput
                placeholder="Password (8+ characters)"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                style={[
                  styles.input,
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    marginTop: spacing.sm,
                  },
                ]}
              />
              <Button
                title={emailLoading ? 'Creating account...' : 'Continue'}
                onPress={handleEmailSubmit}
                disabled={emailLoading}
                loading={emailLoading}
                style={{ marginTop: spacing.md }}
              />
              <TouchableOpacity onPress={() => { setShowEmail(false); setError(''); }} style={{ marginTop: spacing.sm }}>
                <Text style={[typography.labelSmall, { color: colors.textSecondary, textAlign: 'center' }]}>
                  ← Back to options
                </Text>
              </TouchableOpacity>
            </>
          )}

          {!isSupabaseConfigured && (
            <Button
              title="Get Started"
              onPress={continueWithoutAccount}
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  features: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottom: {
    width: '100%',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  input: {
    borderWidth: 1,
    minHeight: 48,
  },
});
