// ── Social API Stubs (Future) ─────────────────────────────────────
// These stubs define the API surface for social features.
// Implementation will be built in a future phase.

import { supabase, isSupabaseConfigured } from './supabase';

/** Follow a user */
export async function followUser(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: (await supabase.auth.getUser()).data.user?.id, following_id: userId });

  return error ? { success: false, error: error.message } : { success: true };
}

/** Unfollow a user */
export async function unfollowUser(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };

  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', currentUser.id)
    .eq('following_id', userId);

  return error ? { success: false, error: error.message } : { success: true };
}

/** Get social feed for the current user */
export async function getFeed(limit = 20, offset = 0) {
  if (!isSupabaseConfigured) return { data: [], error: 'Not configured' };

  const { data, error } = await supabase
    .from('social_feed')
    .select('*, profiles!social_feed_user_id_fkey(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data: data ?? [], error: error?.message };
}

/** Share a workout to the social feed */
export async function shareWorkout(
  sessionId: string,
  title: string,
  body?: string,
  visibility: 'public' | 'followers' | 'private' = 'followers',
) {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };

  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('social_feed')
    .insert({
      user_id: currentUser.id,
      type: 'workout_share',
      title,
      body,
      session_id: sessionId,
      visibility,
    });

  return error ? { success: false, error: error.message } : { success: true };
}

/** Get follower/following counts */
export async function getSocialStats(userId: string) {
  if (!isSupabaseConfigured) return { followers: 0, following: 0 };

  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}
