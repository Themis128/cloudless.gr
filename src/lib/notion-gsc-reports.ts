/**
 * Notion read access for the weekly GSC archive.
 *
 * `scripts/weekly-gsc-sync.ts` writes one page per week into the
 * NOTION_GSC_REPORTS_DB_ID database (cron: Mondays 07:00, see
 * .github/workflows/weekly-gsc-sync.yml). This module is the *read* side —
 * it surfaces that persisted archive in the admin UI. It is distinct from the
 * live `/api/admin/analytics/history` route, which queries the GSC API fresh
 * each request: the archive is durable (survives GSC quota/credential gaps)
 * and carries the curated fields the sync computed (CTR-opportunity counts,
 * top country, mobile share, top-keyword breakdown).
 *
 * Expected Notion database schema (NOTION_GSC_REPORTS_DB_ID):
 * ┌────────────────────┬─────────────────────────────────────────────────────┐
 * │ Week               │ Title       "Week of YYYY-MM-DD"                     │
 * │ Date               │ Date        End date of the 28-day window            │
 * │ Clicks             │ Number                                               │
 * │ Impressions        │ Number                                               │
 * │ CTR %              │ Number      Whole percent (e.g. 3.5)                 │
 * │ Avg Position       │ Number                                               │
 * │ Keywords           │ Number      Count of organic keywords w/ impressions │
 * │ Top Keywords       │ Rich text   JSON [{ q, clicks, ctr }]                │
 * │ Top Country        │ Rich text   ISO country with most clicks            │
 * │ Mobile %           │ Number      Share of clicks from mobile             │
 * │ CTR Opportunities  │ Number      Queries with impressions>=20 & ctr<2%   │
 * └────────────────────┴─────────────────────────────────────────────────────┘
 */

import { notionFetch } from "@/lib/notion";
import { IntegrationNotConfiguredError, requireIntegrationAsync } from "@/lib/integrations";

export interface GscTopKeyword {
  q: string;
  clicks: number;
  ctr: number;
}

export interface GscWeeklyReport {
  /** Notion page id — stable key for the row. */
  id: string;
  /** Title, e.g. "Week of 2026-06-08". */
  week: string;
  /** End date of the 28-day window (ISO date). */
  date: string;
  clicks: number;
  impressions: number;
  ctrPct: number;
  avgPosition: number;
  keywords: number;
  topKeywords: GscTopKeyword[];
  topCountry: string;
  mobilePct: number;
  ctrOpportunities: number;
}

async function getDb(): Promise<{ apiKey: string; dbId: string }> {
  // An explicitly-cleared env var means "disabled" — don't let SSM re-enable it.
  if (process.env.NOTION_API_KEY === "" || process.env.NOTION_GSC_REPORTS_DB_ID === "") {
    throw new IntegrationNotConfiguredError(["NOTION_API_KEY", "NOTION_GSC_REPORTS_DB_ID"]);
  }
  const cfg = await requireIntegrationAsync("NOTION_API_KEY", "NOTION_GSC_REPORTS_DB_ID");
  return { apiKey: cfg.NOTION_API_KEY!, dbId: cfg.NOTION_GSC_REPORTS_DB_ID! };
}

function pageToReport(page: Record<string, unknown>): GscWeeklyReport | null {
  try {
    const p = (page as { properties: Record<string, unknown> }).properties ?? {};

    function num(key: string): number {
      const prop = p[key] as { number?: number | null } | undefined;
      return prop?.number ?? 0;
    }

    function richText(key: string): string {
      const prop = p[key] as { rich_text?: { plain_text?: string }[] } | undefined;
      return prop?.rich_text?.map((r) => r.plain_text ?? "").join("") ?? "";
    }

    function title(key: string): string {
      const prop = p[key] as { title?: { plain_text?: string }[] } | undefined;
      return prop?.title?.map((r) => r.plain_text ?? "").join("") ?? "";
    }

    function dateField(key: string): string {
      const prop = p[key] as { date?: { start?: string } } | undefined;
      return prop?.date?.start ?? "";
    }

    let topKeywords: GscTopKeyword[] = [];
    try {
      const parsed = JSON.parse(richText("Top Keywords") || "[]");
      if (Array.isArray(parsed)) topKeywords = parsed as GscTopKeyword[];
    } catch {
      /* malformed JSON → empty list */
    }

    return {
      id: (page as { id: string }).id,
      week: title("Week"),
      date: dateField("Date"),
      clicks: num("Clicks"),
      impressions: num("Impressions"),
      ctrPct: num("CTR %"),
      avgPosition: num("Avg Position"),
      keywords: num("Keywords"),
      topKeywords,
      topCountry: richText("Top Country"),
      mobilePct: num("Mobile %"),
      ctrOpportunities: num("CTR Opportunities"),
    };
  } catch {
    return null;
  }
}

/**
 * Return the persisted weekly GSC snapshots, newest first.
 * Throws IntegrationNotConfiguredError when Notion/the DB id is not configured;
 * returns null on a Notion API error so callers can fall back gracefully.
 */
export async function getGscReports(limit = 26): Promise<GscWeeklyReport[] | null> {
  const db = await getDb();

  try {
    const res = await notionFetch<{ results: unknown[] }>(`/databases/${db.dbId}/query`, {
      method: "POST",
      body: JSON.stringify({
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: Math.max(1, Math.min(limit, 100)),
      }),
    });

    return res.results
      .map((p) => pageToReport(p as Record<string, unknown>))
      .filter((r): r is GscWeeklyReport => r !== null);
  } catch {
    return null;
  }
}
