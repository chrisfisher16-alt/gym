import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, CoachPreferences } from '@health-coach/shared';
import { identify, resetUser, track } from '../lib/observability';

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
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

        // Load profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
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

        identify(session.user.id, {
          email: session.user.email,
          display_name: profile?.display_name,
        });
      }
    } catch {
      // Session check failed, user not authenticated
    } finally {
      set({ isLoading: false });
    }
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

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      await get().initialize();
      track('user_signed_in');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signUp: async (email, password) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error };
      track('user_signed_up');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    track('user_signed_out');
    resetUser();
    set({
      session: null,
      user: null,
      profile: null,
      coachPreferences: null,
      isOnboarded: false,
    });
  },
}));
