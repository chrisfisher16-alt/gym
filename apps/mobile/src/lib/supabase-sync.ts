import { supabase, isSupabaseConfigured } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Lazy-load NetInfo to prevent startup crashes when the native module isn't linked
let _NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
async function getNetInfo() {
  if (!_NetInfo) {
    const mod = await import('@react-native-community/netinfo');
    _NetInfo = mod.default;
  }
  return _NetInfo;
}

// ─── Sync Queue ────────────────────────────────────────────────────────────────
// Offline-first: write locally, queue for Supabase sync when online.
// Conflict resolution: local data wins for workout sets.

const SYNC_QUEUE_KEY = '@formiq/sync_queue';
const SYNC_STATUS_KEY = '@formiq/sync_status';
const DEAD_LETTER_KEY = '@formiq/sync_dead_letter';

export type SyncItemType =
  | 'session_create'
  | 'session_complete'
  | 'session_discard'
  | 'set_log'
  | 'set_update'
  | 'meal_log'
  | 'water_log'
  | 'measurement_log'
  | 'profile_update'
  | 'achievement_earned'
  | 'feedback_submit';

export interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  table: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAfter?: number;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingCount: number;
  isSyncing: boolean;
  lastError: string | null;
}

// ─── Queue Management ──────────────────────────────────────────────────────────

async function getQueue(): Promise<SyncQueueItem[]> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

const MAX_QUEUE_SIZE = 500;

export async function enqueue(
  type: SyncItemType,
  table: string,
  operation: SyncQueueItem['operation'],
  payload: Record<string, unknown>,
): Promise<void> {
  const queue = await getQueue();

  // Deduplicate: skip if queue already has a pending item with same type + payload ID
  const payloadId = payload.id as string | undefined;
  if (payloadId) {
    const duplicate = queue.find((q) => q.type === type && (q.payload.id as string) === payloadId);
    if (duplicate) return; // Already queued
  }

  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // Drop oldest
  }

  queue.push({
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    table,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 5,
  });
  await saveQueue(queue);
}

export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    const status = stored ? JSON.parse(stored) : {};
    const queue = await getQueue();

    // If isSyncing is persisted as true but the in-memory guard is false,
    // the app was restarted (or crashed) mid-sync — force-reset the flag.
    const isSyncing = status.isSyncing && _isProcessing;

    return {
      lastSyncAt: status.lastSyncAt ?? null,
      pendingCount: queue.length,
      isSyncing,
      lastError: status.lastError ?? null,
    };
  } catch {
    return { lastSyncAt: null, pendingCount: 0, isSyncing: false, lastError: null };
  }
}

async function updateSyncStatus(partial: Partial<SyncStatus>): Promise<void> {
  const current = await getSyncStatus();
  await AsyncStorage.setItem(
    SYNC_STATUS_KEY,
    JSON.stringify({ ...current, ...partial }),
  );
}

// ─── Process Queue ─────────────────────────────────────────────────────────────

async function processItem(item: SyncQueueItem): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { table, operation, payload } = item;

    if (operation === 'insert') {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    } else if (operation === 'update') {
      const { id, ...rest } = payload;
      const { error } = await supabase.from(table).update(rest).eq('id', id);
      if (error) throw error;
    } else if (operation === 'upsert') {
      const { error } = await supabase.from(table).upsert(payload);
      if (error) throw error;
    } else if (operation === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', payload.id);
      if (error) throw error;
    }

    return true;
  } catch (err) {
    console.warn(`Sync failed for ${item.type}:`, err);
    return false;
  }
}

// In-memory guard to prevent concurrent processQueue() calls
let _isProcessing = false;

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (!isSupabaseConfigured) return { processed: 0, failed: 0 };
  if (_isProcessing) return { processed: 0, failed: 0 };

  let isConnected = true; // Assume online if NetInfo unavailable
  try {
    const NetInfo = await getNetInfo();
    const netInfo = await NetInfo.fetch();
    isConnected = !!netInfo.isConnected;
  } catch {
    // Assume online if NetInfo unavailable
  }
  if (!isConnected) return { processed: 0, failed: 0 };

  _isProcessing = true;
  await updateSyncStatus({ isSyncing: true, lastError: null });

  const queue = await getQueue();
  const remaining: SyncQueueItem[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    if (item.nextRetryAfter && item.nextRetryAfter > Date.now()) {
      remaining.push(item); // Keep in queue but skip for now
      continue;
    }

    const success = await processItem(item);
    if (success) {
      processed++;
    } else {
      const baseDelay = 1000; // 1 second
      const maxDelay = 60000; // 60 seconds
      const delay = Math.min(maxDelay, baseDelay * Math.pow(2, item.retryCount));
      const jitter = Math.random() * delay * 0.3; // 30% jitter
      item.nextRetryAfter = Date.now() + delay + jitter;
      item.retryCount++;
      if (item.retryCount < item.maxRetries) {
        remaining.push(item);
      } else {
        failed++;
        console.warn(`Moving sync item to dead letter after ${item.maxRetries} retries:`, item.type);
        try {
          const dlRaw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
          const deadLetter: SyncQueueItem[] = dlRaw ? JSON.parse(dlRaw) : [];
          if (deadLetter.length >= 100) {
            deadLetter.shift(); // Drop oldest to cap size
          }
          deadLetter.push(item);
          await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(deadLetter));
        } catch {}
      }
    }
  }

  await saveQueue(remaining);
  await updateSyncStatus({
    isSyncing: false,
    lastSyncAt: new Date().toISOString(),
    pendingCount: remaining.length,
    lastError: failed > 0 ? `${failed} items failed permanently` : null,
  });

  _isProcessing = false;
  return { processed, failed };
}

export async function getDeadLetterQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function retryDeadLetterQueue(): Promise<{ processed: number; failed: number }> {
  const deadLetter = await getDeadLetterQueue();
  if (deadLetter.length === 0) return { processed: 0, failed: 0 };

  // Move items back to the main queue with reset retry counts
  const queue = await getQueue();
  for (const item of deadLetter) {
    item.retryCount = 0;
    queue.push(item);
  }
  await saveQueue(queue);
  await AsyncStorage.removeItem(DEAD_LETTER_KEY);

  return processQueue();
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

// ─── Pull from Supabase ────────────────────────────────────────────────────────

export async function pullWorkoutSessions(
  userId: string,
  since?: string,
): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('workout_sessions')
    .select(`
      *,
      set_logs (*)
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (since) {
    query = query.gte('started_at', since);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function pullExercises(): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('is_custom', false)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function pullPersonalRecords(userId: string): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('personal_records')
    .select('*, exercises(name, category)')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function pullNutritionLogs(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('nutrition_day_logs')
    .select(`
      *,
      meal_logs (*, meal_items (*))
    `)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function pullHydrationLogs(
  userId: string,
  date: string,
): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('hydration_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${date}T00:00:00`)
    .lt('logged_at', `${date}T23:59:59.999`)
    .order('logged_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function pullUserStreak(userId: string): Promise<unknown | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function pullAchievements(userId: string): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function pullBodyMeasurements(
  userId: string,
  limit = 30,
): Promise<unknown[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Auto-sync on connectivity change ──────────────────────────────────────────

let unsubscribeNetInfo: (() => void) | null = null;

export async function startAutoSync(): Promise<void> {
  if (unsubscribeNetInfo) return;
  try {
    const NetInfo = await getNetInfo();
    unsubscribeNetInfo = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
      if (state.isConnected) {
        processQueue().catch(console.warn);
      }
    });
  } catch {
    // NetInfo unavailable — auto-sync disabled
  }
}

export function stopAutoSync(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}
