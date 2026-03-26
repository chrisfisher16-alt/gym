import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const FEED_CACHE_KEY = '@feed/items';

// ── Types ──────────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  userId: string;
  type: 'workout_share' | 'pr_share' | 'achievement_share' | 'milestone';
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  sessionId: string | null;
  visibility: 'public' | 'followers' | 'private';
  likesCount: number;
  createdAt: string;
  // Joined profile data
  userDisplayName: string;
  userAvatarUrl: string | null;
  // Client state
  isLikedByMe: boolean;
}

interface FeedState {
  items: FeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;

  fetchFeed: (reset?: boolean) => Promise<void>;
  reset: () => void;
  postWorkoutCompletion: (params: {
    title: string;
    body: string;
    metadata: Record<string, any>;
    sessionId?: string;
  }) => Promise<boolean>;
  toggleLike: (feedItemId: string) => Promise<void>;
  deleteItem: (feedItemId: string) => Promise<void>;
}

const PAGE_SIZE = 20;

// ── Store ──────────────────────────────────────────────────────────────

export const useFeedStore = create<FeedState>((set, get) => ({
  items: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: true,

  fetchFeed: async (reset = false) => {
    // Load cache for instant render on fresh load
    if (reset) {
      try {
        const cached = await AsyncStorage.getItem(FEED_CACHE_KEY);
        if (cached) {
          const items: FeedItem[] = JSON.parse(cached);
          set({ items });
        }
      } catch {}
    }

    if (!isSupabaseConfigured) return;

    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true, isRefreshing: reset });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingItems = reset ? [] : state.items;
      const offset = existingItems.length;

      // Fetch feed items with joined profile data
      const { data, error } = await supabase
        .from('social_feed')
        .select(`
          id,
          user_id,
          type,
          title,
          body,
          metadata,
          session_id,
          visibility,
          likes_count,
          created_at,
          profiles!social_feed_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Feed fetch error:', error);
        return;
      }

      // Check which items user has liked
      const itemIds = (data || []).map((d: any) => d.id);
      let likedIds = new Set<string>();
      if (itemIds.length > 0) {
        const { data: likes } = await supabase
          .from('social_likes')
          .select('feed_item_id')
          .eq('user_id', user.id)
          .in('feed_item_id', itemIds);
        likedIds = new Set((likes || []).map((l: any) => l.feed_item_id));
      }

      const mapped: FeedItem[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        body: row.body,
        metadata: row.metadata || {},
        sessionId: row.session_id,
        visibility: row.visibility,
        likesCount: row.likes_count,
        createdAt: row.created_at,
        userDisplayName: row.profiles?.display_name || 'Unknown',
        userAvatarUrl: row.profiles?.avatar_url || null,
        isLikedByMe: likedIds.has(row.id),
      }));

      set({
        items: reset ? mapped : [...existingItems, ...mapped],
        hasMore: mapped.length === PAGE_SIZE,
      });

      // Cache first page for offline
      if (reset) {
        AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(mapped)).catch(console.warn);
      }
    } catch (err) {
      console.error('Feed fetch exception:', err);
    } finally {
      set({ isLoading: false, isRefreshing: false });
    }
  },

  postWorkoutCompletion: async ({ title, body, metadata, sessionId }) => {
    if (!isSupabaseConfigured) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase.from('social_feed').insert({
        user_id: user.id,
        type: 'workout_share',
        title,
        body,
        metadata,
        session_id: sessionId || null,
        visibility: 'followers',
      });

      if (error) {
        console.error('Feed post error:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Feed post exception:', err);
      return false;
    }
  },

  toggleLike: async (feedItemId: string) => {
    if (!isSupabaseConfigured) return;

    const state = get();
    const item = state.items.find((i) => i.id === feedItemId);
    if (!item) return;

    const wasLiked = item.isLikedByMe;

    // Optimistic update
    set({
      items: state.items.map((i) =>
        i.id === feedItemId
          ? {
              ...i,
              isLikedByMe: !wasLiked,
              likesCount: wasLiked ? Math.max(0, i.likesCount - 1) : i.likesCount + 1,
            }
          : i
      ),
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Rollback
        set({ items: get().items.map((i) => i.id === feedItemId ? { ...i, isLikedByMe: wasLiked, likesCount: item.likesCount } : i) });
        return;
      }

      if (wasLiked) {
        const { error } = await supabase
          .from('social_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('feed_item_id', feedItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('social_likes').insert({
          user_id: user.id,
          feed_item_id: feedItemId,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Like toggle error:', err);
      // Rollback on failure
      set({
        items: get().items.map((i) =>
          i.id === feedItemId
            ? { ...i, isLikedByMe: wasLiked, likesCount: item.likesCount }
            : i
        ),
      });
    }
  },

  deleteItem: async (feedItemId: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('Feed delete error: not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('social_feed')
        .delete()
        .eq('id', feedItemId)
        .eq('user_id', user.id)
        .select();
      if (error) {
        console.error('Feed delete error:', error);
        return;
      }
      if (!data || data.length === 0) {
        console.error('Feed delete error: post not found or not owned by user');
        return;
      }
      set({ items: get().items.filter((i) => i.id !== feedItemId) });
    } catch (err) {
      console.error('Feed delete error:', err);
    }
  },

  reset: () => {
    set({ items: [], isLoading: false, isRefreshing: false, hasMore: true });
    AsyncStorage.removeItem(FEED_CACHE_KEY).catch(console.warn);
  },
}));
