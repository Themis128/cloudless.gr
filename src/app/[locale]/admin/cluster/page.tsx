"use client";

/**
 * /admin/cluster — live status of the in-cluster monitoring CronJobs that
 * replaced the failing remote Claude Code on the Web routines (PR #1048,
 * 2026-06-21). Reuses the same MetricCard / Spinner / ErrorMsg components
 * as the LinkedIn campaigns page; data comes from
 * /api/admin/cluster/watchdogs which talks to the k8s API via the in-pod
 * SA + the `watchdog-reader` RoleBinding.
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

export default function ClusterStatusPage() {
  const [watchdogs, setWatchdogs] = useState<Watchdog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outsideCluster, setOutsideCluster] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

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
      const data = await res.json();
      setWatchdogs(data.watchdogs ?? []);
      setFetchedAt(data.fetchedAt ?? null);
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
          #1048). Posts to Slack <code className="text-slate-400">C09AF5W3X16</code> on any
          warning.
        </p>
      </div>

      {outsideCluster && (
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            This page only renders inside the cluster pod. Local dev / preview deploys see
            this banner instead of live data.
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
    </div>
  );
}
