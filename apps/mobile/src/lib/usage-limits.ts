import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_TIER_LIMITS } from '@health-coach/shared';

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

// ── Check Limits ──────────────────────────────────────────────────────

export async function checkWorkoutLogLimit(): Promise<UsageCheck> {
  const period = getCurrentMonth();
  const used = await getUsageCount('workout_logs', period);
  const limit = FREE_TIER_LIMITS.workout_logs_per_month;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    used,
    limit,
    resetDate: getMonthResetDate(),
  };
}

export async function checkMealLogLimit(): Promise<UsageCheck> {
  const period = getCurrentDate();
  const used = await getUsageCount('meal_logs', period);
  const limit = FREE_TIER_LIMITS.meal_logs_per_day;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    used,
    limit,
    resetDate: getDayResetDate(),
  };
}

export async function checkAIMessageLimit(): Promise<UsageCheck> {
  const period = getCurrentDate();
  const used = await getUsageCount('ai_messages', period);
  const limit = FREE_TIER_LIMITS.ai_messages_per_day;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    used,
    limit,
    resetDate: getDayResetDate(),
  };
}

// ── Increment Usage ───────────────────────────────────────────────────

export async function incrementUsage(type: UsageType): Promise<void> {
  const period = type === 'workout_logs' ? getCurrentMonth() : getCurrentDate();
  const key = getStorageKey(type, period);

  try {
    const data = await AsyncStorage.getItem(key);
    const current = data ? (JSON.parse(data) as UsageRecord).count : 0;
    const record: UsageRecord = { count: current + 1, period };
    await AsyncStorage.setItem(key, JSON.stringify(record));
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
