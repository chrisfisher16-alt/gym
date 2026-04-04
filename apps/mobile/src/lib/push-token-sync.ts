// ── Push Token Sync ───────────────────────────────────────────────
// Registers the device push token with Supabase so the backend
// (Edge Functions) can send targeted remote push notifications.

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { registerPushToken } from './notifications';

/**
 * Register the current device's push token with Supabase.
 * Call after the user signs in and grants notification permissions.
 */
export async function syncPushToken(): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (Platform.OS === 'web') return;

  const token = await registerPushToken();
  if (!token) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Upsert: update if token exists, insert if new
  await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS as 'ios' | 'android',
        active: true,
      },
      { onConflict: 'user_id,token' },
    );
}

/**
 * Deactivate the current device's push token.
 * Call on sign-out so the user stops receiving push notifications.
 */
export async function deactivatePushToken(): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (Platform.OS === 'web') return;

  const token = await registerPushToken();
  if (!token) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('push_tokens')
    .update({ active: false })
    .eq('user_id', user.id)
    .eq('token', token);
}
