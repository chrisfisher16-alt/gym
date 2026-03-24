import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, CoachPreferences } from '@health-coach/shared';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  coachPreferences: CoachPreferences | null;
  isLoading: boolean;
  isOnboarded: boolean;

  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setCoachPreferences: (prefs: CoachPreferences | null) => void;
  setIsOnboarded: (value: boolean) => void;
  updateProfile: (partial: Partial<Profile>) => void;
  syncProfileFromSupabase: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  coachPreferences: null,
  isLoading: true,
  isOnboarded: false,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      // No Supabase configured — run in preview mode
      set({ isLoading: false });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ session, user: session.user });

        // Load profile (profiles.id = auth.users.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // Load coach preferences
        const { data: coachPrefs } = await supabase
          .from('coach_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        set({
          profile: profile ?? null,
          coachPreferences: coachPrefs ?? null,
          isOnboarded: !!profile?.display_name,
        });
      }
    } catch {
      // Session check failed, user not authenticated
    } finally {
      set({ isLoading: false });
    }

    // Set up auth state change listener for OAuth and session persistence
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        const { data: coachPrefs } = await supabase
          .from('coach_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        set({
          profile: profile ?? null,
          coachPreferences: coachPrefs ?? null,
          isOnboarded: !!profile?.display_name,
        });
      } else {
        set({ profile: null, coachPreferences: null, isOnboarded: false });
      }
    });
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  setProfile: (profile) => {
    set({ profile, isOnboarded: !!profile?.display_name });
  },

  setCoachPreferences: (prefs) => {
    set({ coachPreferences: prefs });
  },

  setIsOnboarded: (value) => {
    set({ isOnboarded: value });
  },

  updateProfile: (partial) => {
    const { profile, user } = get();
    if (!profile) return;

    // 1. Update auth-store profile immediately
    const updated: Profile = { ...profile, ...partial, updated_at: new Date().toISOString() };
    set({ profile: updated, isOnboarded: !!updated.display_name });

    // 2. Write to profile-store cache (camelCase mirror) for offline reads
    try {
      const { useProfileStore } = require('./profile-store');
      const camelUpdates: Record<string, unknown> = {};
      if (partial.display_name !== undefined) camelUpdates.displayName = partial.display_name;
      if (partial.date_of_birth !== undefined) camelUpdates.dateOfBirth = partial.date_of_birth;
      if (partial.gender !== undefined) camelUpdates.gender = partial.gender;
      if (partial.height_cm !== undefined) camelUpdates.heightCm = partial.height_cm;
      if (partial.weight_kg !== undefined) camelUpdates.weightKg = partial.weight_kg;
      if (partial.unit_preference !== undefined) camelUpdates.unitPreference = partial.unit_preference;
      if (Object.keys(camelUpdates).length > 0) {
        useProfileStore.getState().updateProfile(camelUpdates);
      }
    } catch {
      // profile-store not available — skip cache write
    }

    // 3. Supabase upsert (fire-and-forget)
    if (isSupabaseConfigured && user) {
      Promise.resolve(
        supabase
          .from('profiles')
          .upsert({ ...updated, id: user.id }),
      ).catch(() => {}); // non-blocking
    }
  },

  syncProfileFromSupabase: async () => {
    const { user } = get();
    if (!isSupabaseConfigured || !user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      set({ profile, isOnboarded: !!profile.display_name });

      // Mirror to profile-store cache
      try {
        const { useProfileStore } = require('./profile-store');
        useProfileStore.getState().updateProfile({
          displayName: profile.display_name ?? '',
          dateOfBirth: profile.date_of_birth ?? undefined,
          gender: profile.gender ?? undefined,
          heightCm: profile.height_cm ?? undefined,
          weightKg: profile.weight_kg ?? undefined,
          unitPreference: profile.unit_preference ?? 'imperial',
        });
      } catch {
        // profile-store not available — skip
      }
    }
  },

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      await get().initialize();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signInWithGoogle: async () => {
    try {
      const WebBrowser = await import('expo-web-browser');
      const { makeRedirectUri } = await import('expo-auth-session');
      const { Platform } = await import('react-native');

      // Required on Android for the auth session to return properly
      if (Platform.OS === 'android') {
        await WebBrowser.warmUpAsync();
      }

      const redirectUrl = makeRedirectUri({
        scheme: 'health-coach',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error };
      if (!data?.url) return { error: new Error('No OAuth URL returned from Supabase') };

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (Platform.OS === 'android') {
        await WebBrowser.coolDownAsync();
      }

      if (result.type === 'success' && result.url) {
        // Supabase returns tokens in the URL fragment (#access_token=...)
        // or as query params (?access_token=...) depending on config
        const hashPart = result.url.split('#')[1];
        const queryPart = result.url.split('?')[1]?.split('#')[0];
        const params = new URLSearchParams(hashPart || queryPart || '');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) return { error: sessionError };
        } else {
          return { error: new Error('No tokens received from Google sign-in. Check Supabase redirect URL configuration.') };
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: null }; // User cancelled — not an error
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signUp: async (email, password) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      coachPreferences: null,
      isOnboarded: false,
    });
  },
}));
