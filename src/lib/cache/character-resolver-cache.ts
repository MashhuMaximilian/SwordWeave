/**
 * character-resolver-cache.ts — Phase 8.3f S3 (Mashu 2026-07-28)
 *
 * Tiny in-memory LRU cache for character resolver outputs. Used
 * by /api/characters/[id]/resolve to avoid recomputing every
 * request — the resolver touches DB every time (character +
 * primitiveLinks + hard_modifiers), and a sheet refresh can
 * hammer it dozens of times per second.
 *
 * Cache key: `${characterId}:${targetOrAll}` where
 * `targetOrAll` is either `"all"` or a specific ModifierTarget
 * string (e.g. "character.attribute.physical").
 *
 * Cache invalidation: every PATCH/POST to a character subroute
 * calls `bustResolverCache(characterId)` to drop all entries for
 * that character. Implemented in the per-route handlers (Phase
 * 8.3f S3 follow-up — the invalidation calls are added by the
 * route handlers themselves).
 *
 * Limits:
 *   - Max 500 entries total (LRU eviction past that)
 *   - TTL: 30 seconds (configurable via TTL_MS)
 *   - One cache instance per Node process (Next.js dev mode
 *     re-evaluates modules, so dev hot-reload may invalidate —
 *     acceptable; production is stable).
 */

import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";

// =============================================================================
// Cache config
// =============================================================================

const TTL_MS = 30_000; // 30 seconds
const MAX_ENTRIES = 500;

// =============================================================================
// Internal LRU
// =============================================================================

interface CacheEntry {
  value: ResolvedModifiers | { total: number; contributions: unknown };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * LRU eviction: every time we read or write an entry we move it
 * to the end of the Map's insertion order (Map preserves order).
 * When we exceed MAX_ENTRIES we drop the oldest (first) entry.
 */
function lruTouch(key: string, entry: CacheEntry): void {
  // Re-insert to move to end (most recent).
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a cached resolver result. Returns undefined if missing
 * or expired.
 */
export function getResolverCache(
  characterId: string,
  target: string,
): ResolvedModifiers | { total: number; contributions: unknown } | undefined {
  const key = `${characterId}:${target}`;
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  lruTouch(key, entry);
  return entry.value;
}

/**
 * Set a cached resolver result.
 */
export function setResolverCache(
  characterId: string,
  target: string,
  value: ResolvedModifiers | { total: number; contributions: unknown },
): void {
  const key = `${characterId}:${target}`;
  const entry: CacheEntry = { value, expiresAt: Date.now() + TTL_MS };
  lruTouch(key, entry);
}

/**
 * Drop all cached entries for a character. Called by route
 * handlers after PATCH/POST/DELETE.
 */
export function bustResolverCache(characterId: string): number {
  let removed = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(`${characterId}:`)) {
      cache.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Clear the entire cache. Test-only helper — not exported to
 * runtime callers.
 */
export function _clearAllResolverCache(): void {
  cache.clear();
}

/**
 * Current entry count (for tests + diagnostics).
 */
export function _resolverCacheSize(): number {
  return cache.size;
}