/**
 * Analytics event sink — Cloudflare D1 (replaces S3 NDJSON / Athena path).
 *
 * Funnel events (search_*, rec_*) still go through `search-funnel.ts`.
 * Generic product events land in `analytics_events` (migration 0009).
 */

import { getAuthDbFromEnv } from "@/lib/auth-d1";
import { allowDiscretionaryD1Write, passSample } from "@/lib/d1-write-budget";
import { secureId } from "@/lib/secure-id";

export interface AnalyticsEvent {
  event: string;
  user_id?: string;
  email?: string;
  session_id?: string;
  page?: string;
  referrer?: string;
  country?: string;
  ip?: string;
  user_agent?: string;
  amount?: number;
  currency?: string;
  plan?: string;
  product_id?: string;
  service?: string;
  source?: string;
  campaign?: string;
  medium?: string;
  properties?: Record<string, unknown>;
}

/**
 * Persist a generic analytics event to D1.
 * Returns true when written, false when D1 unavailable or invalid.
 */
export async function trackAnalyticsEvent(evt: AnalyticsEvent): Promise<boolean> {
  const event = typeof evt.event === "string" ? evt.event.trim().slice(0, 100) : "";
  if (!event) return false;

  if (!passSample("D1_ANALYTICS_SAMPLE", 0.05)) return false;
  if (!allowDiscretionaryD1Write(1)) return false;

  const db = getAuthDbFromEnv();
  if (!db) return false;

  const props = {
    ...(evt.properties ?? {}),
    ...(evt.email ? { email: evt.email } : {}),
    ...(evt.amount != null ? { amount: evt.amount } : {}),
    ...(evt.currency ? { currency: evt.currency } : {}),
    ...(evt.plan ? { plan: evt.plan } : {}),
    ...(evt.service ? { service: evt.service } : {}),
    ...(evt.country ? { country: evt.country } : {}),
    // IP intentionally dropped — do not store raw IP in D1
  };

  try {
    await db
      .prepare(
        `INSERT INTO analytics_events
          (id, event, session_id, user_id, page, referrer, source, campaign, medium, product_id, properties_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`
      )
      .bind(
        secureId("evt_"),
        event,
        evt.session_id?.slice(0, 128) ?? null,
        evt.user_id?.slice(0, 128) ?? null,
        evt.page?.slice(0, 500) ?? null,
        evt.referrer?.slice(0, 500) ?? null,
        evt.source?.slice(0, 128) ?? null,
        evt.campaign?.slice(0, 128) ?? null,
        evt.medium?.slice(0, 128) ?? null,
        evt.product_id?.slice(0, 120) ?? null,
        Object.keys(props).length > 0 ? JSON.stringify(props).slice(0, 4000) : null
      )
      .run();
    return true;
  } catch (err) {
    const safe = err instanceof Error ? err.message.replace(/[\x00-\x1F\x7F]/g, "") : "unknown";
    console.warn("[analytics] D1 write failed:", safe);
    return false;
  }
}

/** @deprecated Use trackAnalyticsEvent — kept for transitional imports. */
export function trackS3Event(evt: AnalyticsEvent): void {
  trackAnalyticsEvent(evt).catch(() => {});
}
