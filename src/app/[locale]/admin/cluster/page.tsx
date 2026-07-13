"use client";

/**
 * /admin/cluster — live status of the in-cluster monitoring CronJobs that
 * replaced the failing remote Claude Code on the Web routines (PR #1048,
 * 2026-06-21). Reuses the same MetricCard / Spinner / ErrorMsg components
 * as the LinkedIn campaigns page; data comes from
 * /api/admin/cluster/watchdogs which talks to the k8s API via the in-pod
 * SA + the `watchdog-reader` RoleBinding.
 *
 * R25: Self-hosted admin auto-login bridge — each app tile has an "Open →"
 * button that calls /api/admin/autologin?app=<name> and opens the result URL
 * in a new tab. AppFlowy gets a token-injected deep-link; all others get the
 * canonical admin URL.
 */
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

interface Watchdog {
  name: string;
  namespace: string;
  schedule: string;
  suspended: boolean;
  lastScheduleTime: string | null;
  lastSuccessfulTime: string | null;
  lastRunFailed: boolean | null;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "—";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "<1m ago";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusFor(w: Watchdog): { label: string; klass: string } {
  if (w.suspended) {
    return { label: "SUSPENDED", klass: "border-yellow-500/30 text-yellow-400" };
  }
  if (w.lastRunFailed) {
    return { label: "FAILED", klass: "border-red-500/30 text-red-400" };
  }
  if (w.lastSuccessfulTime) {
    return { label: "OK", klass: "border-neon-green/30 text-neon-green" };
  }
  return { label: "PENDING", klass: "border-slate-700 text-slate-500" };
}

interface MqttStatus {
  severity: "ok" | "info" | "warning" | "error" | "high" | "critical";
  count: number;
  ts?: number;
  timestamp?: number;
  src?: string;
}

interface KumaMonitor {
  id: number;
  name: string;
  status: "up" | "down" | "pending";
  pingMs: number | null;
  lastHeartbeatAt: string | null;
  groupName: string;
}

interface KumaSummary {
  baseUrl: string;
  slug: string;
  monitors: KumaMonitor[];
  fetchedAt: string;
}

function kumaPill(s: KumaMonitor): { label: string; klass: string } {
  if (s.status === "up") {
    return { label: "UP", klass: "border-neon-green/30 text-neon-green" };
  }
  if (s.status === "down") {
    return { label: "DOWN", klass: "border-red-500/30 text-red-400" };
  }
  return { label: "PENDING", klass: "border-slate-700 text-slate-500" };
}

function mqttChip(s: MqttStatus | null): { label: string; klass: string; dot: string } {
  if (!s) return { label: "—", klass: "border-slate-700 text-slate-500", dot: "bg-slate-600" };
  const sev = s.severity;
  if (sev === "ok" || sev === "info") {
    return {
      label: `OK (${s.count})`,
      klass: "border-neon-green/30 text-neon-green",
      dot: "bg-neon-green",
    };
  }
  if (sev === "warning") {
    return {
      label: `WARN (${s.count})`,
      klass: "border-yellow-500/30 text-yellow-400",
      dot: "bg-yellow-400",
    };
  }
  return {
    label: `${sev.toUpperCase()} (${s.count})`,
    klass: "border-red-500/30 text-red-400",
    dot: "bg-red-400",
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClusterStatusPage() {
  const [watchdogs, setWatchdogs] = useState<Watchdog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outsideCluster, setOutsideCluster] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus | null>(null);
  const [kumaSummary, setKumaSummary] = useState<KumaSummary | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/cluster/watchdogs");
      if (res.status === 503) {
        setOutsideCluster(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (((((await res.json()) as any)) as any)) as any;
      setWatchdogs(data.watchdogs ?? []);
      setFetchedAt(data.fetchedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }

    // MQTT live chip — fails silently so a broker hiccup doesn't break
    // the main table. Reads the retained `homelab/alerts/status` payload
    // from Mosquitto via the alert-api publisher (PR R3, 2026-06-21).
    try {
      const mres = await fetchWithAuth("/api/admin/cluster/mqtt-status");
      if (mres.ok) {
        const j = (((((await mres.json()) as any)) as any)) as any;
        setMqttStatus(j.status ?? null);
      }
    } catch {
      /* silent — chip degrades to — */
    }

    // Uptime Kuma — same pattern: silent fail → "Kuma unreachable" placeholder.
    try {
      const kres = await fetchWithAuth("/api/admin/cluster/kuma-status");
      if (kres.ok) {
        const j = (((((await kres.json()) as any)) as any)) as any;
        setKumaSummary(j.summary ?? null);
      }
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
     
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          ← Admin
        </Link>
      </div>
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          <span className="font-mono text-xs text-blue-400">CLUSTER</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Monitoring watchdogs</h1>
        <p className="mt-2 font-mono text-xs text-slate-500">
          In-cluster CronJobs that replaced the failing remote Claude Code on the Web routines (PR
          #1048). Posts to Slack <code className="text-slate-400">C09AF5W3X16</code> on any warning.
        </p>
        {/* MQTT live chip — retained `homelab/alerts/status` payload from
            Mosquitto. "—" if broker unreachable / no retained message yet. */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${mqttChip(mqttStatus).dot} ${
              mqttStatus && (mqttStatus.severity === "ok" || mqttStatus.severity === "info")
                ? ""
                : "animate-pulse"
            }`}
          />
          <span className="font-mono text-[10px] text-slate-400">MQTT</span>
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${mqttChip(mqttStatus).klass}`}
          >
            {mqttChip(mqttStatus).label}
          </span>
          {mqttStatus?.ts && (
            <span className="font-mono text-[10px] text-slate-600">
              {fmtRelative(new Date(mqttStatus.ts * 1000).toISOString())}
            </span>
          )}
        </div>
      </div>

      {outsideCluster && (
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            This page only renders inside the cluster pod. Local dev / preview deploys see this
            banner instead of live data.
          </p>
        </div>
      )}

      {loading && <Spinner color="border-blue-400" />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && !outsideCluster && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Watchdog</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Schedule</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                  Last scheduled
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                  Last success
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {watchdogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-sm text-slate-600">
                    No watchdogs found in the monitoring namespace.
                  </td>
                </tr>
              )}
              {watchdogs.map((w) => {
                const st = statusFor(w);
                return (
                  <tr key={w.name} className="transition-colors hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-sm text-white">{w.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{w.schedule}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${st.klass}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400 tabular-nums">
                      {fmtRelative(w.lastScheduleTime)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400 tabular-nums">
                      {fmtRelative(w.lastSuccessfulTime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {fetchedAt && (
            <p className="border-t border-slate-800 bg-slate-900/30 px-4 py-2 font-mono text-[10px] text-slate-600">
              Fetched {fmtRelative(fetchedAt)} via the cloudless/default ServiceAccount.
            </p>
          )}
        </div>
      )}

      {/* Uptime Kuma panel — grouped grid of monitors from the public
          status page. Null summary → "configure / unreachable" placeholder.
          GAP-D, PR R2-deferred (2026-06-21). */}
      {!loading && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Uptime Kuma</h2>
            <a
              href={kumaSummary?.baseUrl || "https://kuma.cloudless.gr"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-slate-500 hover:text-slate-300"
            >
              {kumaSummary?.baseUrl || "kuma.cloudless.gr"} ↗
            </a>
          </div>
          {!kumaSummary && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
              <p className="font-mono text-xs text-slate-500">
                No data — set <code className="text-slate-300">KUMA_BASE_URL</code> +{" "}
                <code className="text-slate-300">KUMA_STATUS_PAGE_SLUG</code> in SSM and create a
                Kuma status page. Defaults:{" "}
                <code className="text-slate-300">https://kuma.cloudless.gr</code> and slug{" "}
                <code className="text-slate-300">default</code>.
              </p>
            </div>
          )}
          {kumaSummary && kumaSummary.monitors.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
              <p className="font-mono text-xs text-slate-500">
                Kuma is reachable but the <code className="text-slate-300">{kumaSummary.slug}</code>{" "}
                status page has no monitors. Add some in Kuma → Status Pages → Edit.
              </p>
            </div>
          )}
          {kumaSummary && kumaSummary.monitors.length > 0 && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {kumaSummary.monitors.map((m) => {
                const pill = kumaPill(m);
                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-sm text-white">{m.name}</span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${pill.klass}`}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono text-[10px] text-slate-500">
                      <span>{m.groupName}</span>
                      <span className="tabular-nums">
                        {m.pingMs != null ? `${m.pingMs}ms` : "—"}{" "}
                        {m.lastHeartbeatAt ? `· ${fmtRelative(m.lastHeartbeatAt)}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grafana — deep-link cards to the 2 self-hosted dashboards. Live
          embedding deferred: grafana isn't tunnel-exposed today
          (project_blackbox_in_cluster_probes), so the iframe path requires
          tunnel work that's out of scope here. Operator clicks through via
          VPN/Tailscale or once GRAFANA_BASE_URL is published to a public
          host. PR R2-deferred (2026-06-21). */}
      {!loading && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Grafana dashboards</h2>
            <span className="rounded-full border border-yellow-500/20 px-2 py-0.5 font-mono text-[10px] text-yellow-400">
              VPN / operator-only
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <a
              href="https://grafana.cloudless.gr/d/selfhosted-health"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-blue-500/30 hover:bg-slate-800/50"
            >
              <div className="font-mono text-sm text-white">Self-hosted apps — health</div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                AppFlowy / EspoCRM / Postiz / n8n / Kuma / Grafana up-down + restart counts.
              </div>
            </a>
            <a
              href="https://grafana.cloudless.gr/d/selfhosted-slo"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-blue-500/30 hover:bg-slate-800/50"
            >
              <div className="font-mono text-sm text-white">Self-hosted apps — SLO burn</div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                Blackbox-exporter probe success-rate windows + alert burn-rate annotations.
              </div>
            </a>
          </div>
        </div>
      )}

      {/* R25 — Self-hosted portal link */}
      <div className="mt-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/5 flex items-center justify-between rounded-xl border px-5 py-4">
          <div>
            <h2 className="font-heading text-sm font-semibold text-white">
              Self-hosted Apps Portal
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
              One-click admin ingress to EspoCRM, AppFlowy, n8n, Postiz, Grafana, Kuma
            </p>
          </div>
          <Link
            href="/admin/selfhosted"
            className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 shrink-0 rounded-lg border px-4 py-2 font-mono text-xs transition-colors"
          >
            Open portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
