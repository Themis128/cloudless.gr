/**
 * AppFlowy Cache Invalidation — placeholder for cache invalidation.
 *
 * AppFlowy doesn't have webhook-based cache invalidation like Notion.
 * This module provides a compatible no-op interface.
 */

import { isAppFlowyConfigured } from "./appflowy";

/**
 * Invalidate AppFlowy-related caches.
 * Called by webhooks when content changes.
 * No-op for AppFlowy since it doesn't push webhooks.
 */
export async function invalidateCache(): Promise<void> {
  if (!(await isAppFlowyConfigured())) return;

  // AppFlowy doesn't have webhook-based cache invalidation
  // Cache is handled by TTL in the appflowy.ts client
  console.warn("[AppFlowy Cache] invalidateCache called (no-op, TTL-based caching)");
}

/**
 * Invalidate specific cache keys.
 * No-op for AppFlowy.
 */
export async function invalidateCacheKeys(keys: string[]): Promise<void> {
  if (!(await isAppFlowyConfigured())) return;
  console.warn("[AppFlowy Cache] invalidateCacheKeys called for:", keys, "(no-op)");
}
