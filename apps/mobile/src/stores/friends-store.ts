import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEYS = {
  FRIENDS: '@friends/list',
  INCOMING: '@friends/incoming',
  OUTGOING: '@friends/outgoing',
} as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface FriendProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  friend: FriendProfile;
}

interface FriendsState {
  friends: Friendship[];
  incomingRequests: Friendship[];
  outgoingRequests: Friendship[];
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  reset: () => void;
  searchUsers: (query: string) => Promise<FriendProfile[]>;
  sendRequest: (addresseeId: string) => Promise<{ error: string | null }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Store ──────────────────────────────────────────────────────────────

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    // Load from cache first for instant UI
    try {
      const [friends, incoming, outgoing] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.FRIENDS),
        AsyncStorage.getItem(STORAGE_KEYS.INCOMING),
        AsyncStorage.getItem(STORAGE_KEYS.OUTGOING),
      ]);
      if (friends || incoming || outgoing) {
        set({
          friends: friends ? JSON.parse(friends) : [],
          incomingRequests: incoming ? JSON.parse(incoming) : [],
          outgoingRequests: outgoing ? JSON.parse(outgoing) : [],
          isInitialized: true,
        });
      }
    } catch (err) {
      console.warn('[Friends] Failed to load cached friends data:', err);
    }

    if (!isSupabaseConfigured) { set({ isInitialized: true }); return; }
    await get().refresh();
    set({ isInitialized: true });
  },

  refresh: async () => {
    if (!isSupabaseConfigured) return;
    set({ isLoading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); return; }

      const { data: rows } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          addressee_id,
          status,
          created_at,
          requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url),
          addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (!rows) { set({ isLoading: false }); return; }

      const friends: Friendship[] = [];
      const incomingRequests: Friendship[] = [];
      const outgoingRequests: Friendship[] = [];

      for (const row of rows) {
        const isRequester = row.requester_id === user.id;
        const friendProfile = isRequester ? row.addressee : row.requester;

        const friendship: Friendship = {
          id: row.id,
          requesterId: row.requester_id,
          addresseeId: row.addressee_id,
          status: row.status as Friendship['status'],
          createdAt: row.created_at,
          friend: {
            id: (friendProfile as any)?.id ?? '',
            displayName: (friendProfile as any)?.display_name ?? 'Unknown',
            avatarUrl: (friendProfile as any)?.avatar_url,
          },
        };

        if (row.status === 'accepted') {
          friends.push(friendship);
        } else if (row.status === 'pending' && !isRequester) {
          incomingRequests.push(friendship);
        } else if (row.status === 'pending' && isRequester) {
          outgoingRequests.push(friendship);
        }
      }

      set({ friends, incomingRequests, outgoingRequests, isLoading: false });

      // Cache for offline use
      AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends)).catch(console.warn);
      AsyncStorage.setItem(STORAGE_KEYS.INCOMING, JSON.stringify(incomingRequests)).catch(console.warn);
      AsyncStorage.setItem(STORAGE_KEYS.OUTGOING, JSON.stringify(outgoingRequests)).catch(console.warn);
    } catch (error) {
      console.error('Failed to refresh friends list:', error);
      set({ isLoading: false });
    }
  },

  searchUsers: async (query: string): Promise<FriendProfile[]> => {
    if (!isSupabaseConfigured || query.trim().length < 2) return [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const sanitized = query.replace(/[%,().*+?^${}|[\]\\]/g, '');
      if (!sanitized.trim()) return [];

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .or(`display_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`)
        .neq('id', user.id)
        .limit(20);

      if (!data) return [];

      return data.map((p) => ({
        id: p.id,
        displayName: p.display_name ?? 'Unknown',
        avatarUrl: p.avatar_url,
      }));
    } catch (error) {
      console.error('User search failed:', error);
      return [];
    }
  },

  sendRequest: async (addresseeId: string) => {
    if (!isSupabaseConfigured) return { error: 'Not configured' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') return { error: 'Already friends' };
        if (existing.status === 'pending') return { error: 'Request already pending' };
        // Re-send a previously declined request by updating the existing row
        if (existing.status === 'declined') {
          const { error } = await supabase
            .from('friendships')
            .update({ status: 'pending', requester_id: user.id, addressee_id: addresseeId })
            .eq('id', existing.id);
          if (error) return { error: error.message };
          await get().refresh();
          return { error: null };
        }
      }

      const { error } = await supabase
        .from('friendships')
        .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });

      if (error) return { error: error.message };

      await get().refresh();
      return { error: null };
    } catch (e) {
      return { error: 'Failed to send request' };
    }
  },

  acceptRequest: async (friendshipId: string) => {
    if (!isSupabaseConfigured) return;
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    await get().refresh();
  },

  declineRequest: async (friendshipId: string) => {
    if (!isSupabaseConfigured) return;
    await supabase
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId);
    await get().refresh();
  },

  removeFriend: async (friendshipId: string) => {
    if (!isSupabaseConfigured) return;
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    await get().refresh();
  },

  reset: () => {
    set({ friends: [], incomingRequests: [], outgoingRequests: [], isInitialized: false });
    AsyncStorage.removeItem(STORAGE_KEYS.FRIENDS).catch(console.warn);
    AsyncStorage.removeItem(STORAGE_KEYS.INCOMING).catch(console.warn);
    AsyncStorage.removeItem(STORAGE_KEYS.OUTGOING).catch(console.warn);
  },
}));
