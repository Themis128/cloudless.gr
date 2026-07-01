"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────

interface N8nHealth {
  ok: boolean;
  configured: boolean;
  latencyMs: number;
  workflows: { total: number; active: number };
  executions: { recent: number; errors: number; running: number };
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: { id: string; name: string }[];
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  status: "success" | "error" | "running" | "waiting" | "canceled";
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const EXEC_STATUS_STYLES: Record<string, string> = {
  success: "bg-neon-green/10 text-neon-green border-neon-green/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  running: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  waiting: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  canceled: "bg-slate-700/40 text-slate-500 border-slate-600/30",
};

// ── Component ─────────────────────────────────────────────────

export default function AutomationPage() {
  const [health, setHealth] = useState<N8nHealth | null>(null);
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [executions, setExecutions] = useState<N8nExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, workflowsRes, execsRes] = await Promise.allSettled([
        fetchWithAuth("/api/admin/n8n/health"),
        fetchWithAuth("/api/admin/n8n/workflows"),
        fetchWithAuth("/api/admin/n8n/executions?limit=50"),
      ]);

      const healthData =
        healthRes.status === "fulfilled" && healthRes.value.ok
          ? ((await healthRes.value.json()) as N8nHealth)
          : null;
      const workflowsData =
        workflowsRes.status === "fulfilled" && workflowsRes.value.ok
          ? ((await workflowsRes.value.json()) as { workflows: N8nWorkflow[] })
          : null;
      const execsData =
        execsRes.status === "fulfilled" && execsRes.value.ok
          ? ((await execsRes.value.json()) as { executions: N8nExecution[] })
          : null;

      setHealth(healthData);
      setWorkflows(workflowsData?.workflows ?? []);
      setExecutions(execsData?.executions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automation data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data load for this admin page is intentionally triggered on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const triggerWorkflow = async (id: string, name: string) => {
    setTriggering(id);
    setTriggerResult(null);
    try {
      const res = await fetchWithAuth(`/api/admin/n8n/workflows/${id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "admin-automation", triggeredBy: "operator" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setTriggerResult(`\u2705 "${name}" triggered successfully`);
      setTimeout(load, 2000);
    } catch (err) {
      setTriggerResult(`\u274c Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTriggering(null);
    }
  };

  const filteredWorkflows = workflows.filter((w) => {
    if (activeFilter === "active") return w.active;
    if (activeFilter === "inactive") return !w.active;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">AUTOMATION</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">n8n Automation</h1>
          <p className="font-body mt-1 text-slate-400">
            Workflow automation engine — trigger and monitor n8n workflows.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="hover:bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta rounded-lg border px-4 py-2 font-mono text-xs transition-all disabled:opacity-40"
        >
          {loading ? "\u27F3 Refreshing..." : "\u27F3 Refresh"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
          <button onClick={load} className="ml-3 underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {triggerResult && (
        <div className="bg-void-light/50 mb-6 rounded-lg border border-slate-700 px-4 py-3 font-mono text-xs text-slate-300">
          {triggerResult}
        </div>
      )}

      {/* Health Summary */}
      {health && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-void-light/50 rounded-xl border border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  health.ok ? "bg-neon-green" : "bg-red-500"
                }`}
              />
              <span className="font-mono text-xs text-slate-500">Health</span>
            </div>
            <p className="font-heading mt-2 text-xl font-semibold text-white">
              {health.ok ? "Healthy" : "Unreachable"}
            </p>
            <p className="font-mono text-xs text-slate-600">{health.latencyMs}ms latency</p>
          </div>

          <div className="bg-void-light/50 rounded-xl border border-slate-800 px-5 py-4">
            <span className="font-mono text-xs text-slate-500">Workflows</span>
            <p className="font-heading mt-2 text-xl font-semibold text-white">
              {health.workflows.total}
            </p>
            <p className="font-mono text-xs text-slate-600">
              {health.workflows.active} active · {health.workflows.total - health.workflows.active} inactive
            </p>
          </div>

          <div className="bg-void-light/50 rounded-xl border border-slate-800 px-5 py-4">
            <span className="font-mono text-xs text-slate-500">Recent Executions</span>
            <p className="font-heading mt-2 text-xl font-semibold text-white">
              {health.executions.recent}
            </p>
            <p className="font-mono text-xs text-slate-600">
              {health.executions.running} running
            </p>
          </div>

          <div className="bg-void-light/50 rounded-xl border border-slate-800 px-5 py-4">
            <span className="font-mono text-xs text-slate-500">Recent Failures</span>
            <p
              className={`font-heading mt-2 text-xl font-semibold ${
                health.executions.errors > 0 ? "text-red-400" : "text-neon-green"
              }`}
            >
              {health.executions.errors}
            </p>
          </div>
        </div>
      )}

      {/* Not configured state */}
      {!loading && !error && !health && (
        <div className="bg-void-light/30 mb-8 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-slate-500">n8n is not configured.</p>
          <p className="font-body mt-2 text-sm text-slate-600">
            Set <code className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs">N8N_API_URL</code>{" "}
            and <code className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs">N8N_API_KEY</code>{" "}
            in SSM to enable workflow automation.
          </p>
        </div>
      )}

      {/* Workflows */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-white">Workflows</h2>
          <div className="flex gap-2">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-lg border px-3 py-1 font-mono text-xs transition-all ${
                  activeFilter === f
                    ? "bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta"
                    : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                }`}
              >
                {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-void-light/50 h-16 animate-pulse rounded-xl border border-slate-800"
              />
            ))}
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="bg-void-light/30 rounded-xl border border-slate-800 p-8 text-center">
            <p className="font-mono text-sm text-slate-500">
              {activeFilter === "all"
                ? "No workflows found in n8n."
                : `No ${activeFilter} workflows found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-void-light/50 hover:border-neon-magenta/20 flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 px-5 py-4 transition-all"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    wf.active ? "bg-neon-green" : "bg-slate-600"
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <span className="font-heading text-sm font-semibold text-white">{wf.name}</span>
                  {wf.tags && wf.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {wf.tags.map((t) => (
                        <span
                          key={t.id}
                          className="bg-neon-magenta/5 text-neon-magenta/60 rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[9px]"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                    wf.active
                      ? "bg-neon-green/10 text-neon-green border-neon-green/30"
                      : "bg-slate-700/40 text-slate-500 border-slate-600/30"
                  }`}
                >
                  {wf.active ? "Active" : "Inactive"}
                </span>

