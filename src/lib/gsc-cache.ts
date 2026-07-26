import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";
import { createHash } from "crypto";

/**
 * Read-through cache for slow third-party data (Google Search Console).
 *
 * GSC has per-minute, per-day, and 50k-row-per-day quotas. Every admin tab
 * open used to hit the API fresh. This cache lets each route serve from
 * Dynamo if a fresh-enough entry exists, falling back to the live API when
 * not. The hourly /api/cron/gsc-cache-refresh job pre-warms the common
 * queries so admin users see instant responses.
 *
 * Schema:
 *   pk = "<route>"                e.g. "seo", "keywords", "ctr-opportunities"
 *   sk = "<params-hash>"          deterministic for a given query-string
 *   payload (S, JSON)             the cached response body
 *   storedAt (S, ISO 8601)        when we wrote it
 *   ttlSeconds (N)                requested TTL at write time
 *
 * Failure model: safe. If the table is not configured (no env var), or any
 * Dynamo operation throws, helpers return null / undefined and callers fall
 * back to the live API path. The cache is never on the critical path.
 */

const REGION = process.env.AWS_REGION || "us-east-1";

let dynamoClient: DynamoDBClient | null = null;
function getDynamoClient(): DynamoDBClient {
  dynamoClient ??= new DynamoDBClient({
    region: REGION,
    endpoint: resolveDynamoEndpoint(),
  });
  return dynamoClient;
}

function getTableName(): string | null {
  return process.env.ANALYTICS_CACHE_TABLE?.trim() || null;
}

/**
 * Hash an arbitrary params object into a short deterministic key suffix.
 * Same input → same hash, regardless of property order, on every Lambda.
 */
export function paramsHash(params: Record<string, unknown> = {}): string {
  // Sort keys so {a:1, b:2} and {b:2, a:1} hash to the same value.
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "default";
  const canonical = JSON.stringify(entries);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface CacheEntry<T> {
  payload: T;
  storedAt: string;
  ageSeconds: number;
  stale: boolean;
}

function toItem<T>(
  route: string,
  hash: string,
  payload: T,
  ttlSeconds: number
): Record<string, AttributeValue> {
  return {
    pk: { S: route },
    sk: { S: hash },
    payload: { S: JSON.stringify(payload) },
    storedAt: { S: new Date().toISOString() },
    ttlSeconds: { N: String(ttlSeconds) },
  };
}

function fromItem<T>(
  item: Record<string, AttributeValue>,
  ttlSeconds: number
): CacheEntry<T> | null {
  const storedAt = item.storedAt?.S;
  const raw = item.payload?.S;
  if (!storedAt || !raw) return null;
  let payload: T;
  try {
    payload = JSON.parse(raw) as T;
  } catch {
    return null;
  }
  const storedAtMs = Date.parse(storedAt);
  const ageSeconds = Math.max(0, Math.floor((Date.now() - storedAtMs) / 1000));
  return {
    payload,
    storedAt,
    ageSeconds,
    stale: ageSeconds > ttlSeconds,
  };
}

/**
 * Read a cached entry. Returns null if:
 *   - the table is not configured (local dev / partial deploy)
 *   - no entry exists for (route, hash)
 *   - the entry is malformed
 * The caller decides whether a stale entry is acceptable; both fresh and
 * stale entries are returned with their `ageSeconds` filled in.
 */
export async function getCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 3600
): Promise<CacheEntry<T> | null> {
  const table = getTableName();
  if (!table) return null;
  const hash = paramsHash(params);
  try {
    const out = await getDynamoClient().send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: route }, sk: { S: hash } },
      })
    );
    if (!out.Item) return null;
    return fromItem<T>(out.Item, ttlSeconds);
  } catch (err) {
    console.warn("[gsc-cache] getCached failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Write a payload to the cache. Best-effort — failures are logged and
 * swallowed because cache writes must never break the user-facing path.
 */
export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 3600
): Promise<void> {
  const table = getTableName();
  if (!table) return;
  const hash = paramsHash(params);
  try {
    await getDynamoClient().send(
      new PutItemCommand({
        TableName: table,
        Item: toItem(route, hash, payload, ttlSeconds),
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
