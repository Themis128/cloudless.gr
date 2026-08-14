/**
 * Analytics R2 Adapter
 *
 * Writes NDJSON to R2 (`DATALAKE_BUCKET`). There is no S3 fallback —
 * if the binding is missing the event is dropped with a warning.
 */

import type { R2Bucket } from "@cloudflare/workers-types";

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
  medium?: string;
  campaign?: string;
  properties?: Record<string, unknown>;
}

interface AnalyticsR2Env {
  DATALAKE_BUCKET: R2Bucket;
}

// R2 adapter for Workers (Cloudflare-only)
export async function trackR2Event(env: AnalyticsR2Env, evt: AnalyticsEvent): Promise<void> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const key = `events/year=${y}/month=${m}/day=${d}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}.ndjson`;

  const record = JSON.stringify({
    timestamp: now.toISOString(),
    ...evt,
  });

  // Use env.DATALAKE_BUCKET (R2 binding in Workers)
  await env.DATALAKE_BUCKET.put(key, record, {
    httpMetadata: { contentType: "application/x-ndjson" },
  }).catch((e: Error) => console.error("[analytics-r2] R2 write failed:", e.message));
}

// Universal function - Workers environment only
export function trackEvent(env: AnalyticsR2Env | undefined, evt: AnalyticsEvent): void {
  // In Workers, env is passed with DATALAKE_BUCKET binding
  if (env?.DATALAKE_BUCKET) {
    trackR2Event(env, evt).catch(() => {});
  } else {
    console.warn("[analytics-r2] DATALAKE_BUCKET not available - event not tracked");
  }
}
