import { getAuthDbFromEnv } from "@/lib/auth-d1";
import { allowDiscretionaryD1Write } from "@/lib/d1-write-budget";
import {
  getCachedFromTable,
  setCachedToTable,
  readThroughTable,
  paramsHash,
  type CacheEntry,
} from "@/lib/d1-json-cache";

export type { CacheEntry };
export { paramsHash };

const TABLE = "espocrm_cache" as const;
const LOG = "espocrm-cache";

/**
 * Read-through D1 cache for EspoCRM admin latency (not a second CRM).
 * Table: AUTH_DB.espocrm_cache (migration 0017)
 */

export async function getCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 900
): Promise<CacheEntry<T> | null> {
  return getCachedFromTable<T>(TABLE, LOG, route, params, ttlSeconds);
}

export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 900
): Promise<void> {
  await setCachedToTable(TABLE, LOG, route, params, payload, ttlSeconds);
}

export async function readThrough<T>(
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  return readThroughTable(TABLE, LOG, route, params, fetcher, {
    ttlSeconds: opts.ttlSeconds ?? ESPO_CACHE_TTL.list,
    acceptStaleSeconds: opts.acceptStaleSeconds ?? 1800,
  });
}

/** Best-effort delete of all keys whose pk equals or starts with prefix. */
export async function invalidatePrefix(pkPrefix: string): Promise<void> {
  if (!allowDiscretionaryD1Write(1)) return;
  const db = getAuthDbFromEnv();
  if (!db) return;
  try {
    await db
      .prepare("DELETE FROM espocrm_cache WHERE pk = ? OR pk LIKE ?")
      .bind(pkPrefix, `${pkPrefix}%`)
      .run();
  } catch (err) {
    console.warn(
      "[espocrm-cache] invalidatePrefix failed:",
      err instanceof Error ? err.message : err
    );
  }
}

export async function invalidateKey(
  route: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  if (!allowDiscretionaryD1Write(1)) return;
  const db = getAuthDbFromEnv();
  if (!db) return;
  try {
    await db
      .prepare("DELETE FROM espocrm_cache WHERE pk = ? AND sk = ?")
      .bind(route, paramsHash(params))
      .run();
  } catch (err) {
    console.warn("[espocrm-cache] invalidateKey failed:", err instanceof Error ? err.message : err);
  }
}

/** Clear list + pipeline aggregates after mutating writes. */
export async function invalidateEspoListCaches(): Promise<void> {
  await Promise.all([
    invalidatePrefix("espocrm:listContacts"),
    invalidatePrefix("espocrm:listCompanies"),
    invalidatePrefix("espocrm:listTickets"),
    invalidatePrefix("espocrm:listDeals"),
    invalidatePrefix("espocrm:getDealsByStage"),
    invalidatePrefix("espocrm:getPipelineStats"),
  ]);
}

export async function invalidateEspoContactCaches(contactId: string): Promise<void> {
  await Promise.all([
    invalidateKey("espocrm:getContact", { id: contactId }),
    invalidateKey("espocrm:listContactOpportunities", { id: contactId }),
    invalidateKey("espocrm:listContactCases", { id: contactId }),
    invalidateKey("espocrm:listContactNotes", { id: contactId }),
    invalidateEspoListCaches(),
  ]);
}

export const ESPO_CACHE_TTL = {
  list: 900,
  contact: 900,
  pipeline: 900,
} as const;
