"use client";

/**
 * /admin/analytics/explore — DuckDB-Wasm over catalog-allowlisted R2 parquet.
 */
import { useState, useSyncExternalStore, useTransition, useEffect, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { LAKE_PARQUET_CATALOG, queryLakeParquet, isDuckDBAvailable } from "@/lib/analytics-client";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

const DEFAULT_SQL = "SELECT * FROM lake LIMIT 50";

const QUICK_QUERIES: { label: string; dataset: string; sql: string }[] = [
  {
    label: "Top 20 keywords by clicks",
    dataset: "gsc",
    sql: "SELECT keyword, clicks, impressions, ROUND(ctr*100,1) AS ctr_pct, ROUND(position,1) AS avg_pos FROM lake ORDER BY clicks DESC LIMIT 20",
  },
  {
    label: "Revenue by month",
    dataset: "stripe",
    sql: "SELECT strftime('%Y-%m', created) AS month, COUNT(*) AS txn_count, ROUND(SUM(amount)/100.0,2) AS revenue_eur FROM lake WHERE status='succeeded' GROUP BY 1 ORDER BY 1 DESC LIMIT 12",
  },
  {
    label: "Leads by source",
    dataset: "espocrm-contacts",
    sql: "SELECT leadSource, COUNT(*) AS count FROM lake WHERE leadSource IS NOT NULL GROUP BY leadSource ORDER BY count DESC",
  },
  {
    label: "Churn risk distribution",
    dataset: "churn",
    sql: "SELECT CASE WHEN churn_probability>=0.7 THEN 'High' WHEN churn_probability>=0.4 THEN 'Medium' ELSE 'Low' END AS risk, COUNT(*) AS contacts FROM lake GROUP BY 1 ORDER BY churn_probability DESC",
  },
  {
    label: "RFM champions",
    dataset: "rfm",
    sql: "SELECT email, rfm_segment, recency_days, frequency, monetary_eur FROM lake WHERE rfm_segment IN ('Champions','Loyal') ORDER BY monetary_eur DESC LIMIT 25",
  },
  {
    label: "Open pipeline deals",
    dataset: "espocrm-opps",
    sql: "SELECT name, stage, ROUND(amount,2) AS value_eur, closeDate FROM lake WHERE stage NOT IN ('Closed Won','Closed Lost') ORDER BY amount DESC LIMIT 30",
  },
  {
    label: "Top GSC countries",
    dataset: "gsc-countries",
    sql: "SELECT country, clicks, impressions FROM lake ORDER BY clicks DESC LIMIT 20",
  },
  {
    label: "Recent Sentry errors",
    dataset: "sentry",
    sql: "SELECT title, level, count, firstSeen FROM lake WHERE level IN ('error','fatal') ORDER BY count DESC LIMIT 20",
  },
];

function subscribeNoop() {
  return () => {};
}

const QUICK_QUERY_MAP: Record<string, { dataset: string; sql: string }> = Object.fromEntries(
  QUICK_QUERIES.map((q) => [q.label.toLowerCase().replace(/\s+/g, "-"), q])
);

export default function LakeExplorePage() {
  const searchParams = useSearchParams();
  const [catalogId, setCatalogId] = useState<string>(LAKE_PARQUET_CATALOG[0]?.id ?? "gsc");
  const [sql, setSql] = useState(DEFAULT_SQL);

  useEffect(() => {
    const dataset = searchParams.get("dataset");
    const qKey = searchParams.get("q");
    if (dataset) setCatalogId(dataset);
    if (qKey) {
      const match = QUICK_QUERIES.find(
        (q) => q.dataset === (dataset ?? catalogId) && q.label.toLowerCase().replace(/\s+/g, "-").includes(qKey)
      ) ?? QUICK_QUERY_MAP[qKey];
      if (match) { setCatalogId(match.dataset); setSql(match.sql); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const duckOk = useSyncExternalStore(subscribeNoop, isDuckDBAvailable, () => false);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const data = await queryLakeParquet(catalogId, sql);
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Query failed");
        setRows([]);
      }
    });
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/analytics/datalake"
          className="font-mono text-xs text-slate-500 hover:text-slate-300"
        >
          ← Datalake
        </Link>
      </div>

      <div className="mb-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">LAKE EXPLORE · DUCKDB-WASM</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Explore bronze parquet</h1>
        <p className="mt-2 max-w-2xl font-mono text-xs text-slate-500">
          Catalog-allowlisted R2 objects only. Prefer gold snapshots on the datalake dashboard for
          production panels. This DuckDB-Wasm explorer is the operator SQL path today — Cloudflare{" "}
          <a
            href="https://developers.cloudflare.com/r2-data-catalog/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan hover:underline"
          >
            R2 Data Catalog
          </a>{" "}
          /{" "}
          <a
            href="https://developers.cloudflare.com/r2-sql/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan hover:underline"
          >
            R2 SQL
          </a>{" "}
          remains optional platform enablement (Iceberg), not required for admin dashboards.
        </p>
      </div>

      {!duckOk && <ErrorMsg msg="DuckDB-Wasm needs a modern browser with WebAssembly Workers." />}

      {/* Quick Queries */}
      <div className="mb-4">
        <label className="mb-1 block font-mono text-xs text-slate-500">Quick queries</label>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => { setCatalogId(q.dataset); setSql(q.sql); }}
              className="border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan/80 hover:bg-neon-cyan/15 rounded-full border px-3 py-1 font-mono text-[10px] transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-mono text-xs text-slate-400">
          Dataset
          <select
            className="bg-void-light min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-white"
            value={catalogId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setCatalogId(event.target.value)}
          >
            {LAKE_PARQUET_CATALOG.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending || !duckOk}
          className="border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 min-h-11 rounded-lg border px-4 font-mono text-xs disabled:opacity-40"
        >
          {pending ? "Running…" : "Run"}
        </button>
      </div>

      <textarea
        className="bg-void-light/80 mb-4 min-h-30 w-full rounded-lg border border-slate-800 p-3 font-mono text-xs text-slate-200"
        value={sql}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSql(event.target.value)}
        spellCheck={false}
      />

      {pending && <Spinner color="border-neon-cyan" />}
      {error && <ErrorMsg msg={error} />}

      {!pending && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-160 border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-void-light/50 border-b border-slate-800 text-left text-slate-500">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-normal">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-900/80 text-slate-300">
                  {columns.map((column) => (
                    <td key={column} className="max-w-60 truncate px-3 py-2">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!pending && !error && rows.length === 0 && (
        <p className="font-mono text-xs text-slate-600">No rows — pick a dataset and Run.</p>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
