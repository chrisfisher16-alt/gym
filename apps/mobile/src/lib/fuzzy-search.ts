// ── Fuzzy Search Engine ────────────────────────────────────────────
// Lightweight fuzzy matching for the Command Palette.
// No external dependencies — runs in <1ms for typical datasets.

import type { Ionicons } from '@expo/vector-icons';

// ── Types ──────────────────────────────────────────────────────────

export type SearchResultType = 'exercise' | 'meal' | 'workout' | 'action' | 'setting';

export interface SearchResult {
  type: SearchResultType;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onSelect: () => void;
  score: number; // match quality 0–1
}

export interface SearchSource {
  type: SearchResultType;
  items: ReadonlyArray<{
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    onSelect: () => void;
  }>;
}

// ── Fuzzy Match ────────────────────────────────────────────────────
// Returns a 0–1 score indicating match quality.
// 0 = no match, higher = better match.

export function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (q.length === 0) return 0;
  if (t.includes(q)) {
    // Exact substring match — score based on coverage
    return 0.8 + 0.2 * (q.length / t.length);
  }

  let qIdx = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatchIdx = -2;

  const words = getWordBoundaries(t);

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;

      // Consecutive match bonus
      if (tIdx === lastMatchIdx + 1) {
        consecutive++;
        score += 1 + consecutive * 0.5;
      } else {
        consecutive = 0;
        score += 1;
      }

      // Word boundary bonus (start of word)
      if (words.has(tIdx)) {
        score += 2;
      }

      // First character bonus
      if (tIdx === 0) {
        score += 3;
      }

      lastMatchIdx = tIdx;
    }
  }

  // All query characters must match
  if (qIdx < q.length) return 0;

  // Normalize: max possible score per char ≈ 6.5, scale to 0–1
  const maxPossible = q.length * 6.5;
  const normalized = Math.min(score / maxPossible, 1);

  // Penalize long targets (prefer shorter, more specific matches)
  const lengthPenalty = Math.max(0, 1 - (t.length - q.length) * 0.01);

  return Math.max(normalized * lengthPenalty, 0.01);
}

// ── Search All Sources ─────────────────────────────────────────────

const SCORE_THRESHOLD = 0.3;
const MAX_RESULTS = 20;

export function searchAll(query: string, sources: ReadonlyArray<SearchSource>): SearchResult[] {
  if (query.trim().length === 0) return [];

  const results: SearchResult[] = [];

  for (const source of sources) {
    for (const item of source.items) {
      const titleScore = fuzzyMatch(query, item.title);
      const subtitleScore = item.subtitle ? fuzzyMatch(query, item.subtitle) * 0.7 : 0;
      const score = Math.max(titleScore, subtitleScore);

      if (score >= SCORE_THRESHOLD) {
        results.push({
          type: source.type,
          title: item.title,
          subtitle: item.subtitle,
          icon: item.icon,
          onSelect: item.onSelect,
          score,
        });
      }
    }
  }

  // Sort by score descending, then alphabetically for ties
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return results.slice(0, MAX_RESULTS);
}

// ── Helpers ────────────────────────────────────────────────────────

function getWordBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>();
  boundaries.add(0); // First character is always a word boundary
  for (let i = 1; i < text.length; i++) {
    const prev = text[i - 1];
    // Start of a new word: after space, hyphen, underscore, or case transition
    if (prev === ' ' || prev === '-' || prev === '_' || prev === '(') {
      boundaries.add(i);
    }
  }
  return boundaries;
}
