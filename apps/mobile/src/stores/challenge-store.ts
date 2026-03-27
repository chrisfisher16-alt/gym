import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────

export type ChallengeMetric = 'volume' | 'workouts' | 'streak' | 'prs' | 'consistency';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type ParticipantStatus = 'invited' | 'accepted' | 'declined';

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: ParticipantStatus;
  score: number;
  lastUpdated: string;
}

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  metric: ChallengeMetric;
  startsAt: string;
  endsAt: string;
  status: ChallengeStatus;
  createdAt: string;
  participants: ChallengeParticipant[];
}

interface CreateChallengeParams {
  title: string;
  metric: ChallengeMetric;
  durationDays: number;
  participantIds: string[];
}

// ── Store ──────────────────────────────────────────────────────────────

interface ChallengeState {
  challenges: Challenge[];
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  reset: () => void;
  fetchChallenges: () => Promise<void>;
  createChallenge: (params: CreateChallengeParams) => Promise<{ id: string } | null>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  updateScore: (challengeId: string, userId: string, score: number) => Promise<void>;
}

const CACHE_KEY = '@formiq/challenges';

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    // Load from cache first for instant UI
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        set({ challenges: JSON.parse(cached), isInitialized: true });
      }
    } catch (err) {
      console.warn('[Challenges] Failed to load cached challenges:', err);
    }

    if (!isSupabaseConfigured) { set({ isInitialized: true }); return; }
    await get().fetchChallenges();
    set({ isInitialized: true });
  },

  fetchChallenges: async () => {
    if (!isSupabaseConfigured) return;
    set({ isLoading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); return; }

      // Fetch challenges where the current user is a participant
      const { data: participantRows } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id);

      if (!participantRows || participantRows.length === 0) {
        set({ challenges: [], isLoading: false });
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify([])).catch(console.warn);
        return;
      }

      const challengeIds = participantRows.map((r: any) => r.challenge_id);

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
            last_updated,
            profiles:profiles!challenge_participants_user_id_fkey (
              display_name,
              avatar_url
            )
          )
        `)
        .in('id', challengeIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Challenges] Fetch error:', error);
        set({ isLoading: false });
        return;
      }

      if (!rows) { set({ isLoading: false }); return; }

      const challenges: Challenge[] = rows.map((row: any) => ({
        id: row.id,
        creatorId: row.creator_id,
        title: row.title,
        metric: row.metric,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        createdAt: row.created_at,
        participants: (row.challenge_participants || []).map((p: any) => ({
          id: p.id,
          challengeId: p.challenge_id,
          userId: p.user_id,
          displayName: p.profiles?.display_name ?? 'Unknown',
          avatarUrl: p.profiles?.avatar_url,
          status: p.status,
          score: p.score ?? 0,
          lastUpdated: p.last_updated,
        })),
      }));

      set({ challenges, isLoading: false });

      // Cache for offline use
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(challenges)).catch(console.warn);
    } catch (err) {
      console.warn('[Challenges] Fetch exception:', err);
      set({ isLoading: false });
    }
  },

  createChallenge: async (params) => {
    if (!isSupabaseConfigured) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + params.durationDays * 86400000).toISOString();

      const { data: challenge, error } = await supabase
        .from('challenges')
        .insert({
          creator_id: user.id,
          title: params.title,
          metric: params.metric,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'active',
        })
        .select('id')
        .single();

      if (error || !challenge) {
        console.warn('[Challenges] Create error:', error);
        return null;
      }

      // Insert participants: creator auto-accepted, others as invited
      const participantRows = [
        { challenge_id: challenge.id, user_id: user.id, status: 'accepted', score: 0 },
        ...params.participantIds.map((pid) => ({
          challenge_id: challenge.id,
          user_id: pid,
          status: 'invited',
          score: 0,
        })),
      ];

      const { error: pError } = await supabase
        .from('challenge_participants')
        .insert(participantRows);

      if (pError) {
        console.warn('[Challenges] Participants insert error:', pError);
      }

      await get().fetchChallenges();
      return { id: challenge.id };
    } catch (err) {
      console.warn('[Challenges] Create exception:', err);
      return null;
    }
  },

  acceptChallenge: async (challengeId: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistic update
      set({
        challenges: get().challenges.map((c) =>
          c.id === challengeId
            ? {
                ...c,
                participants: c.participants.map((p) =>
                  p.userId === user.id ? { ...p, status: 'accepted' as ParticipantStatus } : p
                ),
              }
            : c
        ),
      });

      const { error } = await supabase
        .from('challenge_participants')
        .update({ status: 'accepted' })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[Challenges] Accept error:', error);
        await get().fetchChallenges();
      }
    } catch (err) {
      console.warn('[Challenges] Accept exception:', err);
      await get().fetchChallenges();
    }
  },

  declineChallenge: async (challengeId: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistic update
      set({
        challenges: get().challenges.map((c) =>
          c.id === challengeId
            ? {
                ...c,
                participants: c.participants.map((p) =>
                  p.userId === user.id ? { ...p, status: 'declined' as ParticipantStatus } : p
                ),
              }
            : c
        ),
      });

      const { error } = await supabase
        .from('challenge_participants')
        .update({ status: 'declined' })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[Challenges] Decline error:', error);
        await get().fetchChallenges();
      }
    } catch (err) {
      console.warn('[Challenges] Decline exception:', err);
      await get().fetchChallenges();
    }
  },

  updateScore: async (challengeId: string, userId: string, score: number) => {
    if (!isSupabaseConfigured) return;

    try {
      const { error } = await supabase
        .from('challenge_participants')
        .update({ score, last_updated: new Date().toISOString() })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId);

      if (error) {
        console.warn('[Challenges] Update score error:', error);
        return;
      }

      // Update local state
      set({
        challenges: get().challenges.map((c) =>
          c.id === challengeId
            ? {
                ...c,
                participants: c.participants.map((p) =>
                  p.userId === userId ? { ...p, score, lastUpdated: new Date().toISOString() } : p
                ),
              }
            : c
        ),
      });
    } catch (err) {
      console.warn('[Challenges] Update score exception:', err);
    }
  },

  reset: () => {
    set({ challenges: [], isLoading: false, isInitialized: false });
    AsyncStorage.removeItem(CACHE_KEY).catch(console.warn);
  },
}));
