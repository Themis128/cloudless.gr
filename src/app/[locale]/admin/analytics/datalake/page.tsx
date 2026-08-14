/**
 * Admin → Analytics → Datalake
 *
 * Snapshot-first gold serving: R2 `admin-datalake.json` from
 * materialize-datalake-snapshots, plus D1 hot overlay for acquisition /
 * attribution. Never calls live Stripe / GSC / Sentry / Espo / Postiz / n8n.
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
  cache: string;
  source?: "gold" | "hot_only" | "empty";
  sections: SectionResult[];
  freshness?: {
    generated_at?: string;
    sources?: Record<
      string,
      { exists?: boolean; last_etl_at?: string | null; size?: number | null }
    >;
  };
}

const SECTION_META: Record<
  string,
  {
    title: string;
    subtitle: string;
    columns: { key: string; label: string; format?: "int" | "money" | "pct" | "decimal" }[];
  }
> = {
  acquisition_funnel: {
    title: "Acquisition funnel — last 30 days",
    subtitle: "Hot path: D1 analytics_events (live product events).",
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
    subtitle: "Hot path: D1 analytics_events (90-day window).",
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
    subtitle: "Gold: R2 snapshot from gsc-to-r2 parquet.",
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
    subtitle: "Gold: R2 snapshot from linkedin-ads-to-r2 parquet.",
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
    subtitle: "Gold: R2 snapshot from sentry-to-r2 parquet.",
    columns: [
      { key: "short_id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "level", label: "Level" },
      { key: "count_14d", label: "Count 14d", format: "int" },
      { key: "user_count", label: "Users", format: "int" },
      { key: "last_seen", label: "Last seen" },
    ],
  },
  espocrm_funnel: {
    title: "EspoCRM lifecycle funnel",
    subtitle: "Gold: R2 snapshot from espocrm-to-r2 parquet.",
    columns: [
      { key: "lifecycle_stage", label: "Stage" },
      { key: "lead_source", label: "Source" },
      { key: "contact_count", label: "Contacts", format: "int" },
      { key: "closed_won_deals", label: "Won deals", format: "int" },
      { key: "closed_won_revenue", label: "Revenue", format: "money" },
    ],
  },
  stripe_revenue: {
    title: "Stripe revenue (gold)",
    subtitle: "Gold: R2 snapshot from stripe-to-r2 transactions parquet.",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Count", format: "int" },
      { key: "amount_eur", label: "Amount €", format: "money" },
    ],
  },
  n8n_ops: {
    title: "n8n operations",
    subtitle: "Gold: R2 snapshot from n8n-to-r2 parquet.",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value", format: "decimal" },
    ],
  },
  postiz_ops: {
    title: "Postiz operations",
    subtitle: "Gold: R2 snapshot from postiz-to-r2 parquet.",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value", format: "int" },
    ],
  },
  appflowy_activity: {
    title: "AppFlowy activity",
    subtitle: "Gold: R2 snapshot from appflowy-to-r2 parquet.",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value", format: "int" },
    ],
  },
  rfm_churn: {
    title: "RFM / churn scores",
    subtitle: "Gold: R2 snapshot from ml-parquet scores_rfm + scores_churn (email join).",
    columns: [
      { key: "email", label: "Email" },
      { key: "rfm_score", label: "RFM", format: "decimal" },
      { key: "recency_days", label: "Recency", format: "int" },
      { key: "frequency", label: "Freq", format: "int" },
      { key: "monetary", label: "Monetary", format: "money" },
      { key: "churn_score", label: "Churn", format: "decimal" },
      { key: "risk_band", label: "Risk" },
    ],
  },
  freshness: {
    title: "ETL freshness",
    subtitle: "Gold: last_etl_at / size per silver parquet key (from materialize).",
    columns: [
      { key: "source", label: "Source key" },
      { key: "exists", label: "Exists", format: "int" },
      { key: "last_etl_at", label: "Last ETL" },
      { key: "size", label: "Bytes", format: "int" },
    ],
  },
};

function fmt(v: string | number | null, format?: "int" | "money" | "pct" | "decimal"): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) && typeof v === "string") return v;
  if (!Number.isFinite(n)) return String(v);
  if (format === "int") return Math.round(n).toLocaleString();
  if (format === "money") return `€${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (format === "pct") return `${(n * 100).toFixed(2)}%`;
  if (format === "decimal") return n.toFixed(3);
  return String(v);
}

function sourceBadge(source: DatalakeResponse["source"]): string {
  if (source === "gold") return "GOLD SNAPSHOT";
  if (source === "hot_only") return "HOT D1 ONLY";
  return "EMPTY";
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
      if (res.status === 429) {
        throw new Error("Too many admin requests — wait a few seconds and retry.");
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = (await res.json()) as DatalakeResponse;
      setData(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const generatedAt = data
    ? new Date(data.generated_at).toLocaleString(undefined, { timeZone: "Europe/Athens" })
    : "—";

  return (
    <div
      className="space-y-6"
      style={{
        color: "var(--ink-primary)",
      }}
    >
      <header
        className="flex flex-wrap items-end justify-between gap-3 pb-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datalake dashboard</h1>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Gold serving from R2 snapshot (+ D1 hot funnel). Generated at {generatedAt}.
            {data?.source && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 font-mono text-xs"
                style={{ background: "var(--surface-subtle)" }}
              >
                {sourceBadge(data.source)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--surface-raised)",
              color: "var(--ink-primary)",
            }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "var(--accent-on)",
            }}
          >
            Re-read gold snapshot
          </button>
        </div>
      </header>

      {err && (
        <div
          className="rounded-md p-4 text-sm"
          style={{
            border: "1px solid var(--danger)",
            background: "rgb(192 57 43 / 0.08)",
            color: "var(--danger)",
          }}
        >
          <strong>Failed to load:</strong> {err}
        </div>
      )}

      {loading && !data && (
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Loading gold datalake snapshot…
        </div>
      )}

      {data?.sections.map((s) => {
        const meta = SECTION_META[s.section] ?? {
          title: s.section,
          subtitle: "",
          columns: [],
        };
        return (
          <section
            key={s.section}
            className="rounded-lg"
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-raised)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <header
              className="flex items-end justify-between gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div>
                <h2 className="text-base font-semibold">{meta.title}</h2>
                <p className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {meta.subtitle}
                </p>
              </div>
              <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
                {s.error ? "error" : `${s.rowCount ?? s.rows?.length ?? 0} rows`}
                {s.fromCache && !s.error && (
                  <span
                    className="ml-2 rounded px-1.5 py-0.5"
                    style={{ background: "var(--surface-subtle)" }}
                  >
                    gold
                  </span>
                )}
              </div>
            </header>
            <div className="p-2">
              {s.error ? (
                <div
                  className="rounded p-3 text-xs"
                  style={{
                    background: "rgb(181 110 0 / 0.08)",
                    color: "var(--warning)",
                  }}
                >
                  <strong>Section unavailable.</strong> Run the source ETL then{" "}
                  <code>etl-materialize-snapshots</code>. Detail:{" "}
                  <code className="break-all">{s.error}</code>
                </div>
              ) : s.rows && s.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead
                      className="text-left text-xs tracking-wide uppercase"
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        color: "var(--ink-muted)",
                      }}
                    >
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
                          className="last:border-0"
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}
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
                <div className="p-4 text-sm" style={{ color: "var(--ink-muted)" }}>
                  No data yet.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
