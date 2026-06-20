/**
 * Admin → Analytics → Datalake
 *
 * Single-page dashboard that surfaces every Athena view from the
 * cloudless_analytics catalog in one scrollable view:
 *
 *   - 30-day acquisition funnel (sessions → signups → purchasers → revenue)
 *   - UTM attribution by source/medium/campaign (90d)
 *   - GSC top keywords (90d rolling window)
 *   - LinkedIn ads campaign rollup (90d)
 *   - Sentry top unresolved issues (14d)
 *   - HubSpot lifecycle funnel
 *
 * Fetches all six in parallel from /api/admin/analytics/datalake. Each card
 * renders independently — a section with an error (e.g. ETL hasn't run yet)
 * shows that error inline rather than blanking the whole dashboard.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

type Row = Record<string, string | number | null>;

interface SectionResult {
  section: string;
  rows?: Row[];
  rowCount?: number;
  fromCache?: boolean;
  error?: string;
}

interface DatalakeResponse {
  generated_at: string;
  cache: "respected" | "skipped";
  sections: SectionResult[];
}

const SECTION_META: Record<
  string,
  { title: string; subtitle: string; columns: { key: string; label: string; format?: "int" | "money" | "pct" | "decimal" }[] }
> = {
  acquisition_funnel: {
    title: "Acquisition funnel — last 30 days",
    subtitle: "Sessions → signups → purchasers → revenue. Sourced from v_acquisition_funnel.",
    columns: [
      { key: "day", label: "Day" },
      { key: "sessions", label: "Sessions", format: "int" },
      { key: "signups", label: "Signups", format: "int" },
      { key: "purchasers", label: "Purchasers", format: "int" },
      { key: "revenue", label: "Revenue", format: "money" },
    ],
  },
  attribution: {
    title: "Attribution by UTM source/medium",
    subtitle: "90-day window. Sourced from v_attribution_by_source.",
    columns: [
      { key: "utm_source", label: "Source" },
      { key: "utm_medium", label: "Medium" },
      { key: "utm_campaign", label: "Campaign" },
      { key: "sessions", label: "Sessions", format: "int" },
      { key: "purchases", label: "Purchases", format: "int" },
      { key: "revenue", label: "Revenue", format: "money" },
    ],
  },
  top_keywords: {
    title: "GSC top keywords",
    subtitle: "Top 25 by clicks over the rolling 90-day GSC window. Sourced from v_gsc_top_keywords.",
    columns: [
      { key: "query", label: "Query" },
      { key: "clicks", label: "Clicks", format: "int" },
      { key: "impressions", label: "Impressions", format: "int" },
      { key: "ctr", label: "CTR", format: "pct" },
      { key: "avg_position", label: "Avg pos", format: "decimal" },
    ],
  },
  linkedin_ads: {
    title: "LinkedIn ads — per-campaign 90d",
    subtitle: "Sourced from v_linkedin_ads_summary.",
    columns: [
      { key: "campaign_name", label: "Campaign" },
      { key: "impressions", label: "Impressions", format: "int" },
      { key: "clicks", label: "Clicks", format: "int" },
      { key: "ctr", label: "CTR", format: "pct" },
      { key: "spend", label: "Spend", format: "money" },
      { key: "conversions", label: "Conv", format: "int" },
      { key: "cpc", label: "CPC", format: "money" },
      { key: "cost_per_conversion", label: "CPA", format: "money" },
    ],
  },
  top_errors: {
    title: "Top Sentry errors (14-day count)",
    subtitle: "Top 10 unresolved by event count. Sourced from v_sentry_top_issues.",
    columns: [
      { key: "short_id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "level", label: "Level" },
      { key: "count_14d", label: "Count 14d", format: "int" },
      { key: "user_count", label: "Users", format: "int" },
      { key: "last_seen", label: "Last seen" },
    ],
  },
  hubspot_funnel: {
    title: "HubSpot lifecycle funnel",
    subtitle: "Contact count × closed-won deals + revenue, split by lead_source. Sourced from v_hubspot_funnel.",
    columns: [
      { key: "lifecycle_stage", label: "Stage" },
      { key: "lead_source", label: "Source" },
      { key: "contact_count", label: "Contacts", format: "int" },
      { key: "closed_won_deals", label: "Won deals", format: "int" },
      { key: "closed_won_revenue", label: "Revenue", format: "money" },
    ],
  },
};

function fmt(v: string | number | null, format?: "int" | "money" | "pct" | "decimal"): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (format === "int") return Math.round(n).toLocaleString();
  if (format === "money") return `€${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (format === "pct") return `${(n * 100).toFixed(2)}%`;
  if (format === "decimal") return n.toFixed(1);
  return String(v);
}

export default function DatalakeDashboardPage() {
  const [data, setData] = useState<DatalakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(
        `/api/admin/analytics/datalake${refresh ? "?refresh=1" : ""}`
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = (await res.json()) as DatalakeResponse;
      setData(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Defer the initial fetch one tick past mount so setState fires from a
  // queued task, not synchronously inside the effect body. This pattern is
  // the React 19 `react-hooks/set-state-in-effect` rule's recommended escape
  // hatch for mount-triggered fetches that aren't framework-data-hook-able.
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const generatedAt = data ? new Date(data.generated_at).toLocaleString() : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datalake dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All Athena views in one place. Generated at {generatedAt}.
            {data?.cache === "respected" && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                cached (60s)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Reload
          </button>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            Force refresh (skip cache)
          </button>
        </div>
      </header>

      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>Failed to load:</strong> {err}
        </div>
      )}

      {loading && !data && (
        <div className="text-sm text-slate-500">Querying Athena (first load may take 3-8s)…</div>
      )}

      {/* Sections */}
      {data?.sections.map((s) => {
        const meta = SECTION_META[s.section] ?? {
          title: s.section,
          subtitle: "",
          columns: [],
        };
        return (
          <section
            key={s.section}
            className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="flex items-end justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold">{meta.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
              </div>
              <div className="text-xs text-slate-500">
                {s.error ? "error" : `${s.rowCount ?? 0} rows`}
                {s.fromCache && !s.error && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">cached</span>
                )}
              </div>
            </header>
            <div className="p-2">
              {s.error ? (
                <div className="rounded bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <strong>Athena query failed.</strong> Often means the underlying ETL has not run
                  yet, or the view/table has not been CREATEd. Detail: <code className="break-all">{s.error}</code>
                </div>
              ) : s.rows && s.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                      <tr>
                        {meta.columns.map((c) => (
                          <th key={c.key} className="px-3 py-2 font-medium">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                        >
                          {meta.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2 tabular-nums">
                              {fmt(row[c.key], c.format)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-sm text-slate-500">No data yet.</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
