/**
 * Bookmark store for the ad-analytics scheduled poll.
 *
 * The runtime calls `getBookmark(key)` before pulling fresh metrics from a
 * platform, then `putBookmark(key, snapshot)` after a successful digest post.
 * Re-running a poll over the same window is idempotent — the bookmark is the
 * single source of truth for "the last snapshot we already posted."
 *
 * Two backends, swap via env:
 *  - `DynamoBookmarkStore` when `AD_ANALYTICS_BOOKMARKS_TABLE` is set in env
 *    or SSM. Schema is one row per (campaign × platform × metric × window)
 *    tuple, keyed by the string `bookmarkKeyOf(...)`.
 *  - `InMemoryBookmarkStore` otherwise — useful for dev, unit tests, and the
 *    initial Phase 2 ship where the prod DynamoDB table hasn't been
 *    provisioned yet. The runtime degrades cleanly: the first poll posts a
 *    full snapshot (no delta), the second poll posts an in-memory delta, and
 *    on Lambda cold-start the bookmark resets — at worst the operator sees a
 *    "+everything" digest after a redeploy, which is harmless.
 *
 * See `skills/ad-analytics/SKILL.md` operating principle #8 (idempotent
 * bookmarks) and the Notion architecture page §3.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

import type { AdMetrics, Bookmark, AdPlatformId } from "./types";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

const REGION = process.env.AWS_REGION || "us-east-1";

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
// In-memory store — used when the DynamoDB table is not configured.
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
// DynamoDB store — production backend.
// ---------------------------------------------------------------------------

let dynamoClient: DynamoDBClient | null = null;
function getDynamoClient(): DynamoDBClient {
  dynamoClient ??= new DynamoDBClient({
    region: REGION,
    endpoint: resolveDynamoEndpoint(),
  });
  return dynamoClient;
}

class DynamoBookmarkStore implements IBookmarkStore {
  constructor(private readonly tableName: string) {}

  async getBookmark(key: string): Promise<Bookmark | null> {
    try {
      const res = await getDynamoClient().send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: { pk: { S: key } },
        })
      );
      const item = res.Item;
      if (!item) return null;
      const lastPostedAt = item.lastPostedAt?.S;
      const snapshotJson = item.snapshot?.S;
      if (!lastPostedAt || !snapshotJson) return null;
      try {
        const snapshot = JSON.parse(snapshotJson) as AdMetrics;
        return { key, lastPostedAt, snapshot };
      } catch {
        // Corrupt row — treat as missing so the next poll re-seeds.
        return null;
      }
    } catch (err) {
      console.error(
        `[ad-analytics/bookmarks] DynamoDB GetItem failed for ${key}:`,
        (err as Error)?.message ?? err
      );
      return null;
    }
  }

  async putBookmark(key: string, snapshot: AdMetrics): Promise<void> {
    try {
      await getDynamoClient().send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: {
            pk: { S: key },
            lastPostedAt: { S: new Date().toISOString() },
            snapshot: { S: JSON.stringify(snapshot) },
          },
        })
      );
    } catch (err) {
      console.error(
        `[ad-analytics/bookmarks] DynamoDB PutItem failed for ${key}:`,
        (err as Error)?.message ?? err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Factory: pick the backend based on env.
// ---------------------------------------------------------------------------

let cached: IBookmarkStore | null = null;

export function getBookmarkStore(): IBookmarkStore {
  if (cached) return cached;
  const table = (process.env.AD_ANALYTICS_BOOKMARKS_TABLE ?? "").trim();
  cached = table ? new DynamoBookmarkStore(table) : inMemoryFallback;
  return cached;
}

/** Test hook — drop the cached store + clear in-memory state. */
export function _resetBookmarkStore(): void {
  cached = null;
  inMemoryFallback.clear();
}
