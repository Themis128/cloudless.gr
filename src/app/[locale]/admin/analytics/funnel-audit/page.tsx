"use client";

/**
 * Sales-funnel audit — Tolstova stage counts (audience → engaged → lead →
 * nurtured → opportunity → won) computed live from EspoCRM + SocialAuto.
 * Data: GET /api/admin/analytics/funnel-audit.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

interface FunnelStage {
  stage: string;
  count: number | null;
  proxy?: boolean;
  note?: string;
  conv_pct?: number | null;
}

interface FunnelAuditReport {
  generated_at: string;
  sources: { espocrm: boolean; socialauto: boolean };
  stages: FunnelStage[];
  weakest_transition: string | null;
  auction_warning: boolean;
  lead_sources: Record<string, number>;
  socialauto_funnel: {
    lead_tiers: Record<string, number>;
    conversions: { campaign: string; count: number; value: number }[];
    total_conversions: number;
    total_value: number;
  } | null;
}

function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

export default function FunnelAuditPage() {
  const [data, setData] = useState<FunnelAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/funnel-audit");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as FunnelAuditReport);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load funnel audit",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) load().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const weakest = data?.stages.find((s) =>
    data.weakest_transition?.includes(`→${s.stage} `),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/analytics"
          className="hover:text-neon-cyan font-mono text-xs text-slate-500 transition-colors"
        >
          ← Analytics
        </Link>
        <h1 className="font-heading mt-3 text-2xl font-bold text-white">
          Funnel audit
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Tolstova stage model — audience → engaged → lead → nurtured →
          opportunity → won. Live counts from EspoCRM + SocialAuto
          {data
            ? ` · generated ${data.generated_at.slice(0, 16).replace("T", " ")}Z`
            : ""}
          .
        </p>
      </div>

      {data && (!data.sources.espocrm || !data.sources.socialauto) ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-xs text-amber-300">
          {!data.sources.espocrm
            ? "EspoCRM unreachable — CRM stages unavailable. "
            : ""}
          {!data.sources.socialauto
            ? "SocialAuto unreachable (stack asleep?) — audience/engaged unavailable."
            : ""}
        </div>
      ) : null}

      {data?.auction_warning ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
          ⚠ Auction warning: follower reach grew over 30d while lead conversion
          vs audience is &lt;0.5% — more traffic raises cost-per-lead before it
          raises revenue (Tolstova &amp; Silakova). Fix conversion before buying
          traffic.
        </div>
      ) : null}

      {loading ? <Spinner /> : null}
      {error ? <ErrorMsg msg={error} /> : null}

      {data ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-void-light font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Count</th>
                  <th className="px-4 py-3 text-right">Stage→stage</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.stages.map((s) => (
                  <tr
                    key={s.stage}
                    className={`border-t border-slate-800/80 ${
                      weakest?.stage === s.stage ? "bg-neon-magenta/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      <span
                        className={
                          s.proxy ? "text-slate-400" : "text-neon-cyan"
                        }
                      >
                        {s.stage}
                      </span>
                      {s.proxy ? (
                        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 uppercase">
                          proxy
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-white">
                      {fmt(s.count)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-white">
                      {s.conv_pct === null || s.conv_pct === undefined
                        ? "—"
                        : s.proxy
                          ? `${s.conv_pct}% (proxy)`
                          : `${s.conv_pct}%`}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                      {s.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.weakest_transition ? (
            <p className="font-mono text-xs text-slate-400">
              Weakest transition:{" "}
              <span className="text-neon-magenta">
                {data.weakest_transition}
              </span>{" "}
              — the stage to fix first.
            </p>
          ) : null}

          {Object.keys(data.lead_sources).length > 0 ? (
            <div className="rounded-xl border border-slate-800 p-4">
              <h2 className="font-heading text-sm font-semibold text-white">
                Lead sources
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(data.lead_sources)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, n]) => (
                    <span
                      key={src}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 font-mono text-xs text-slate-300"
                    >
                      {src}: <span className="text-white">{n}</span>
                    </span>
                  ))}
              </div>
            </div>
          ) : null}

          {data.socialauto_funnel ? (
            <div className="rounded-xl border border-slate-800 p-4">
              <h2 className="font-heading text-sm font-semibold text-white">
                SocialAuto funnel state
              </h2>
              <p className="font-mono mt-1 text-xs text-slate-400">
                {data.socialauto_funnel.total_conversions} conversions · €
                {data.socialauto_funnel.total_value.toLocaleString()}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(data.socialauto_funnel.lead_tiers).map(
                  ([tier, n]) => (
                    <span
                      key={tier}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 font-mono text-xs text-slate-300"
                    >
                      {tier}: <span className="text-white">{n}</span>
                    </span>
                  ),
                )}
              </div>
              {data.socialauto_funnel.conversions.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                      <tr>
                        <th className="py-1 pr-4">Campaign</th>
                        <th className="py-1 pr-4 text-right">Conversions</th>
                        <th className="py-1 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.socialauto_funnel.conversions
                        .slice(0, 10)
                        .map((c) => (
                          <tr
                            key={c.campaign}
                            className="border-t border-slate-800/60"
                          >
                            <td className="py-1.5 pr-4 font-mono text-xs text-slate-300">
                              {c.campaign}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-mono text-xs text-white">
                              {c.count}
                            </td>
                            <td className="py-1.5 text-right font-mono text-xs text-white">
                              €{c.value.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
