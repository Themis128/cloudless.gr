"use client";

/**
 * Thin operator view for GET /api/admin/analytics/search-funnel.
 * Flat event×variant table + side-by-side A/B comparison (not flag toggles).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  buildFunnelAbCompare,
  formatFunnelRate,
  type FunnelAbCompare,
} from "@/lib/funnel-ab-compare";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

interface FunnelRow {
  event_type: string;
  count: number;
  ab_variant: string | null;
}

interface FunnelResponse {
  configured: boolean;
  days: number;
  rows: FunnelRow[];
  message?: string;
}

function VariantCompareTables({ compare }: { compare: FunnelAbCompare }) {
  if (compare.variants.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-white">A/B variant comparison</h2>
        <p className="font-body mt-1 text-sm text-slate-400">
          Side-by-side counts and conversion rates from the same D1 window. Flag toggles stay on{" "}
          <Link href="/admin/ab-tests" className="text-neon-cyan hover:underline">
            A/B Tests
          </Link>
          .
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-void-light font-mono text-[10px] tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Event</th>
              {compare.variants.map((v) => (
                <th key={v} className="px-4 py-3 text-right">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compare.eventTypes.map((event) => (
              <tr key={event} className="border-t border-slate-800/80">
                <td className="text-neon-cyan px-4 py-2 font-mono text-xs">{event}</td>
                {compare.variants.map((v) => (
                  <td key={v} className="px-4 py-2 text-right font-mono text-xs text-white">
                    {(compare.counts[event]?.[v] ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compare.rates.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-void-light font-mono text-[10px] tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Conversion</th>
                {compare.variants.map((v) => (
                  <th key={v} className="px-4 py-3 text-right">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rates.map((rate) => (
                <tr key={`${rate.from}->${rate.to}`} className="border-t border-slate-800/80">
                  <td className="px-4 py-2 font-mono text-xs text-slate-300">{rate.label}</td>
                  {compare.variants.map((v) => (
                    <td key={v} className="px-4 py-2 text-right font-mono text-xs text-white">
                      {formatFunnelRate(rate.byVariant[v] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchFunnelPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/analytics/search-funnel?days=${windowDays}`);
      if (res.status === 503) {
        const body = (await res.json()) as FunnelResponse;
        setData(body);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as FunnelResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load funnel");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) load(days).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [days, load]);

  const compare =
    data?.configured && data.rows.length > 0 ? buildFunnelAbCompare(data.rows) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/analytics"
          className="hover:text-neon-cyan font-mono text-xs text-slate-500 transition-colors"
        >
          ← Analytics
        </Link>
        <h1 className="font-heading mt-3 text-2xl font-bold text-white">Search funnel</h1>
        <p className="font-body mt-1 text-slate-400">
          D1 <code className="font-mono text-xs text-slate-300">search_funnel_events</code> counts
          by event type and A/B variant. Last {days} days.
        </p>
      </div>

      <div className="flex gap-2">
        {[7, 30, 90].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDays(n)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${
              days === n
                ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                : "border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {n}d
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorMsg msg={error} /> : null}
      {data && !data.configured ? (
        <p className="font-mono text-xs text-slate-500">
          {data.message || "D1 AUTH_DB not bound — funnel ingest is off."}
        </p>
      ) : null}

      {data?.configured && compare && compare.variants.length > 1 ? (
        <VariantCompareTables compare={compare} />
      ) : null}

      {data?.configured ? (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-white">Raw event × variant</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-void-light font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">A/B variant</th>
                  <th className="px-4 py-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 font-mono text-xs text-slate-600">
                      No funnel events in this window.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr
                      key={`${row.event_type}|${row.ab_variant ?? ""}`}
                      className="border-t border-slate-800/80"
                    >
                      <td className="text-neon-cyan px-4 py-2 font-mono text-xs">
                        {row.event_type}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-400">
                        {row.ab_variant || "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-white">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
