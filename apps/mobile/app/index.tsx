import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth-store';
import { isSupabaseConfigured } from '../src/lib/supabase';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  if (isOnboarded && (session || !isSupabaseConfigured)) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(onboarding)/welcome" />;
}
