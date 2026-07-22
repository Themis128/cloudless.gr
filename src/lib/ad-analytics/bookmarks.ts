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
 * digests).
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------

interface BookmarkRow {
  snapshot: Record<string, unknown>;
  updatedAt: number;
}

const memoryStore = new Map<string, BookmarkRow>();

export function getMemoryBookmark(key: string): BookmarkRow | undefined {
  return memoryStore.get(key);
}

export function putMemoryBookmark(key: string, row: BookmarkRow | Record<string, unknown>): void {
  memoryStore.set(key, row as BookmarkRow);
}

export interface BookmarkStore {
  getBookmark(key: string): BookmarkRow | undefined;
  putBookmark(key: string, row: BookmarkRow | Record<string, unknown>): void;
}

// Backward-compatible alias for src/lib/ad-analytics/runtime.ts
export function getBookmarkStore(): BookmarkStore {
  return {
    getBookmark: getMemoryBookmark,
    putBookmark: putMemoryBookmark,
  };
}

// ---------------------------------------------------------------------------
// DynamoDB store
// ---------------------------------------------------------------------------

let dynamoClient: DynamoDBClient | null = null;

async function getDynamoClient(): Promise<DynamoDBClient> {
  if (!dynamoClient) {
    const { DynamoDBClient: DC } = await import("@aws-sdk/client-dynamodb");
    dynamoClient = new DC({
      region: process.env.AWS_REGION || "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT?.trim() || undefined,
    });
  }
  return dynamoClient;
}

function getTableName(): string {
  const name = process.env.AD_ANALYTICS_BOOKMARKS_TABLE?.trim();
  if (!name) throw new Error("AD_ANALYTICS_BOOKMARKS_TABLE is not configured");
  return name;
}

export function bookmarkKeyOf(opts: {
  campaign: string;
  platform: string;
  metric: string;
  window: string;
}): string {
  return `${opts.campaign}\x00${opts.platform}\x00${opts.metric}\x00${opts.window}`;
}

export async function getBookmark(key: string): Promise<BookmarkRow | null> {
  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const c = await getDynamoClient();
  const res = await c.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { bookmarkKey: { S: key } },
    })
  );
  const item = res.Item;
  if (!item?.snapshot?.M || !item?.updatedAt?.N) return null;
  return {
    snapshot: JSON.parse(item.snapshot.S ?? "{}"),
    updatedAt: Number(item.updatedAt.N),
  };
}

export async function putBookmark(
  key: string,
  _snapshotOrRow: Record<string, unknown> | BookmarkRow
): Promise<void> {
  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const c = await getDynamoClient();
  const now = Date.now();
  const snapshot = "snapshot" in _snapshotOrRow ? _snapshotOrRow.snapshot : _snapshotOrRow;
  await c.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: {
        bookmarkKey: { S: key },
        snapshot: { S: JSON.stringify(snapshot) },
        updatedAt: { N: String(now) },
        ttl: { N: String(Math.floor(now / 1000) + 90 * 24 * 60 * 60) },
      },
    })
  );
}
