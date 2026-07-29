/**
 * Admin datalake dashboard reads — Cloudflare-first.
 *
 * Prefer R2 snapshot `lake/snapshots/admin-datalake.json` (written by
 * scripts/etl/materialize-datalake-snapshots.mjs). Acquisition/attribution
 * prefer live D1 `analytics_events` when AUTH_DB is bound. Athena remains
 * a legacy per-section fallback.
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
    cache: parsed.cache || "r2-snapshot",
    sections: parsed.sections,
  };
}

async function athenaSection(
  section: string,
  sql: string,
  skipCache: boolean
): Promise<DatalakeSectionResult> {
  const { runAthenaQuery } = await import("@/lib/athena");
  const result = await runAthenaQuery(sql, { skipCache });
  return { section, ...result };
}

const ATHENA_QUERIES: Array<{ section: string; sql: string }> = [
  {
    section: "acquisition_funnel",
    sql: "SELECT * FROM cloudless_analytics.v_acquisition_funnel WHERE day >= current_date - interval '30' day ORDER BY day DESC",
  },
  {
    section: "attribution",
    sql: "SELECT * FROM cloudless_analytics.v_attribution_by_source LIMIT 25",
  },
  {
    section: "top_keywords",
    sql: "SELECT * FROM cloudless_analytics.v_gsc_top_keywords LIMIT 25",
  },
  {
    section: "linkedin_ads",
    sql: "SELECT * FROM cloudless_analytics.v_linkedin_ads_summary",
  },
  {
    section: "top_errors",
    sql: "SELECT * FROM cloudless_analytics.v_sentry_top_issues LIMIT 10",
  },
  {
    section: "espocrm_funnel",
    sql: "SELECT * FROM cloudless_analytics.v_espocrm_funnel LIMIT 20",
  },
];

function sectionUsable(section: DatalakeSectionResult | undefined): boolean {
  return Boolean(
    section && !section.error && Array.isArray(section.rows) && (section.rowCount ?? section.rows.length) >= 0
  );
}

function mergeSections(
  preferred: DatalakeSectionResult[],
  fallback: DatalakeSectionResult[]
): DatalakeSectionResult[] {
  const byName = new Map(fallback.map((s) => [s.section, s]));
  for (const section of preferred) {
    const hasRows = Array.isArray(section.rows);
    const usable = !section.error && hasRows;
    if (usable) byName.set(section.section, section);
    else if (!byName.has(section.section)) byName.set(section.section, section);
  }
  return SECTION_ORDER.map((section) => byName.get(section) ?? { section, error: "missing" });
}

export async function getDatalakeDashboard(options: {
  refresh?: boolean;
}): Promise<DatalakeDashboardPayload> {
  const refresh = options.refresh === true;
  const preferred: DatalakeSectionResult[] = [];

  const db = getAuthDbFromEnv();
  if (db) {
    try {
      preferred.push(await acquisitionFromD1(db));
    } catch (error) {
      preferred.push({
        section: "acquisition_funnel",
        error: error instanceof Error ? error.message.slice(0, 300) : String(error),
      });
    }
    try {
      preferred.push(await attributionFromD1(db));
    } catch (error) {
      preferred.push({
        section: "attribution",
        error: error instanceof Error ? error.message.slice(0, 300) : String(error),
      });
    }
  }

  if (!refresh) {
    try {
      const snap = await loadDatalakeSnapshotFromR2();
      if (snap) preferred.push(...snap.sections);
    } catch (error) {
      console.warn(
        "[datalake-r2] snapshot read failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const hasAllUsable = SECTION_ORDER.every((section) =>
    sectionUsable(preferred.find((s) => s.section === section))
  );

  if (hasAllUsable) {
    return {
      generated_at: new Date().toISOString(),
      cache: refresh ? "skipped" : "cloudflare",
      sections: mergeSections(preferred, []),
    };
  }

  if (refresh) {
    try {
      const { resetAthenaCache } = await import("@/lib/athena");
      resetAthenaCache();
    } catch {
      /* Athena optional */
    }
  }

  const settled = await Promise.allSettled(
    ATHENA_QUERIES.map(({ section, sql }) => athenaSection(section, sql, refresh))
  );
  const athenaSections: DatalakeSectionResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const err = s.reason instanceof Error ? s.reason.message : String(s.reason);
    return { section: ATHENA_QUERIES[i].section, error: err.slice(0, 300) };
  });

  return {
    generated_at: new Date().toISOString(),
    cache: refresh ? "skipped" : preferred.length ? "cloudflare+athena" : "athena",
    sections: mergeSections(preferred, athenaSections),
  };
}