                <button
                  onClick={() => triggerWorkflow(wf.id, wf.name)}
                  disabled={triggering === wf.id || !wf.active}
                  className="hover:bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan rounded-lg border px-3 py-1.5 font-mono text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title={wf.active ? "Trigger this workflow now" : "Only active workflows can be triggered"}
                >
                  {triggering === wf.id ? "\u27F3 Triggering..." : "\u25B6 Trigger"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div className="mb-8">
        <h2 className="font-heading mb-4 text-lg font-semibold text-white">Recent Executions</h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-void-light/50 h-12 animate-pulse rounded-xl border border-slate-800"
              />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="bg-void-light/30 rounded-xl border border-slate-800 p-8 text-center">
            <p className="font-mono text-sm text-slate-500">No recent executions.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="divide-y divide-slate-800">
              {executions.map((exec) => {
                const wfName = workflows.find((w) => w.id === exec.workflowId)?.name ?? exec.workflowId;
                return (
                  <div
                    key={exec.id}
                    className="bg-void-light/50 flex flex-wrap items-center gap-3 px-5 py-3 sm:gap-4"
                  >
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                        EXEC_STATUS_STYLES[exec.status] ?? EXEC_STATUS_STYLES.success
                      }`}
                    >
                      {exec.status}
                    </span>

                    <span className="min-w-0 flex-1 font-mono text-xs text-slate-300">
                      {wfName}
                    </span>

                    <span className="hidden font-mono text-[10px] text-slate-600 sm:inline">
                      {exec.mode}
                    </span>

                    <span className="font-mono text-[10px] text-slate-600">
                      {formatDate(exec.startedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="font-mono text-xs text-slate-600">
        Powered by{" "}
        <a
          href="https://n8n.cloudless.gr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-magenta/60 hover:text-neon-magenta transition-colors"
        >
          n8n.cloudless.gr
        </a>
      </p>
    </div>
  );
}
