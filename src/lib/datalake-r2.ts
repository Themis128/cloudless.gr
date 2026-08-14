/**
 * Admin datalake serving layer — gold snapshot first (Cloudflare R2 + D1).
 *
 * Architecture (lakehouse serving):
 *   ETL → R2 parquet (silver) → materialize-datalake-snapshots (gold JSON)
 *   Admin UI → this module → never live Stripe/GSC/Sentry/Espo/Postiz/n8n
 *
 * Gold source of truth: R2 `lake/snapshots/admin-datalake.json`
 * Hot overlay only: D1 `analytics_events` for acquisition_funnel + attribution
 * (product events are written live; no silver ETL for them yet).
 *
 * Missing sections return an error — no Athena / live-upstream fallback.
 */

import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";

export interface DatalakeSectionResult {
  section: string;
  rows?: Record<string, string | number | null>[];
  rowCount?: number;
  fromCache?: boolean;
  error?: string;
}

export interface DatalakeFreshnessMeta {
  generated_at?: string;
  sources?: Record<
    string,
    {
      exists?: boolean;
      last_etl_at?: string | null;
      size?: number | null;
    }
  >;
}

export interface DatalakeDashboardPayload {
  generated_at: string;
  cache: string;
  /** "gold" = R2 snapshot present; "hot_only" = D1 overlay without gold */
  source: "gold" | "hot_only" | "empty";
  sections: DatalakeSectionResult[];
  freshness?: DatalakeFreshnessMeta;
}

const SNAPSHOT_KEY = "lake/snapshots/admin-datalake.json";

/** Full gold section order — matches materialize-datalake-snapshots.mjs + D1 hot. */
export const SECTION_ORDER = [
  "acquisition_funnel",
  "attribution",
  "top_keywords",
  "top_pages",
  "gsc_countries",
  "gsc_devices",
  "gsc_query_pages",
  "linkedin_ads",
  "top_errors",
  "espocrm_funnel",
  "stripe_revenue",
  "n8n_ops",
  "postiz_ops",
  "appflowy_activity",
  "rfm_churn",
  "freshness",
] as const;

export type DatalakeSectionName = (typeof SECTION_ORDER)[number];

/** Hot-path sections overlaid from D1 when AUTH_DB is bound. */
const HOT_D1_SECTIONS = new Set<string>(["acquisition_funnel", "attribution"]);

const MISSING_ERROR =
  "not available (gold ETL snapshot missing — run materialize-datalake-snapshots)";

function daysAgoUnix(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

async function acquisitionFromD1(db: AuthDatabase): Promise<DatalakeSectionResult> {
  const since = daysAgoUnix(30);
  const result = await db
    .prepare(
      `SELECT date(created_at, 'unixepoch') AS day,
              COUNT(DISTINCT CASE WHEN event = 'page_view' THEN session_id END) AS sessions,
              COUNT(DISTINCT CASE WHEN event = 'signup' THEN user_id END) AS signups,
              COUNT(DISTINCT CASE WHEN event = 'purchase' THEN user_id END) AS purchasers,
              SUM(CASE WHEN event = 'purchase'
                       THEN COALESCE(json_extract(properties_json, '$.amount'), 0)
                       ELSE 0 END) AS revenue
       FROM analytics_events
       WHERE created_at >= ?
       GROUP BY 1
       ORDER BY 1 DESC`
    )
    .bind(since)
    .all<Record<string, string | number | null>>();

  return {
    section: "acquisition_funnel",
    rows: result.results ?? [],
    rowCount: (result.results ?? []).length,
    fromCache: false,
  };
}

async function attributionFromD1(db: AuthDatabase): Promise<DatalakeSectionResult> {
  const since = daysAgoUnix(90);
  const result = await db
    .prepare(
      `SELECT COALESCE(source, '(direct)') AS utm_source,
              COALESCE(medium, '(none)') AS utm_medium,
              COALESCE(campaign, '(none)') AS utm_campaign,
              COUNT(DISTINCT CASE WHEN event = 'page_view' THEN session_id END) AS sessions,
              COUNT(DISTINCT CASE WHEN event = 'signup' THEN user_id END) AS signups,
              SUM(CASE WHEN event = 'purchase' THEN 1 ELSE 0 END) AS purchases,
              SUM(CASE WHEN event = 'purchase'
                       THEN COALESCE(json_extract(properties_json, '$.amount'), 0)
                       ELSE 0 END) AS revenue
       FROM analytics_events
       WHERE created_at >= ?
       GROUP BY 1, 2, 3
       HAVING COUNT(*) > 1
       ORDER BY revenue DESC, sessions DESC
       LIMIT 25`
    )
    .bind(since)
    .all<Record<string, string | number | null>>();

  return {
    section: "attribution",
    rows: result.results ?? [],
    rowCount: (result.results ?? []).length,
    fromCache: false,
  };
}

interface RawGoldSnapshot {
  generated_at?: string;
  cache?: string;
  sections?: DatalakeSectionResult[];
  freshness?: DatalakeFreshnessMeta;
}

export async function loadDatalakeSnapshotFromR2(): Promise<{
  generated_at: string;
  sections: DatalakeSectionResult[];
  freshness?: DatalakeFreshnessMeta;
} | null> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;
  const object = await bucket.get(SNAPSHOT_KEY);
  if (!object) return null;
  const parsed = JSON.parse(await object.text()) as RawGoldSnapshot;
  if (!parsed?.sections || !Array.isArray(parsed.sections)) return null;
  return {
    generated_at: parsed.generated_at || new Date().toISOString(),
    sections: parsed.sections.map((s) => ({
      ...s,
      fromCache: true,
    })),
    freshness: parsed.freshness,
  };
}

