// ── In-Memory Context Cache ─────────────────────────────────────────
// Caches stable user context (profile, goals, preferences) to avoid
// redundant DB queries during active conversations. Edge functions are
// ephemeral — cache resets on deploy, which is fine.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number = CACHE_TTL_MS, maxSize: number = MAX_CACHE_SIZE) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    // LRU eviction if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Delete oldest entry
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Export singleton caches for different data types
export const stableContextCache = new TTLCache<string>(CACHE_TTL_MS, MAX_CACHE_SIZE);
export const rateLimitCache = new TTLCache<{ hourly: number; daily: number }>(60 * 1000, 500); // 1-min TTL for rate limits

export { TTLCache };
