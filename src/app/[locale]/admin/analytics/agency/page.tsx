/**
 * Admin - Agency ops board
 *
 * Server-rendered view of the SocialAuto agency metrics endpoint
 * (/api/v1/agency/metrics): token cost per delivery, task success rate,
 * parallelism, audit lead vector and human-intervention count for the
 * 6-20 client board.
 *
 * @module admin/analytics/agency
 */
import { saFetch, SocialAutoNotConfiguredError } from "@/lib/socialauto";

export const revalidate = 300;

interface AgencyMetrics {
  tcd_eur?: number | string;
  tsr_pct?: number | string;
  ppl_active?: number | string;
  alv_minutes?: number | string;
  hipc_weekly?: number | string;
  period?: string;
}

async function getMetrics(): Promise<AgencyMetrics | null> {
  try {
    const res = await saFetch("/agency/metrics");
    if (!res.ok) return null;
    return (await res.json()) as AgencyMetrics;
  } catch (err) {
    if (err instanceof SocialAutoNotConfiguredError) return null;
    return null;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export default async function AgencyAnalyticsPage() {
  const m = await getMetrics();
  const v = (x: number | string | undefined, suffix = "") =>
    x === undefined || x === null ? "—" : `${x}${suffix}`;
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Agent Operations — 6-20 Client Board</h1>
      {m === null && (
        <p className="text-sm text-slate-400">
          SocialAuto metrics unavailable — check SOCIALAUTO_* config or the
          /api/v1/agency/metrics endpoint.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Stat label="Token Cost per Delivery (TCD)" value={m?.tcd_eur == null ? "—" : `€${m.tcd_eur}`} />
        <Stat label="Task Success Rate (TSR)" value={v(m?.tsr_pct, "%")} />
        <Stat label="Parallel Tasks (PPL)" value={v(m?.ppl_active)} />
        <Stat label="Audit Lead Vector" value={v(m?.alv_minutes, " min")} />
        <Stat label="Human Interventions/wk" value={v(m?.hipc_weekly)} />
        <Stat label="Period" value={v(m?.period)} />
      </div>
      <p className="text-sm text-slate-400">Targets: TCD&lt;€45 · TSR&gt;98% · HIPC&lt;1/wk</p>
    </main>
  );
}
