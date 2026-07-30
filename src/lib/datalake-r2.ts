/**
 * Admin datalake dashboard reads — Cloudflare only (D1 + R2).
 *
 * Acquisition/attribution: live D1 `analytics_events` when AUTH_DB is bound.
 * GSC / Sentry / LinkedIn / EspoCRM: R2 snapshot
 * `lake/snapshots/admin-datalake.json` (ETL: materialize-datalake-snapshots.mjs).
 *
 * Missing sections return an error — no Athena fallback.
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

export interface DatalakeDashboardPayload {
  generated_at: string;
  cache: string;
  sections: DatalakeSectionResult[];
}

const SNAPSHOT_KEY = "lake/snapshots/admin-datalake.json";

const SECTION_ORDER = [
  "acquisition_funnel",
  "attribution",
  "top_keywords",
  "linkedin_ads",
  "top_errors",
  "espocrm_funnel",
] as const;

/** Sections served from D1 — excluded when merging R2 snapshot rows. */
const D1_SECTIONS = new Set<string>(["acquisition_funnel", "attribution"]);

const MISSING_ERROR = "not available (D1/R2 unbound or ETL snapshot missing)";

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

export async function loadDatalakeSnapshotFromR2(): Promise<DatalakeDashboardPayload | null> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;
  const object = await bucket.get(SNAPSHOT_KEY);
  if (!object) return null;
  const parsed = JSON.parse(await object.text()) as DatalakeDashboardPayload;
  if (!parsed?.sections || !Array.isArray(parsed.sections)) return null;
  return {
    generated_at: parsed.generated_at || new Date().toISOString(),
    cache: "cloudflare",
    sections: parsed.sections.filter((s) => !D1_SECTIONS.has(s.section)),
  };
}

function sectionUsable(section: DatalakeSectionResult | undefined): boolean {
  return Boolean(
    section &&
    !section.error &&
    Array.isArray(section.rows) &&
    (section.rowCount ?? section.rows.length) >= 0
  );
}

function d1SectionError(section: string, error: unknown): DatalakeSectionResult {
  return {
    section,
    error: error instanceof Error ? error.message.slice(0, 300) : String(error),
  };
}

export async function getDatalakeDashboard(options: {
  refresh?: boolean;
}): Promise<DatalakeDashboardPayload> {
  const refresh = options.refresh === true;
  const collected: DatalakeSectionResult[] = [];

  const db = getAuthDbFromEnv();
  if (db) {
    try {
      collected.push(await acquisitionFromD1(db));
    } catch (error) {
      collected.push(d1SectionError("acquisition_funnel", error));
    }
    try {
      collected.push(await attributionFromD1(db));
    } catch (error) {
      collected.push(d1SectionError("attribution", error));
    }
  }

  if (!refresh) {
    try {
      const snap = await loadDatalakeSnapshotFromR2();
      if (snap) collected.push(...snap.sections);
    } catch (error) {
      console.warn(
        "[datalake-r2] snapshot read failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const byName = new Map(collected.map((s) => [s.section, s]));
  const sections = SECTION_ORDER.map((section) => {
    const existing = byName.get(section);
    if (sectionUsable(existing)) return existing!;
    if (existing?.error) return existing;
    return { section, error: MISSING_ERROR };
  });

  return {
    generated_at: new Date().toISOString(),
    cache: "cloudflare",
    sections,
  };
}
