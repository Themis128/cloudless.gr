"use client";

/**
 * /admin/cost — AWS cost dashboard (Cloudflare read path).
 *
 * Storage/query: D1 `aws_cost_daily` and/or R2 `lake/aws-cost/cost.json`.
 * Historical rows came from Cost Explorer ETL (retired — snapshot frozen).
 */
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";
import { AdminDailyBars } from "@/components/admin/AdminDailyBars";

interface CostByServiceRow {
  service: string;
  total_usd: number;
}
interface DailyCostRow {
  cost_date: string;
  total_usd: number;
}
interface CostSummary {
  total_30d: number;
  yesterday: number;
  topServices: CostByServiceRow[];
  dailyTrend: DailyCostRow[];
  lastEtlAt: string | null;
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtAge(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "future";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "<1h";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CostAdminPage() {
  const [data, setData] = useState<CostSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetchWithAuth("/api/admin/cost");
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as CostSummary;
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const maxService = data ? Math.max(...data.topServices.map((s) => s.total_usd), 0.01) : 0;
  const sevenDayAvg = data
    ? data.dailyTrend.slice(-7).reduce((sum, d) => sum + d.total_usd, 0) /
      Math.max(data.dailyTrend.slice(-7).length, 1)
    : 0;
  const yesterdayDeltaPct =
    data && sevenDayAvg > 0 ? Math.round(((data.yesterday - sevenDayAvg) / sevenDayAvg) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          ← Admin
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-mono text-xs text-amber-400">AWS COST · FROZEN SNAPSHOT</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">AWS cost dashboard</h1>
        <p className="mt-2 font-mono text-xs text-slate-500">
          Read from D1 <code className="text-slate-400">aws_cost_daily</code> / R2{" "}
          <code className="text-slate-400">lake/aws-cost/cost.json</code>. Cost Explorer ETL is
          retired — this is the last imported snapshot.
          {data && (
            <>
              {" "}
              Data updated <span className="text-slate-300">{fmtAge(data.lastEtlAt)}</span>.
            </>
          )}
        </p>
      </div>

      {loading && <Spinner color="border-emerald-400" />}
      {error && <ErrorMsg msg={error} />}

      {notConfigured && (
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            No cost snapshot in D1 or R2. Historical Cost Explorer imports are missing or never ran.
            New AWS billing pulls are disabled after the Cloudflare analytics cutover.
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="font-mono text-[10px] text-slate-500">30-DAY TOTAL</div>
              <div className="font-heading mt-1 text-3xl font-bold text-white">
                {fmtUsd(data.total_30d)}
              </div>
              <div className="mt-2 font-mono text-[10px] text-slate-500">
                Avg/day: <span className="text-slate-300">{fmtUsd(data.total_30d / 30)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="font-mono text-[10px] text-slate-500">YESTERDAY</div>
              <div className="font-heading mt-1 text-3xl font-bold text-white">
                {fmtUsd(data.yesterday)}
              </div>
              <div
                className={`mt-2 font-mono text-[10px] ${
                  yesterdayDeltaPct > 25
                    ? "text-red-400"
                    : yesterdayDeltaPct > 10
                      ? "text-yellow-400"
                      : "text-slate-500"
                }`}
              >
                vs 7-day avg ({fmtUsd(sevenDayAvg)}):{" "}
                <span className={yesterdayDeltaPct >= 0 ? "" : "text-emerald-400"}>
                  {yesterdayDeltaPct >= 0 ? "+" : ""}
                  {yesterdayDeltaPct}%
                </span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <AdminDailyBars
              title="Daily spend (last 30 days)"
              unitLabel="USD"
              points={data.dailyTrend.map((d) => ({ day: d.cost_date, value: d.total_usd }))}
              formatValue={fmtUsd}
              barClassName="bg-emerald-500/60 hover:bg-emerald-500/90"
            />
          </div>

          {/* Top services bar chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="mb-4 font-mono text-sm text-white">Top services (30 days)</div>
            <div className="space-y-2">
              {data.topServices.map((s) => {
                const widthPct = Math.max((s.total_usd / maxService) * 100, 1);
                return (
                  <div key={s.service} className="flex items-center gap-3">
                    <div
                      className="truncate font-mono text-xs text-slate-300"
                      style={{ width: "12rem" }}
                      title={s.service}
                    >
                      {s.service}
                    </div>
                    <div className="relative h-5 flex-1 rounded bg-slate-800/40">
                      <div
                        className="h-full rounded bg-emerald-500/70 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div
                      className="font-mono text-xs text-slate-300"
                      style={{ width: "5rem", textAlign: "right" }}
                    >
                      {fmtUsd(s.total_usd)}
                    </div>
                  </div>
                );
              })}
              {data.topServices.length === 0 && (
                <p className="font-mono text-xs text-slate-500">
                  No spend recorded in last 30 days.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
