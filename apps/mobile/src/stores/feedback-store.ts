import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
// Lazy-load NetInfo to prevent startup crashes when the native module isn't linked
let _NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
async function getNetInfo() {
  if (!_NetInfo) {
    const mod = await import('@react-native-community/netinfo');
    _NetInfo = mod.default;
  }
  return _NetInfo;
}
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { enqueue } from '../lib/supabase-sync';
import { useAuthStore } from './auth-store';
import { useProfileStore } from './profile-store';
import { useWorkoutStore } from './workout-store';

// ── Types ──────────────────────────────────────────────────────────────

export type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'ai_accuracy';

export interface FeedbackPayload {
  category: FeedbackCategory;
  description: string;
  screenshotUri?: string;
  screenContext?: string;
  sessionActive?: boolean;
}

interface FeedbackState {
  isSubmitting: boolean;
  lastSubmittedAt: string | null;
  lastCategory: FeedbackCategory | null;
  promptShownCount: number;
  lastPromptWorkoutCount: number;

  submitFeedback: (payload: FeedbackPayload) => Promise<{ success: boolean; queued?: boolean }>;
  shouldShowPrompt: () => boolean;
  recordPromptShown: () => void;
}

// ── Storage keys ───────────────────────────────────────────────────────

const KEYS = {
  LAST_SUBMITTED: '@formiq/feedback_last_submitted',
  LAST_CATEGORY: '@formiq/feedback_last_category',
  PROMPT_SHOWN_COUNT: '@formiq/feedback_prompt_count',
  LAST_PROMPT_WORKOUT: '@formiq/feedback_last_prompt_workout',
};

// ── Helpers ────────────────────────────────────────────────────────────

function collectMetadata(screenContext?: string, sessionActive?: boolean): Record<string, unknown> {
  const authState = useAuthStore.getState();
  const profile = useProfileStore.getState().profile;
  const workoutCount = useWorkoutStore.getState().history.length;

  // Account age in days
  let accountAgeDays: number | undefined;
  const createdAt = authState.user?.created_at;
  if (createdAt) {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    accountAgeDays = Math.floor(diffMs / 86400000);
  }

  return {
    app_version: Constants.expoConfig?.version ?? '1.0.0',
    device_info: Device.modelName ?? `${Device.brand ?? 'Unknown'} device`,
    os_name: Platform.OS,
    os_version: String(Platform.Version),
    screen_context: screenContext ?? null,
    account_age_days: accountAgeDays ?? null,
    workout_count: workoutCount,
    subscription_tier: (authState.profile as any)?.entitlement_tier ?? 'free',
    session_active: sessionActive ?? false,
    locale: Platform.OS === 'ios'
      ? ((Platform as any).constants?.localeIdentifier ?? 'en')
      : 'en',
  };
}

async function uploadScreenshot(uri: string, userId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const filename = `${userId}/${Date.now()}.jpg`;

    // Read the file as blob
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('feedback-screenshots')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Screenshot upload error:', error);
      return null;
    }

    return filename;
  } catch (err) {
    console.error('Screenshot upload failed:', err);
    return null;
  }
}

