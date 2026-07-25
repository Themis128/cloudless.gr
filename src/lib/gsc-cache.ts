/**
 * Read-through cache for slow third-party data (Google Search Console).
 *
 * GSC has per-minute, per-day, and 50k-row-per-day quotas. Every admin tab
 * open used to hit the API fresh. This cache lets each route serve from
 * D1 (Cloudflare Workers) or Dynamo (AWS Lambda) if a fresh-enough entry
 * exists, falling back to the live API when not. The hourly
 * /api/cron/gsc-cache-refresh job pre-warms the common queries so admin
 * users see instant responses.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  type AttributeValue,
} from "@/types/aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  payload: T;
  cachedAt: number;
  expiresAt: number;
  stale: boolean;
  ageSeconds: number;
}

// ---------------------------------------------------------------------------
// D1 cache helpers (D1 primary on Workers)
// ---------------------------------------------------------------------------

export function getAuthDb(): any {
  const db = (globalThis as any)?.__AUTH_DB__;
  return db;
}

export async function getCachedD1<T>(route: string, hash: string, ttlSeconds: number): Promise<CacheEntry<T> | null> {
  const db = getAuthDb();
  if (!db) return null;
  try {
    const result = await db.prepare(
      "SELECT result_json, cached_at, expires_at FROM analytics_cache WHERE pk = ? AND sk = ?"
    ).bind(route, hash).first();
    if (!result) return null;
    const entry = fromD1Row<T>(result, ttlSeconds);
    if (entry) return entry;
  } catch {
    // Fall through to DynamoDB
  }
  return null;
}

export async function setCachedD1<T>(route: string, hash: string, payload: T, ttlSeconds: number): Promise<void> {
  const db = getAuthDb();
  if (!db) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;
    await db.prepare(
      "INSERT INTO analytics_cache (pk, sk, result_json, cached_at, expires_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(pk, sk) DO UPDATE SET result_json = excluded.result_json, cached_at = excluded.cached_at, expires_at = excluded.expires_at"
    ).bind(route, hash, JSON.stringify(payload), now, expiresAt).run();
  } catch (err) {
    console.warn("[gsc-cache] setCachedD1 failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

let dynamoClient: DynamoDBClient | null = null;

export function getDynamoClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
      endpoint: resolveDynamoEndpoint(),
    });
  }
  return dynamoClient;
}

export function getTableName(): string | null {
  return process.env.GSC_CACHE_TABLE?.trim() || null;
}

export function paramsHash(params: Record<string, unknown>): string {
  const keys = Object.keys(params).sort();
  const parts = keys.map((k) => `${k}=${JSON.stringify(params[k])}`);
  return parts.join("&");
}

function fromItem<T>(item: Record<string, any>, ttlSeconds: number): CacheEntry<T> | null {
  try {
    const payload = JSON.parse(item.result_json?.S ?? "{}");
    const cachedAt = Number(item.cached_at?.N ?? 0);
    const expiresAt = Number(item.expires_at?.N ?? 0);
    const ageSeconds = Math.max(0, Math.floor((Date.now() / 1000) - cachedAt));
    return { payload, cachedAt, expiresAt, stale: ageSeconds > ttlSeconds, ageSeconds };
  } catch {
    return null;
  }
}

function fromD1Row<T>(row: any, ttlSeconds: number): CacheEntry<T> | null {
  try {
    const payload = JSON.parse(row.result_json ?? "{}");
    const cachedAt = row.cached_at ?? 0;
    const expiresAt = row.expires_at ?? 0;
    const ageSeconds = Math.max(0, Math.floor((Date.now() / 1000) - cachedAt));
    return { payload, cachedAt, expiresAt, stale: ageSeconds > ttlSeconds, ageSeconds };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public read/write API
// ---------------------------------------------------------------------------

export async function getCached<T>(
  route: string,
  params: Record<string, unknown>,
  ttlSeconds: number
): Promise<CacheEntry<T> | null> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    const hash = paramsHash(params);
    try {
      const result = await db.prepare(
        "SELECT result_json, cached_at, expires_at FROM analytics_cache WHERE pk = ? AND sk = ?"
      ).bind(route, hash).first();
      if (result) {
        const entry = fromD1Row<T>(result, ttlSeconds);
        if (entry) return entry;
      }
    } catch {
      // Fall through to DynamoDB
    }
  }

  const table = getTableName();
  if (!table) return null;
  try {
    const c = getDynamoClient();
    const out = await c.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: route }, sk: { S: paramsHash(params) } },
      })
    );
    if (!out.Item) return null;
    return fromItem<T>(out.Item, ttlSeconds);
  } catch (err) {
    console.warn("[gsc-cache] getCached failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 3600
): Promise<void> {
  const hash = paramsHash(params);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadJson = JSON.stringify(payload);
  const now = Math.floor(Date.now() / 1000);

  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      await db
        .prepare(
          "INSERT INTO analytics_cache (pk, sk, result_json, cached_at, expires_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(pk, sk) DO UPDATE SET result_json = excluded.result_json, cached_at = excluded.cached_at, expires_at = excluded.expires_at"
        )
        .bind(route, hash, payloadJson, now, expiresAt)
        .run();
      return;
    } catch {
      // Fall through to DynamoDB
    }
  }

  const table = getTableName();
  if (!table) return;
  try {
    const c = getDynamoClient();
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: route },
          sk: { S: hash },
          result_json: { S: payloadJson },
          cached_at: { N: String(now) },
          expires_at: { N: String(expiresAt) },
        },
      })
    );
  } catch (err) {
    console.warn("[gsc-cache] setCached failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Read-through helper: serve from cache if fresh; otherwise call `fetcher`,
 * write the result back, return it. Always returns the live (or freshly
 * fetched) value. Pass `acceptStaleSeconds` to keep serving slightly-stale
 * data when the live API fails (degraded-mode pattern from the GSC quota
 * best practices).
 */
export async function readThrough<T>(
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  const ttlSeconds = opts.ttlSeconds ?? 3600;
  const acceptStaleSeconds = opts.acceptStaleSeconds ?? 24 * 3600;

  const cached = await getCached<T>(route, params, ttlSeconds);
  if (cached && !cached.stale) {
    return { value: cached.payload, source: "cache", ageSeconds: cached.ageSeconds };
  }

  try {
    const live = await fetcher();
    void setCached(route, params, live, ttlSeconds);
    return { value: live, source: "live", ageSeconds: 0 };
  } catch (err) {
    if (cached && cached.ageSeconds <= acceptStaleSeconds) {
      console.warn(
        `[gsc-cache] live fetch failed for ${route}, serving stale (age=${cached.ageSeconds}s):`,
        err instanceof Error ? err.message : err
      );
      return { value: cached.payload, source: "stale", ageSeconds: cached.ageSeconds };
    }
    throw err;
  }
}