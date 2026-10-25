// Agent operational control board — 6-20 client metrics.
// Server-fetches the SocialAuto agency metrics endpoint.
import { Card, Metric, Text } from "@tremor/react"; // or project card pattern
import { forwardSocialAuto } from "@/lib/socialauto";

async function getMetrics() {
  const res = await fetch(
    `${process.env.SOCIALAUTO_API_URL ?? "https://social.cloudless.gr"}/api/v1/agency/metrics`,
    { headers: { Authorization: `Bearer ${process.env.SOCIALAUTO_SERVICE_TOKEN}` }, next: { revalidate: 300 } }
  );
  return res.ok ? res.json() : null;
}

export default async function AgencyAnalyticsPage() {
  const m = await getMetrics();
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Agent Operations — 6-20 Client Board</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Token Cost per Delivery (TCD)</Text>
          <Metric>€{m?.tcd_eur ?? "—"}</Metric>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Task Success Rate (TSR)</Text>
          <Metric>{m?.tsr_pct ?? "—"}%</Metric>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Parallel Tasks (PPL)</Text>
          <Metric>{m?.ppl_active ?? "—"}</Metric>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Audit Lead Vector</Text>
          <Metric>{m?.alv_minutes ?? "—"} min</Metric>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Human Interventions/wk</Text>
          <Metric>{m?.hipc_weekly ?? "—"}</Metric>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
          <Text>Period</Text>
          <Metric>{m?.period ?? "—"}</Metric>
        </div>
      </div>
      <p className="text-sm text-slate-400">Targets: TCD&lt;€45 · TSR&gt;98% · HIPC&lt;1/wk</p>
    </main>
  );
}