// ── Store ──────────────────────────────────────────────────────────────

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  isSubmitting: false,
  lastSubmittedAt: null,
  lastCategory: null,
  promptShownCount: 0,
  lastPromptWorkoutCount: 0,

  submitFeedback: async (payload) => {
    const { category, description, screenshotUri, screenContext, sessionActive } = payload;

    set({ isSubmitting: true });

    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        set({ isSubmitting: false });
        return { success: false };
      }

      const metadata = collectMetadata(screenContext, sessionActive);

      // Get current theme from system appearance
      const colorScheme = Appearance.getColorScheme() ?? 'light';

      // Check network status
      let networkStatus = 'connected'; // Assume connected if NetInfo unavailable
      let isConnected = true;
      try {
        const NetInfo = await getNetInfo();
        const netInfo = await NetInfo.fetch();
        networkStatus = netInfo.type === 'wifi' ? 'wifi'
          : netInfo.type === 'cellular' ? 'cellular'
          : netInfo.isConnected ? 'connected'
          : 'offline';
        isConnected = !!netInfo.isConnected;
      } catch {
        // Assume online if NetInfo unavailable
      }

      // Upload screenshot if provided and online
      let screenshotUrl: string | null = null;
      if (screenshotUri && isConnected) {
        screenshotUrl = await uploadScreenshot(screenshotUri, user.id);
      }

      const feedbackRow = {
        user_id: user.id,
        category,
        description,
        screenshot_url: screenshotUrl,
        theme: colorScheme ?? 'light',
        network_status: networkStatus,
        ...metadata,
      };

      // Try direct insert if online
      if (isSupabaseConfigured && isConnected) {
        const { error } = await supabase.from('feedback').insert(feedbackRow);

        if (error) {
          console.error('Feedback submit error:', error);
          // Fall back to queue
          await enqueue('feedback_submit', 'feedback', 'insert', feedbackRow);
          await recordSubmission(category, set);
          set({ isSubmitting: false });
          return { success: true, queued: true };
        }

        await recordSubmission(category, set);
        set({ isSubmitting: false });
        return { success: true, queued: false };
      }

      // Offline -- queue for later
      await enqueue('feedback_submit', 'feedback', 'insert', feedbackRow);
      await recordSubmission(category, set);
      set({ isSubmitting: false });
      return { success: true, queued: true };
    } catch (err) {
      console.error('Feedback submission failed:', err);
      set({ isSubmitting: false });
      return { success: false };
    }
  },

  shouldShowPrompt: () => {
    const state = get();
    const workoutCount = useWorkoutStore.getState().history.length;

    // Show on 1st workout, then every 5th
    const isPromptWorkout = workoutCount === 1 || (workoutCount > 0 && workoutCount % 5 === 0);
    if (!isPromptWorkout) return false;

    // Don't show again for the same workout count milestone
    if (state.lastPromptWorkoutCount >= workoutCount) return false;

    // Don't show if user submitted feedback in the last 7 days
    if (state.lastSubmittedAt) {
      const daysSince = (Date.now() - new Date(state.lastSubmittedAt).getTime()) / 86400000;
      if (daysSince < 7) return false;
    }

    return true;
  },

  recordPromptShown: () => {
    const workoutCount = useWorkoutStore.getState().history.length;
    const newCount = get().promptShownCount + 1;
    set({ promptShownCount: newCount, lastPromptWorkoutCount: workoutCount });
    AsyncStorage.setItem(KEYS.PROMPT_SHOWN_COUNT, String(newCount));
    AsyncStorage.setItem(KEYS.LAST_PROMPT_WORKOUT, String(workoutCount));
  },
}));

// ── Private helpers ────────────────────────────────────────────────────

async function recordSubmission(
  category: FeedbackCategory,
  set: (partial: Partial<FeedbackState>) => void,
) {
  const now = new Date().toISOString();
  set({ lastSubmittedAt: now, lastCategory: category });
  await AsyncStorage.setItem(KEYS.LAST_SUBMITTED, now);
  await AsyncStorage.setItem(KEYS.LAST_CATEGORY, category);
}

// ── Hydrate persisted state on import ──────────────────────────────────

export let feedbackStoreHydrated = false;

export const feedbackHydrationPromise = (async () => {
  try {
    const [lastSubmitted, lastCategory, promptCount, lastPromptWorkout] = await Promise.all([
      AsyncStorage.getItem(KEYS.LAST_SUBMITTED),
      AsyncStorage.getItem(KEYS.LAST_CATEGORY),
      AsyncStorage.getItem(KEYS.PROMPT_SHOWN_COUNT),
      AsyncStorage.getItem(KEYS.LAST_PROMPT_WORKOUT),
    ]);

    useFeedbackStore.setState({
      lastSubmittedAt: lastSubmitted,
      lastCategory: (lastCategory as FeedbackCategory) ?? null,
      promptShownCount: promptCount ? parseInt(promptCount, 10) || 0 : 0,
      lastPromptWorkoutCount: lastPromptWorkout ? parseInt(lastPromptWorkout, 10) || 0 : 0,
    });
  } catch (error) {
    console.error('Failed to load feedback store state:', error);
  } finally {
    feedbackStoreHydrated = true;
  }
})();
