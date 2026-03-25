import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
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
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

let _authSubscription: { unsubscribe: () => void } | null = null;
let _initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  coachPreferences: null,
  isLoading: true,
  isOnboarded: false,

  initialize: async () => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
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
            isOnboarded: !!profile?.onboarding_completed,
          });
        }
      } catch {
        // Session check failed, user not authenticated
      } finally {
        set({ isLoading: false });
      }

      // Tear down previous listener to avoid accumulation
      if (_authSubscription) {
        _authSubscription.unsubscribe();
        _authSubscription = null;
      }

      // Set up auth state change listener for OAuth and session persistence.
      // IMPORTANT: The callback must NOT await Supabase calls directly — Supabase
      // holds an internal auth lock while this callback runs, so any Supabase call
      // that also needs the lock (e.g. DB queries, setSession) would deadlock.
      // We defer async work with setTimeout to release the lock first.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Synchronous state update — safe inside the lock
        set({ session, user: session?.user ?? null });

        if (!session?.user) {
          set({ profile: null, coachPreferences: null, isOnboarded: false });
          return;
        }

        // Defer profile fetching outside the auth lock
        const userId = session.user.id;
        setTimeout(async () => {
          try {
            // Check if session is still valid for this user
            const currentUser = get().session?.user?.id;
            if (currentUser !== userId) return; // Session changed, skip

            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            const { data: coachPrefs } = await supabase
              .from('coach_preferences')
              .select('*')
              .eq('user_id', userId)
              .single();
            // If profile has no display_name, try to extract from user metadata (Google sign-in)
            if (!profile?.display_name && session?.user?.user_metadata) {
              const meta = session.user.user_metadata;
              const fullName = meta?.full_name || meta?.name || meta?.given_name || '';
              if (fullName) {
                try {
                  const { useProfileStore } = require('./profile-store');
                  useProfileStore.getState().updateProfile({ displayName: fullName });
                } catch {}
                supabase.from('profiles').update({ display_name: fullName }).eq('id', userId).then(() => {});
                if (profile) {
                  profile.display_name = fullName;
                }
              }
            }

            set({
              profile: profile ?? null,
              coachPreferences: coachPrefs ?? null,
              isOnboarded: !!profile?.onboarding_completed,
            });
          } catch (e) {
            console.warn('[Auth] Failed to load profile after auth change:', e);
          }
        }, 0);
      });
      _authSubscription = subscription;
    })();
    return _initPromise;
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  setProfile: (profile) => {
    set({ profile, isOnboarded: !!profile?.onboarding_completed });
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
    set({ profile: updated, isOnboarded: !!updated.onboarding_completed });

    // 2. Write to profile-store cache (camelCase mirror) for offline reads
    try {
      const { useProfileStore } = require('./profile-store');
      const camelUpdates: Record<string, unknown> = {};
      // Basic
      if (partial.display_name !== undefined) camelUpdates.displayName = partial.display_name;
      if (partial.date_of_birth !== undefined) camelUpdates.dateOfBirth = partial.date_of_birth;
      if (partial.gender !== undefined) camelUpdates.gender = partial.gender;
      if (partial.height_cm !== undefined) camelUpdates.heightCm = partial.height_cm;
      if (partial.weight_kg !== undefined) camelUpdates.weightKg = partial.weight_kg;
      if (partial.unit_preference !== undefined) camelUpdates.unitPreference = partial.unit_preference;
      // Fitness / training
      if (partial.fitness_goal !== undefined) camelUpdates.fitnessGoal = partial.fitness_goal;
      if (partial.experience_level !== undefined) {
        const exp = partial.experience_level as string;
        camelUpdates.trainingExperience = exp === 'beginner' ? 'beginner'
          : ['less_than_1_year', '1_to_2_years'].includes(exp) ? 'intermediate'
          : 'advanced';
      }
      if (partial.consistency_level !== undefined) camelUpdates.consistencyLevel = partial.consistency_level;
      if (partial.gym_type !== undefined) camelUpdates.gymType = partial.gym_type;
      if (partial.training_days_per_week !== undefined) camelUpdates.trainingDaysPerWeek = partial.training_days_per_week;
      if (partial.specific_training_days !== undefined) camelUpdates.preferredWorkoutDays = partial.specific_training_days;
      if (partial.session_duration_pref !== undefined) camelUpdates.sessionDuration = partial.session_duration_pref;
      if (partial.injuries !== undefined) camelUpdates.injuriesOrLimitations = (partial.injuries as string[])?.join(', ') || undefined;
      if (partial.user_equipment !== undefined) {
        const equip = partial.user_equipment as Array<{ id: string }>;
        camelUpdates.fitnessEquipment = Array.isArray(equip) ? equip.map((e) => e.id) : [];
      }
      if (Object.keys(camelUpdates).length > 0) {
        useProfileStore.getState().updateProfile(camelUpdates);
      }
    } catch {
      // profile-store not available — skip cache write
    }

    // 3. Supabase upsert (fire-and-forget)
    if (isSupabaseConfigured && user) {
      supabase
        .from('profiles')
        .upsert({ ...updated, id: user.id })
        .then(({ error: upsertErr }) => {
          if (upsertErr) console.warn('Profile upsert failed:', upsertErr.message);
        });
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
      set({ profile, isOnboarded: !!profile.onboarding_completed });

      // Mirror to profile-store cache
      try {
        const { useProfileStore } = require('./profile-store');
        const exp = profile.experience_level as string | null;
        const equip = profile.user_equipment as Array<{ id: string }> | null;
        useProfileStore.getState().updateProfile({
          displayName: profile.display_name ?? '',
          dateOfBirth: profile.date_of_birth ?? undefined,
          gender: profile.gender ?? undefined,
          heightCm: profile.height_cm ?? undefined,
          weightKg: profile.weight_kg ?? undefined,
          unitPreference: profile.unit_preference ?? 'imperial',
          fitnessGoal: profile.fitness_goal ?? undefined,
          trainingExperience: exp
            ? (exp === 'beginner' ? 'beginner'
               : ['less_than_1_year', '1_to_2_years'].includes(exp) ? 'intermediate'
               : 'advanced')
            : undefined,
          consistencyLevel: profile.consistency_level ?? undefined,
          gymType: profile.gym_type ?? undefined,
          trainingDaysPerWeek: profile.training_days_per_week ?? undefined,
          preferredWorkoutDays: profile.specific_training_days ?? [],
          sessionDuration: profile.session_duration_pref ?? undefined,
          fitnessEquipment: Array.isArray(equip) ? equip.map((e) => e.id) : [],
          injuriesOrLimitations: Array.isArray(profile.injuries) && profile.injuries.length > 0
            ? profile.injuries.join(', ') : undefined,
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
      await get().syncProfileFromSupabase();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signInWithGoogle: async () => {
    try {
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
          const { error: sessionError, data: sessionData } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) return { error: sessionError };

          // Extract Google display name from user metadata and persist
          const meta = sessionData?.session?.user?.user_metadata;
          const fullName = meta?.full_name || meta?.name || meta?.given_name || '';
          if (fullName && sessionData?.session?.user?.id) {
            const userId = sessionData.session.user.id;
            try {
              const { useProfileStore } = require('./profile-store');
              useProfileStore.getState().updateProfile({ displayName: fullName });
            } catch {}
            supabase.from('profiles').update({ display_name: fullName }).eq('id', userId).then(() => {});
          }

          // Await initialize so profile/onboarding state is loaded before returning
          await get().initialize();
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
      await get().syncProfileFromSupabase();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Failed to send reset email' };
    }
  },

  signOut: async () => {
    // Fire-and-forget Supabase sign-out — local cleanup happens regardless
    try { await supabase.auth.signOut(); } catch {}

    // Reset all stores (best effort, each in its own try/catch)
    try { const { useOnboardingStore } = require('./onboarding-store'); useOnboardingStore.getState().reset(); } catch {}
    try { const { useProfileStore } = require('./profile-store'); useProfileStore.getState().reset(); } catch {}
    try { const { useWorkoutStore } = require('./workout-store'); useWorkoutStore.getState().reset?.(); } catch {}
    try { const { useNutritionStore } = require('./nutrition-store'); useNutritionStore.getState().reset?.(); } catch {}
    try { const { useCoachStore } = require('./coach-store'); useCoachStore.getState().reset?.(); } catch {}
    try { const { useNotificationStore } = require('./notification-store'); useNotificationStore.getState().reset?.(); } catch {}
    try { const { useMeasurementsStore } = require('./measurements-store'); await useMeasurementsStore.getState().reset(); } catch {}
    try { const { useAchievementsStore } = require('./achievements-store'); await useAchievementsStore.getState().reset(); } catch {}
    try { const { useHealthStore } = require('./health-store'); await useHealthStore.getState().disconnect(); } catch {}
    try { const { useSpaceStore } = require('./space-store'); await useSpaceStore.getState().reset(); } catch {}
    try { const { useGroceryStore } = require('./grocery-store'); useGroceryStore.getState().clearList(); } catch {}
    try { const { useSmartWorkoutStore } = require('./smart-workout-store'); await useSmartWorkoutStore.getState().reset(); } catch {}
    try { const { useFeedStore } = require('./feed-store'); useFeedStore.getState().reset(); } catch {}
    try { const { useFriendsStore } = require('./friends-store'); useFriendsStore.getState().reset(); } catch {}
    try { const { useSubscriptionStore } = require('./subscription-store'); await useSubscriptionStore.getState().logout(); } catch {}

    // Clear all user-specific AsyncStorage keys that may not have been
    // covered by individual store resets (belt-and-suspenders)
    const keysToRemove = [
      // measurements
      '@measurements/data', '@measurements/photos',
      // achievements
      '@achievements/earned', '@achievements/xp',
      // health
      '@health/sync_enabled', '@health/last_sync', '@health/is_connected',
      '@health/today_steps', '@health/today_energy', '@health/recent_weight', '@health/last_sleep',
      // spaces
      '@spaces/data', '@spaces/active',
      // grocery
      '@grocery/current',
      // smart workout
      '@formiq/smart_workout', '@formiq/smart_workout_generated_at', '@formiq/workout_mode',
      // feed
      '@feed/items',
      // friends
      '@friends/list', '@friends/incoming', '@friends/outgoing',
      // feedback
      '@formiq/feedback_last_submitted', '@formiq/feedback_last_category',
      '@formiq/feedback_prompt_count', '@formiq/feedback_last_prompt_workout',
      // workout
      '@workout/active_session', '@workout/history', '@workout/programs',
      '@workout/exercises', '@workout/personal_records',
      '@workout/default_rest_seconds', '@workout/program_completions', '@workout/auto_rest_timer',
      // nutrition
      '@nutrition/daily_logs', '@nutrition/saved_meals',
      '@nutrition/user_supplements', '@nutrition/targets', '@nutrition/recipes',
      // coach
      '@coach/conversations', '@coach/messages', '@coach/active_conversation',
      // profile (zustand/persist key)
      '@profile/data',
      // promo grant
      'formiq_promo_grant',
      // onboarding (zustand/persist key)
      'onboarding-store',
      // notification (zustand/persist key)
      'notification-preferences',
    ];
    try {
      await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
    } catch {}

    // Clear auth state last
    set({
      session: null,
      user: null,
      profile: null,
      coachPreferences: null,
      isOnboarded: false,
    });

    // Force navigation to auth screen to prevent deep-link re-access
    try { router.replace('/(auth)/welcome'); } catch {}
  },
}));
