// ── Prompt Cache Verification ───────────────────────────────────────
// Hashes the static and user layers to verify cache eligibility.
// If the hash matches the previous message, we know the prompt prefix
// is identical — critical for both Anthropic and OpenAI cache hits.

let lastStaticHash: string | null = null;
let lastUserHash: string | null = null;
let consecutiveCacheHits = 0;

/**
 * Simple fast string hash (DJB2 algorithm).
 * Not cryptographic — just for equality checking.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export interface CacheVerification {
  staticLayerChanged: boolean;
  userLayerChanged: boolean;
  consecutiveHits: number;
}

/**
 * Check if the prompt layers have changed since last call.
 * Returns whether each layer changed, enabling callers to
 * log cache effectiveness.
 */
export function verifyCacheEligibility(
  staticLayer: string,
  userLayer: string,
): CacheVerification {
  const newStaticHash = hashString(staticLayer);
  const newUserHash = hashString(userLayer);

  const staticChanged = lastStaticHash !== null && lastStaticHash !== newStaticHash;
  const userChanged = lastUserHash !== null && lastUserHash !== newUserHash;

  if (!staticChanged && !userChanged && lastStaticHash !== null) {
    consecutiveCacheHits++;
  } else {
    consecutiveCacheHits = 0;
  }

  lastStaticHash = newStaticHash;
  lastUserHash = newUserHash;

  return {
    staticLayerChanged: staticChanged,
    userLayerChanged: userChanged,
    consecutiveHits: consecutiveCacheHits,
  };
}

/** Reset cache state (e.g., on conversation change) */
export function resetCacheState(): void {
  lastStaticHash = null;
  lastUserHash = null;
  consecutiveCacheHits = 0;
}