function sectionUsable(section: DatalakeSectionResult | undefined): boolean {
  return Boolean(section && !section.error && Array.isArray(section.rows));
}

function d1SectionError(section: string, error: unknown): DatalakeSectionResult {
  return {
    section,
    error: error instanceof Error ? error.message.slice(0, 300) : String(error),
  };
}

/**
 * Snapshot-first dashboard payload for /admin/analytics/datalake.
 *
 * @param options.refresh — re-read gold from R2 (no skip); kept for API compat
 */
export async function getDatalakeDashboard(options: {
  refresh?: boolean;
}): Promise<DatalakeDashboardPayload> {
  void options.refresh;

  const byName = new Map<string, DatalakeSectionResult>();
  let goldGeneratedAt: string | null = null;
  let freshness: DatalakeFreshnessMeta | undefined;
  let hasGold = false;

  // 1) Gold snapshot first (all ETL-backed sections)
  try {
    const snap = await loadDatalakeSnapshotFromR2();
    if (snap) {
      hasGold = true;
      goldGeneratedAt = snap.generated_at;
      freshness = snap.freshness;
      for (const section of snap.sections) {
        byName.set(section.section, section);
      }
    }
  } catch (error) {
    console.warn(
      "[datalake-r2] gold snapshot read failed:",
      error instanceof Error ? error.message : error
    );
  }

  // 2) Hot D1 overlay for acquisition / attribution (near-real-time product events)
  const db = getAuthDbFromEnv();
  if (db) {
    try {
      byName.set("acquisition_funnel", await acquisitionFromD1(db));
    } catch (error) {
      if (!sectionUsable(byName.get("acquisition_funnel"))) {
        byName.set("acquisition_funnel", d1SectionError("acquisition_funnel", error));
      }
    }
    try {
      byName.set("attribution", await attributionFromD1(db));
    } catch (error) {
      if (!sectionUsable(byName.get("attribution"))) {
        byName.set("attribution", d1SectionError("attribution", error));
      }
    }
  }

  const sections = SECTION_ORDER.map((section) => {
    const existing = byName.get(section);
    if (sectionUsable(existing)) return existing!;
    if (existing?.error) return existing;
    if (HOT_D1_SECTIONS.has(section) && !db) {
      return { section, error: "not available (AUTH_DB unbound — hot path needs D1)" };
    }
    return { section, error: MISSING_ERROR };
  });

  const source: DatalakeDashboardPayload["source"] = hasGold ? "gold" : db ? "hot_only" : "empty";

  return {
    generated_at: goldGeneratedAt || new Date().toISOString(),
    cache: "cloudflare",
    source,
    sections,
    freshness,
  };
}
