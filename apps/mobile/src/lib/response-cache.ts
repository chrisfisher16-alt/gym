// ── Smart Response Cache ─────────────────────────────────────────────
// Caches AI responses for repeated questions. Only caches intents where
// the answer is stable over short periods (general coaching, nutrition
// questions). Workout-specific queries are NOT cached because they depend
// on today's session state.

import type { UserIntent } from './intent-detector';

const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_CACHE_SIZE = 50;

// Intents safe to cache (answers don't change within minutes)
const CACHEABLE_INTENTS: Set<UserIntent> = new Set([
  'general_coaching',
  'nutrition_question',
  'exercise_lookup',
]);

interface CachedResponse {
  content: string;
  model: string;
  timestamp: number;
  intent: UserIntent;
}

const cache = new Map<string, CachedResponse>();

/**
 * DJB2 hash for fast string hashing.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Normalize the message for cache key generation.
 * Lowercase, trim, collapse whitespace, remove punctuation.
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Generate a cache key from the message and intent.
 * The key includes the normalized message hash so similar phrasing
 * of the same question hits the cache.
 */
function getCacheKey(message: string, intent: UserIntent): string {
  const normalized = normalizeMessage(message);
  return `${intent}:${hashString(normalized)}`;
}

/**
 * Check if a cached response exists for this message.
 * Returns null if not cached, expired, or intent is not cacheable.
 */
export function getCachedResponse(
  message: string,
  intent: UserIntent,
): { content: string; model: string } | null {
  if (!CACHEABLE_INTENTS.has(intent)) return null;

  const key = getCacheKey(message, intent);
  const entry = cache.get(key);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return { content: entry.content, model: `${entry.model} (cached)` };
}

/**
 * Store a response in the cache if the intent is cacheable.
 */
export function cacheResponse(
  message: string,
  intent: UserIntent,
  content: string,
  model: string,
): void {
  if (!CACHEABLE_INTENTS.has(intent)) return;

  // Evict oldest if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }

  const key = getCacheKey(message, intent);
  cache.set(key, {
    content,
    model,
    timestamp: Date.now(),
    intent,
  });
}

/** Clear the entire response cache. */
export function clearResponseCache(): void {
  cache.clear();
}

/** Get cache stats for debugging. */
export function getResponseCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: cache.size, maxSize: MAX_CACHE_SIZE, ttlMs: CACHE_TTL_MS };
}
