"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

type EngineResponse = {
  configured?: boolean;
  sql?: string;
  rows?: Record<string, unknown>[];
  count?: number;
  error?: string;
  fetchedAt?: string;
};

export default function AnalyticsEngineExplorerPage() {
  const [data, setData] = useState<EngineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/engine");
      const json = (await res.json()) as EngineResponse;
      if (res.status === 503) {
        setError(json.error ?? "Analytics Engine not configured");
        setData(json);
        return;
      }
      if (!res.ok && !json.rows) {
        setError(json.error ?? `HTTP ${res.status}`);
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const rows = data?.rows ?? [];
  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-white">Analytics Engine</h1>
          <p className="mt-1 text-sm text-slate-400">
            Edge latency samples from Cloudflare Analytics Engine (free tier).
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-neon-cyan/40 px-4 py-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/10"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="font-mono text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="font-mono text-sm text-neon-magenta">{error}</p> : null}

      {data?.sql ? (
        <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-void-light/50 p-3 font-mono text-[11px] text-slate-400">
          {data.sql}
        </pre>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left font-mono text-xs text-slate-300">
            <thead className="bg-void-lighter/80 text-slate-500">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-800/80">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap">
                      {String(row[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error ? (
        <p className="text-sm text-slate-500">No rows yet — write beacons from cloudless2 or app.</p>
      ) : null}

      {data?.fetchedAt ? (
        <p className="font-mono text-[10px] text-slate-600">Fetched {data.fetchedAt}</p>
      ) : null}
    </div>
  );
}
