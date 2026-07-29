"use client";

/**
 * /admin/grafana — dashboard inventory + health chip.
 *
 * R5 of the 2026-06-21 R-series. Lists every Grafana dashboard the admin
 * token can see, links each one out to grafana.cloudless.gr, surfaces an
 * up/down chip from `pingGrafana()`. When `GRAFANA_API_TOKEN` is unset the
 * page renders a "configure me" placeholder pointing at the rotation steps
 * documented in `[[project-unified-admin-creds]]` memory.
 *
 * Grafana is not Cloudflare-tunnel-exposed (per
 * `project_blackbox_in_cluster_probes`), so the deep-links require VPN /
 * Tailscale. The "open" affordance is rendered regardless — the badge tells
 * the operator if they need to be on-tailnet.
 */
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

interface GrafanaDashboardSummary {
  uid: string;
  title: string;
  url: string;
  type: string;
  tags: string[];
  folderTitle?: string;
}

interface HealthResp {
  configured: boolean;
  healthy: boolean;
}

const GRAFANA_BASE = "https://grafana.cloudless.gr";

function fmtTags(tags: string[]): string {
  return tags.length === 0 ? "—" : tags.slice(0, 4).join(", ");
}

export default function GrafanaAdminPage() {
  const [dashboards, setDashboards] = useState<GrafanaDashboardSummary[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [dRes, hRes] = await Promise.all([
        fetchWithAuth("/api/admin/grafana/dashboards"),
        fetchWithAuth("/api/admin/grafana/health"),
      ]);
      if (!dRes.ok && dRes.status !== 503) {
        throw new Error(`dashboards HTTP ${dRes.status}`);
      }
      const d: { dashboards: GrafanaDashboardSummary[]; configured: boolean } = await dRes.json();
      setDashboards(d.dashboards ?? []);
      setConfigured(Boolean(d.configured));
      if (hRes.ok) setHealth(await hRes.json());
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

  const chip = (() => {
    if (!health || configured === null) {
      return { label: "—", klass: "border-slate-700 text-slate-500" };
    }
    if (!health.configured)
      return { label: "UNCONFIGURED", klass: "border-yellow-500/30 text-yellow-400" };
    if (health.healthy) return { label: "OK", klass: "border-neon-green/30 text-neon-green" };
    return { label: "UNREACHABLE", klass: "border-red-500/30 text-red-400" };
  })();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          ← Admin
        </Link>
      </div>
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
          <span className="font-mono text-xs text-orange-400">GRAFANA</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Grafana dashboards</h1>
        <p className="mt-2 font-mono text-xs text-slate-500">
          Every dashboard the <code className="text-slate-400">cloudless-app</code> service account
          can see. Grafana isn&apos;t Cloudflare-tunnel-exposed —{" "}
          <code className="text-slate-400">grafana.cloudless.gr</code> links require VPN/Tailscale.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              chip.label === "OK" ? "bg-neon-green" : "animate-pulse bg-slate-600"
            }`}
          />
          <span className="font-mono text-[10px] text-slate-400">API</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${chip.klass}`}>
            {chip.label}
          </span>
        </div>
      </div>

      {loading && <Spinner color="border-orange-400" />}
      {error && <ErrorMsg msg={error} />}

      {!loading && configured === false && (
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            <code>GRAFANA_API_TOKEN</code> isn&apos;t set in SSM. Generate a Service Account token
            in Grafana → Administration → Users and access → Service accounts (or via the in-cluster
            API), then{" "}
            <code className="text-slate-300">
              aws ssm put-parameter --name /cloudless/production/GRAFANA_API_TOKEN --type
              SecureString --value &apos;glsa_...&apos; --overwrite
            </code>
            .
          </p>
        </div>
      )}

      {!loading && !error && configured && dashboards.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <p className="font-mono text-xs text-slate-500">
            Token is valid but no dashboards exist yet. Import some from{" "}
            <a
              href={`${GRAFANA_BASE}/dashboards`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 underline"
            >
              grafana.cloudless.gr/dashboards
            </a>
            .
          </p>
        </div>
      )}

      {!loading && !error && configured && dashboards.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <a
              key={d.uid}
              href={`${GRAFANA_BASE}${d.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-orange-500/30 hover:bg-slate-800/50"
            >
              <div className="truncate font-mono text-sm text-white">{d.title}</div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-[10px] text-slate-500">
                <span className="truncate">{d.folderTitle ?? "General"}</span>
                <span className="ml-2 shrink-0">{fmtTags(d.tags)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
