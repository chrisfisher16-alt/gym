import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  ChallengeWithParticipants,
  ChallengeMetric,
  LeaderboardEntry,
} from '../../../../packages/shared/src/types/compete';
import type { CreateChallengeInput } from '../../../../packages/shared/src/schemas/compete';

const STORAGE_KEYS = {
  ACTIVE: '@challenges/active',
  COMPLETED: '@challenges/completed',
} as const;

// ── Types ──────────────────────────────────────────────────────────────

interface ChallengeState {
  activeChallenges: ChallengeWithParticipants[];
  completedChallenges: ChallengeWithParticipants[];
  loading: boolean;
  error: string | null;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardMetric: ChallengeMetric;
  leaderboardTimeframe: 'week' | 'month' | 'all';

  // Actions
  initialize: () => Promise<void>;
  fetchChallenges: () => Promise<void>;
  createChallenge: (input: CreateChallengeInput) => Promise<{ error: string | null }>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  fetchLeaderboard: (metric: ChallengeMetric, timeframe: 'week' | 'month' | 'all') => Promise<void>;
  reset: () => void;
}

// ── Row types (match Supabase .select() shapes) ────────────────────────

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase join types are complex; row shape is validated by the .select() call */
function mapRowToChallenge(row: Record<string, any>): ChallengeWithParticipants {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    metric: row.metric,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (row.challenge_participants ?? []).map((p: any) => ({
      id: p.id,
      challengeId: p.challenge_id,
      userId: p.user_id,
      status: p.status,
      score: p.score ?? 0,
      joinedAt: p.joined_at,
      displayName: p.profiles?.display_name ?? 'Unknown',
      avatarUrl: p.profiles?.avatar_url ?? null,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Store ──────────────────────────────────────────────────────────────

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  activeChallenges: [],
  completedChallenges: [],
  loading: false,
  error: null,
  leaderboard: [],
  leaderboardMetric: 'volume',
  leaderboardTimeframe: 'week',

  initialize: async () => {
    // Load from cache first for instant UI
    try {
      const [active, completed] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE),
        AsyncStorage.getItem(STORAGE_KEYS.COMPLETED),
      ]);
      if (active || completed) {
        set({
          activeChallenges: active ? JSON.parse(active) : [],
          completedChallenges: completed ? JSON.parse(completed) : [],
        });
      }
    } catch (err) {
      console.warn('[Challenges] Failed to load cached data:', err);
    }

    if (!isSupabaseConfigured) return;
    await get().fetchChallenges();
  },

  fetchChallenges: async () => {
    if (!isSupabaseConfigured) return;

    set({ loading: true, error: null });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ loading: false }); return; }

      // Get challenge IDs the user participates in
      const { data: participantRows, error: pError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id);

      if (pError) {
        set({ loading: false, error: pError.message });
        return;
      }

      const challengeIds = (participantRows ?? []).map((r) => r.challenge_id);

      if (challengeIds.length === 0) {
        set({ activeChallenges: [], completedChallenges: [], loading: false });
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVE, '[]').catch(console.warn);
        AsyncStorage.setItem(STORAGE_KEYS.COMPLETED, '[]').catch(console.warn);
        return;
      }

      // Fetch challenges with participants + profile data
      const { data: rows, error } = await supabase
        .from('challenges')
        .select(`
          id,
          creator_id,
          title,
          metric,
          starts_at,
          ends_at,
          status,
          created_at,
          challenge_participants (
            id,
            challenge_id,
            user_id,
            status,
            score,
            joined_at,
            profiles:profiles!challenge_participants_user_id_fkey (
              display_name,
              avatar_url
            )
          )
        `)
        .in('id', challengeIds)
        .order('created_at', { ascending: false });

      if (error) {
        set({ loading: false, error: error.message });
        return;
      }

      const challenges = (rows ?? []).map(mapRowToChallenge);

      const activeChallenges = challenges.filter(
        (c) => c.status === 'pending' || c.status === 'active',
      );
      const completedChallenges = challenges.filter(
        (c) => c.status === 'completed' || c.status === 'cancelled',
      );

      set({ activeChallenges, completedChallenges, loading: false });

      // Cache for offline use
      AsyncStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(activeChallenges)).catch(console.warn);
      AsyncStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(completedChallenges)).catch(console.warn);
    } catch (err) {
      console.error('[Challenges] Fetch failed:', err);
      set({ loading: false, error: 'Failed to load challenges' });
    }
  },

  createChallenge: async (input) => {
    if (!isSupabaseConfigured) return { error: 'Not configured' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      // Insert the challenge
      const { data: challenge, error: cError } = await supabase
        .from('challenges')
        .insert({
          creator_id: user.id,
          title: input.title,
          metric: input.metric,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          status: 'pending',
        })
        .select('id')
        .single();

      if (cError || !challenge) return { error: cError?.message ?? 'Failed to create challenge' };

      // Insert participants (creator as accepted + invitees as invited)
      const participantRows = [
        {
          challenge_id: challenge.id,
          user_id: user.id,
          status: 'accepted' as const,
          score: 0,
        },
        ...input.participantIds.map((pid) => ({
          challenge_id: challenge.id,
          user_id: pid,
          status: 'invited' as const,
          score: 0,
        })),
      ];

      const { error: pError } = await supabase
        .from('challenge_participants')
        .insert(participantRows);

      if (pError) return { error: pError.message };

      await get().fetchChallenges();
      return { error: null };
    } catch (err) {
      console.error('[Challenges] Create failed:', err);
      return { error: 'Failed to create challenge' };
    }
  },

  acceptChallenge: async (challengeId) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('challenge_participants')
        .update({ status: 'accepted', joined_at: new Date().toISOString() })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      if (error) {
        console.error('[Challenges] Accept failed:', error);
        set({ error: error.message });
        return;
      }

      await get().fetchChallenges();
    } catch (err) {
      console.error('[Challenges] Accept exception:', err);
      set({ error: 'Failed to accept challenge' });
    }
  },

  declineChallenge: async (challengeId) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('challenge_participants')
        .update({ status: 'declined' })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      if (error) {
        console.error('[Challenges] Decline failed:', error);
        set({ error: error.message });
        return;
      }

      await get().fetchChallenges();
    } catch (err) {
      console.error('[Challenges] Decline exception:', err);
      set({ error: 'Failed to decline challenge' });
    }
  },

  fetchLeaderboard: async (metric, timeframe) => {
    set({ leaderboardMetric: metric, leaderboardTimeframe: timeframe });

    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get accepted friend IDs
      const { data: friendRows } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = (friendRows ?? []).map((r: FriendshipRow) =>
        r.requester_id === user.id ? r.addressee_id : r.requester_id,
      );
      const userIds = [user.id, ...friendIds];

      // Calculate date range
      const now = new Date();
      let startDate: string | null = null;
      if (timeframe === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        d.setHours(0, 0, 0, 0);
        startDate = d.toISOString();
      } else if (timeframe === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = d.toISOString();
      }

      // Fetch real scores from Supabase RPC (falls back to zeros if not deployed)
      const scoreMap = new Map<string, number>();
      try {
        const { data: scoreData, error: scoreError } = await supabase.rpc('get_leaderboard_scores', {
          p_user_ids: userIds,
          p_metric: metric,
          p_start_date: startDate,
          p_end_date: now.toISOString(),
        });

        if (!scoreError && scoreData) {
          (scoreData as { user_id: string; score: number }[]).forEach((row) => {
            scoreMap.set(row.user_id, Number(row.score) || 0);
          });
        } else if (scoreError) {
          console.warn('[Challenges] Leaderboard RPC unavailable, using zero scores:', scoreError.code);
        }
      } catch (rpcErr) {
        console.warn('[Challenges] Leaderboard RPC failed, using zero scores');
      }

      // Fetch profiles for display names / avatars
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const leaderboard: LeaderboardEntry[] = (profiles ?? [])
        .map((p: ProfileRow) => ({
          userId: p.id,
          displayName: p.display_name ?? 'Unknown',
          avatarUrl: p.avatar_url ?? null,
          score: scoreMap.get(p.id) ?? 0,
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      set({ leaderboard });
    } catch (err) {
      console.error('[Challenges] Leaderboard fetch failed:', err);
    }
  },

  reset: () => {
    set({
      activeChallenges: [],
      completedChallenges: [],
      loading: false,
      error: null,
      leaderboard: [],
      leaderboardMetric: 'volume',
      leaderboardTimeframe: 'week',
    });
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE).catch(console.warn);
    AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED).catch(console.warn);
  },
}));
