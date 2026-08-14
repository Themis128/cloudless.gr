"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

interface AnomalyRow {
  id: string;
  firedAt: string;
  campaignSlug: string;
  platform: string;
  rule: string;
  severity: string;
  message: string;
  source: "log" | "bookmark";
}

function formatAthens(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Athens",
  });
}

export default function AdminAnomalyHistoryPage() {
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/admin/ad-analytics/anomalies?limit=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          anomalies: AnomalyRow[];
          fetchedAt?: string;
        };
        if (!cancelled) {
          setRows(json.anomalies ?? []);
          setFetchedAt(json.fetchedAt ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/campaigns"
          className="font-mono text-xs text-slate-500 hover:text-slate-300"
        >
          ← Campaigns
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="font-mono text-xs text-amber-300">AD ANOMALIES</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Anomaly history</h1>
        <p className="font-body mt-1 text-slate-400">
          Rules that already fired to Slack. Thresholds stay in code — no alerting config here.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="bg-void-light/30 h-40 animate-pulse rounded-xl border border-slate-800" />
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 font-mono text-xs text-slate-500">
          No anomaly events yet. They appear after the 15-min ad poll posts a Slack alert (or from
          existing dedup bookmarks).
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">When</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Campaign</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Platform</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Rule</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Severity</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-400">
                    {formatAthens(r.firedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white">{r.campaignSlug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.platform}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.rule}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className={r.severity === "critical" ? "text-red-400" : "text-amber-300"}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 font-mono text-xs text-slate-400">
                    {r.message}
                    {r.source === "bookmark" && (
                      <span className="ml-2 text-slate-600">(bookmark)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fetchedAt && (
        <p className="mt-6 font-mono text-xs text-slate-600">
          Last fetched:{" "}
          {new Date(fetchedAt).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Europe/Athens",
          })}
        </p>
      )}
    </div>
  );
}
