import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_TIER_LIMITS } from '@health-coach/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────

export type UsageType = 'workout_logs' | 'meal_logs' | 'ai_messages';

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  resetDate: Date;
}

interface UsageRecord {
  count: number;
  period: string; // YYYY-MM for monthly, YYYY-MM-DD for daily
}

// ── Storage Keys ──────────────────────────────────────────────────────

const USAGE_KEY_PREFIX = '@hc_usage_';

function getStorageKey(type: UsageType, period: string): string {
  return `${USAGE_KEY_PREFIX}${type}_${period}`;
}

// ── Period Helpers ─────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMonthResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function getDayResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

// ── Usage Reading ─────────────────────────────────────────────────────

async function getUsageCount(type: UsageType, period: string): Promise<number> {
  try {
    const key = getStorageKey(type, period);
    const data = await AsyncStorage.getItem(key);
    if (!data) return 0;
    const record: UsageRecord = JSON.parse(data);
    return record.count;
  } catch {
    return 0;
  }
}

// ── Sync Helper ───────────────────────────────────────────────────────

async function syncLocalCache(type: UsageType, period: string, used: number): Promise<void> {
  const key = getStorageKey(type, period);
  await AsyncStorage.setItem(key, JSON.stringify({ count: used, period })).catch((e) => console.warn('[UsageLimits] cache sync failed:', e));
}

// ── Check Limits ──────────────────────────────────────────────────────

export async function checkWorkoutLogLimit(): Promise<UsageCheck> {
  // Try server-side check first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('check_usage', {
        p_usage_type: 'workout_logs',
        p_limit: FREE_TIER_LIMITS.workout_logs_per_month,
      });
      if (!error && data) {
        // Sync local cache
        const period = getCurrentMonth();
        await syncLocalCache('workout_logs', period, data.used);
        return {
          allowed: data.allowed,
          remaining: data.remaining,
          used: data.used,
          limit: data.limit,
          resetDate: getMonthResetDate(),
        };
      }
    } catch {
      // Fall through to local check
    }
  }
  // Fallback to local check
  const period = getCurrentMonth();
  const used = await getUsageCount('workout_logs', period);
  const limit = FREE_TIER_LIMITS.workout_logs_per_month;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), used, limit, resetDate: getMonthResetDate() };
}

export async function checkMealLogLimit(): Promise<UsageCheck> {
  // Try server-side check first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('check_usage', {
        p_usage_type: 'meal_logs',
        p_limit: FREE_TIER_LIMITS.meal_logs_per_day,
      });
      if (!error && data) {
        const period = getCurrentDate();
        await syncLocalCache('meal_logs', period, data.used);
        return {
          allowed: data.allowed,
          remaining: data.remaining,
          used: data.used,
          limit: data.limit,
          resetDate: getDayResetDate(),
        };
      }
    } catch {
      // Fall through to local check
    }
  }
  // Fallback to local check
  const period = getCurrentDate();
  const used = await getUsageCount('meal_logs', period);
  const limit = FREE_TIER_LIMITS.meal_logs_per_day;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), used, limit, resetDate: getDayResetDate() };
}

export async function checkAIMessageLimit(): Promise<UsageCheck> {
  // Try server-side check first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('check_usage', {
        p_usage_type: 'ai_messages',
        p_limit: FREE_TIER_LIMITS.ai_messages_per_day,
      });
      if (!error && data) {
        const period = getCurrentDate();
        await syncLocalCache('ai_messages', period, data.used);
        return {
          allowed: data.allowed,
          remaining: data.remaining,
          used: data.used,
          limit: data.limit,
          resetDate: getDayResetDate(),
        };
      }
    } catch {
      // Fall through to local check
    }
  }
  // Fallback to local check
  const period = getCurrentDate();
  const used = await getUsageCount('ai_messages', period);
  const limit = FREE_TIER_LIMITS.ai_messages_per_day;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), used, limit, resetDate: getDayResetDate() };
}

// ── Increment Usage ───────────────────────────────────────────────────

export async function incrementUsage(type: UsageType): Promise<void> {
  const limit = type === 'workout_logs' ? FREE_TIER_LIMITS.workout_logs_per_month
    : type === 'meal_logs' ? FREE_TIER_LIMITS.meal_logs_per_day
    : FREE_TIER_LIMITS.ai_messages_per_day;

  // Try server-side atomic increment first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('check_and_increment_usage', {
        p_usage_type: type,
        p_limit: limit,
      });
      if (!error && data) {
        // Sync local cache
        const period = type === 'workout_logs' ? getCurrentMonth() : getCurrentDate();
        await syncLocalCache(type, period, data.used);
        return;
      }
    } catch {
      // Fall through to local increment
    }
  }
  // Fallback to local increment
  const period = type === 'workout_logs' ? getCurrentMonth() : getCurrentDate();
  const key = getStorageKey(type, period);
  try {
    const data = await AsyncStorage.getItem(key);
    const current = data ? (JSON.parse(data) as UsageRecord).count : 0;
    await AsyncStorage.setItem(key, JSON.stringify({ count: current + 1, period }));
  } catch (error) {
    console.warn(`[UsageLimits] Failed to increment ${type}:`, error);
  }
}

// ── Check Any Limit ───────────────────────────────────────────────────

export async function checkUsageLimit(type: UsageType): Promise<UsageCheck> {
  switch (type) {
    case 'workout_logs':
      return checkWorkoutLogLimit();
    case 'meal_logs':
      return checkMealLogLimit();
    case 'ai_messages':
      return checkAIMessageLimit();
  }
}

// ── Reset (for testing) ───────────────────────────────────────────────

export async function resetUsage(type: UsageType): Promise<void> {
  const period = type === 'workout_logs' ? getCurrentMonth() : getCurrentDate();
  const key = getStorageKey(type, period);
  await AsyncStorage.removeItem(key);
}
