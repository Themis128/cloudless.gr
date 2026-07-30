/**
 * Bookmark store for the ad-analytics scheduled poll.
 *
 * The runtime calls `getBookmark(key)` before pulling fresh metrics from a
 * platform, then `putBookmark(key, snapshot)` after a successful digest post.
 * Re-running a poll over the same window is idempotent — the bookmark is the
 * single source of truth for "the last snapshot we already posted."
 *
 * Backends:
 *  - `D1BookmarkStore` when AUTH_DB is bound (table `ad_analytics_bookmark`)
 *  - `InMemoryBookmarkStore` otherwise — useful for dev, unit tests, and
 *    cold starts without D1. The first poll posts a full snapshot (no delta);
 *    later polls in the same process post in-memory deltas.
 *
 * See `skills/ad-analytics/SKILL.md` operating principle #8 (idempotent
 * bookmarks) and the Notion architecture page §3.
 */

import type { AdMetrics, Bookmark, AdPlatformId } from "./types";
import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";

export interface BookmarkKeyOpts {
  campaignSlug: string;
  platform: AdPlatformId;
  /** "metrics" (headline) or one of the demographic pivot names like
   *  "MEMBER_INDUSTRY" — keep these stable; bookmark keys are forever. */
  metric: string;
  /** "15m" / "1h" / "1d" / "rolling-7d" — whatever the caller polls on. */
  window: string;
}

export function bookmarkKeyOf(opts: BookmarkKeyOpts): string {
  return `ad-analytics:${opts.campaignSlug}:${opts.platform}:${opts.metric}:${opts.window}`;
}

export interface IBookmarkStore {
  getBookmark(key: string): Promise<Bookmark | null>;
  putBookmark(key: string, snapshot: AdMetrics): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store — used when AUTH_DB is not bound.
// ---------------------------------------------------------------------------

class InMemoryBookmarkStore implements IBookmarkStore {
  private store = new Map<string, Bookmark>();

  async getBookmark(key: string): Promise<Bookmark | null> {
    return this.store.get(key) ?? null;
  }

  async putBookmark(key: string, snapshot: AdMetrics): Promise<void> {
    this.store.set(key, {
      key,
      lastPostedAt: new Date().toISOString(),
      snapshot,
    });
  }

  /** Test hook. */
  clear(): void {
    this.store.clear();
  }
}

const inMemoryFallback = new InMemoryBookmarkStore();

// ---------------------------------------------------------------------------
// D1 store — production backend (AUTH_DB.ad_analytics_bookmark).
// ---------------------------------------------------------------------------

class D1BookmarkStore implements IBookmarkStore {
  constructor(private readonly db: AuthDatabase) {}

  async getBookmark(key: string): Promise<Bookmark | null> {
    try {
      const row = await this.db
        .prepare(
          "SELECT pk, last_posted_at, snapshot_json FROM ad_analytics_bookmark WHERE pk = ?"
        )
        .bind(key)
        .first<{ pk: string; last_posted_at: string | null; snapshot_json: string | null }>();
      if (!row?.last_posted_at || !row.snapshot_json) return null;
      try {
        const snapshot = JSON.parse(row.snapshot_json) as AdMetrics;
        return { key, lastPostedAt: row.last_posted_at, snapshot };
      } catch {
        // Corrupt row — treat as missing so the next poll re-seeds.
        return null;
      }
    } catch (err) {
      console.error(
        `[ad-analytics/bookmarks] D1 getBookmark failed for ${key}:`,
        (err as Error)?.message ?? err
      );
      return null;
    }
  }

  async putBookmark(key: string, snapshot: AdMetrics): Promise<void> {
    try {
      const lastPostedAt = new Date().toISOString();
      const updatedAt = Math.floor(Date.now() / 1000);
      await this.db
        .prepare(
          `INSERT OR REPLACE INTO ad_analytics_bookmark (pk, last_posted_at, snapshot_json, updated_at)
           VALUES (?, ?, ?, ?)`
        )
        .bind(key, lastPostedAt, JSON.stringify(snapshot), updatedAt)
        .run();
    } catch (err) {
      console.error(
        `[ad-analytics/bookmarks] D1 putBookmark failed for ${key}:`,
        (err as Error)?.message ?? err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Factory: prefer AUTH_DB → D1, else in-memory.
// ---------------------------------------------------------------------------

let cached: IBookmarkStore | null = null;

export function getBookmarkStore(): IBookmarkStore {
  if (cached) return cached;
  const db = getAuthDbFromEnv();
  cached = db ? new D1BookmarkStore(db) : inMemoryFallback;
  return cached;
}

/** Test hook — drop the cached store + clear in-memory state. */
export function _resetBookmarkStore(): void {
  cached = null;
  inMemoryFallback.clear();
}
