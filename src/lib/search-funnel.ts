/**
 * Store search / recommendation funnel events → Cloudflare D1.
 *
 * Cloudflare-first replacement for Athena/S3 funnel analytics.
 * No-ops gracefully when AUTH_DB is unavailable (local/dev without bindings).
 */

import type { AuthDatabase } from "@/lib/auth-d1";

export const FUNNEL_EVENT_TYPES = [
  "search_query",
  "search_result",
  "search_click",
  "search_buy",
  "rec_impression",
  "rec_click",
] as const;

export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export interface FunnelEventInput {
  event_type: FunnelEventType;
  session_id: string;
  query?: string;
  result_ids?: string[];
  product_id?: string;
  source?: string;
  result_count?: number;
  ab_variant?: string;
  user_id?: string;
}

interface WorkersGlobal {
  __AUTH_DB__?: AuthDatabase;
}

interface ProcessWithAuthDb {
  env?: { AUTH_DB?: AuthDatabase };
}

function workersGlobal(): WorkersGlobal {
  return globalThis as unknown as WorkersGlobal;
}

function getProcessEnv(): ProcessWithAuthDb["env"] {
  return (process as unknown as ProcessWithAuthDb).env;
}

export function getFunnelD1Binding(): AuthDatabase | null {
  const db = getProcessEnv()?.AUTH_DB ?? workersGlobal().__AUTH_DB__;
  if (db && typeof db.prepare === "function") return db;
  return null;
}

export function isFunnelEventType(value: string): value is FunnelEventType {
  return (FUNNEL_EVENT_TYPES as readonly string[]).includes(value);
}

export function normalizeFunnelEvent(
  input: Partial<FunnelEventInput> & { event_type?: string; session_id?: string }
): FunnelEventInput | null {
  if (!input.event_type || !isFunnelEventType(input.event_type)) return null;
  const session_id =
    typeof input.session_id === "string" ? input.session_id.trim().slice(0, 128) : "";
  if (!session_id) return null;

  const result_ids = Array.isArray(input.result_ids)
    ? input.result_ids.filter((id): id is string => typeof id === "string").slice(0, 40)
    : undefined;

  return {
    event_type: input.event_type,
    session_id,
    query: typeof input.query === "string" ? input.query.trim().slice(0, 200) : undefined,
    result_ids,
    product_id:
      typeof input.product_id === "string" ? input.product_id.trim().slice(0, 120) : undefined,
    source: typeof input.source === "string" ? input.source.trim().slice(0, 64) : undefined,
    result_count:
      typeof input.result_count === "number" && Number.isFinite(input.result_count)
        ? Math.max(0, Math.min(1000, Math.floor(input.result_count)))
        : result_ids?.length,
    ab_variant:
      typeof input.ab_variant === "string" ? input.ab_variant.trim().slice(0, 16) : undefined,
    user_id: typeof input.user_id === "string" ? input.user_id.trim().slice(0, 128) : undefined,
  };
}

function newEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `funnel_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Insert one funnel event into D1. Returns true when written, false when skipped.
 */
export async function recordFunnelEvent(raw: FunnelEventInput): Promise<boolean> {
  const event = normalizeFunnelEvent(raw);
  if (!event) return false;

  const db = getFunnelD1Binding();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO search_funnel_events
          (id, session_id, event_type, query, result_ids_json, product_id, source, result_count, ab_variant, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`
      )
      .bind(
        newEventId(),
        event.session_id,
        event.event_type,
        event.query ?? null,
        event.result_ids ? JSON.stringify(event.result_ids) : null,
        event.product_id ?? null,
        event.source ?? null,
        event.result_count ?? null,
        event.ab_variant ?? null,
        event.user_id ?? null
      )
      .run();
    return true;
  } catch (err) {
    const safe =
      err instanceof Error ? err.message.replace(/[\x00-\x1F\x7F]/g, "") : "unknown";
    console.warn("[search-funnel] D1 insert failed:", safe);
    return false;
  }
}

export interface FunnelSummaryRow {
  event_type: string;
  count: number;
  ab_variant: string | null;
}

/** Aggregate funnel counts for admin (last N days). */
export async function getFunnelSummary(days = 30): Promise<FunnelSummaryRow[] | null> {
  const db = getFunnelD1Binding();
  if (!db) return null;

  const since = Math.floor(Date.now() / 1000) - Math.max(1, days) * 86400;
  try {
    const result = await db
      .prepare(
        `SELECT event_type, ab_variant, COUNT(*) AS count
         FROM search_funnel_events
         WHERE created_at >= ?
         GROUP BY event_type, ab_variant
         ORDER BY event_type, ab_variant`
      )
      .bind(since)
      .all<{ event_type: string; ab_variant: string | null; count: number }>();
    return result.results ?? [];
  } catch (err) {
    const safe =
      err instanceof Error ? err.message.replace(/[\x00-\x1F\x7F]/g, "") : "unknown";
    console.warn("[search-funnel] D1 summary failed:", safe);
    return null;
  }
}
