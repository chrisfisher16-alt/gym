import { useAuthStore } from '../stores/auth-store';

export function useAuth() {
  const {
    session,
    user,
    profile,
    coachPreferences,
    isLoading,
    isOnboarded,
    signIn,
    signUp,
    signOut,
    setProfile,
  } = useAuthStore();

  return {
    session,
    user,
    profile,
    coachPreferences,
    isLoading,
    isOnboarded,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    setProfile,
  };
}
