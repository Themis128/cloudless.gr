/**
 * Admin - Errors page
 *
 * Displays unresolved Sentry issues fetched from GET /api/admin/sentry/issues.
 * Each issue can be resolved or ignored via inline action buttons that POST to
 * /api/admin/sentry/resolve or /api/admin/sentry/ignore respectively.
 *
 * Filtering: the search input narrows the visible list client-side by title /
 * culprit. Pagination: "Load more" appends the next cursor page.
 *
 * @module admin/errors
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: string;
  count: string;
  firstSeen: string;
  lastSeen: string;
  status: string;
}

const levelClasses: Record<string, string> = {
  error: "text-red-400 bg-red-400/10 border-red-900/30",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-900/30",
  info: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20",
  fatal: "text-red-500 bg-red-500/20 border-red-900/50",
};

const levelDot: Record<string, string> = {
  fatal: "bg-red-500",
  error: "bg-red-400",
  warning: "bg-yellow-400",
  info: "bg-neon-cyan",
};

type FilterLevel = "all" | "fatal" | "error" | "warning" | "info";

export default function AdminErrorsPage() {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{
    id: string;
    text: string;
    ok: boolean;
  } | null>(null);
  const [filter, setFilter] = useState<FilterLevel>("all");

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth("/api/admin/ops/errors");
      if (!res.ok) {
        if (res.status === 503) throw new Error("Sentry not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setIssues(data.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load errors");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const handleAction = async (
    id: string,
    status: "resolved" | "ignored" | "unresolved",
  ) => {
    const labels: Record<string, string> = {
      resolved: "Resolved",
      ignored: "Ignored",
      unresolved: "Reopened",
    };
    setActionLoading(`${status}-${id}`);
    setActionMsg(null);
    try {
      const res = await fetchWithAuth(`/api/admin/ops/errors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActionMsg({ id, text: `${labels[status]} successfully`, ok: true });
      // Remove resolved/ignored from list; re-add if reopened
      if (status !== "unresolved") {
        setIssues((prev) => prev.filter((i) => i.id !== id));
      } else {
        await fetchErrors();
      }
    } catch (err) {
      setActionMsg({
        id,
        text: err instanceof Error ? err.message : "Action failed",
        ok: false,
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const visible = issues.filter((i) => filter === "all" || i.level === filter);
  const counts = {
    all: issues.length,
    fatal: issues.filter((i) => i.level === "fatal").length,
    error: issues.filter((i) => i.level === "error").length,
    warning: issues.filter((i) => i.level === "warning").length,
    info: issues.filter((i) => i.level === "info").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ERRORS</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">
              Error Monitoring
            </h1>
            <p className="font-body mt-1 text-slate-400">
              Unresolved Sentry issues — resolve or ignore directly from here.
            </p>
          </div>
          <button
            onClick={fetchErrors}
            disabled={loading}
            className="border-neon-magenta/20 text-neon-magenta hover:bg-neon-magenta/10 min-h-[40px] shrink-0 rounded-lg border px-4 py-2 font-mono text-xs transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Unresolved</p>
          <p
            className={`font-heading mt-1 text-2xl font-bold ${issues.length === 0 ? "text-neon-green" : "text-red-400"}`}
          >
            {loading ? "…" : issues.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Fatal / Error</p>
          <p className="font-heading mt-1 text-2xl font-bold text-red-400">
            {loading ? "…" : counts.fatal + counts.error}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Warnings</p>
          <p className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {loading ? "…" : counts.warning}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Events</p>
          <p className="font-heading mt-1 text-2xl font-bold text-slate-300">
            {loading
              ? "…"
              : issues
                  .reduce((s, i) => s + Number(i.count || 0), 0)
                  .toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      {!loading && !error && issues.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "fatal", "error", "warning", "info"] as FilterLevel[]).map(
            (lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`min-h-[34px] rounded-lg border px-3 py-1 font-mono text-xs transition-all ${
                  filter === lvl
                    ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20"
                    : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
                }`}
              >
                {lvl} ({counts[lvl]})
              </button>
            ),
          )}
        </div>
      )}

      {/* Global action message */}
      {actionMsg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2 font-mono text-xs ${actionMsg.ok ? "border-neon-green/20 bg-neon-green/5 text-neon-green" : "border-red-900/30 bg-red-950/10 text-red-400"}`}
        >
          {actionMsg.ok ? "✓" : "✗"} {actionMsg.text}
        </div>
      )}

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            {error === "Sentry not configured"
              ? "Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT in SSM."
              : "Check your Sentry configuration."}
          </p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
          <p className="text-neon-green text-4xl">✓</p>
          <p className="font-heading mt-4 text-lg font-semibold text-white">
            All Clear
          </p>
          <p className="mt-1 text-sm text-slate-500">
            No unresolved issues in Sentry.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8 text-center">
          <p className="font-mono text-sm text-slate-500">
            No issues at this level.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((issue) => {
            const isActing = actionLoading !== null;
            const dotClass = levelDot[issue.level] ?? "bg-slate-600";
            const labelClass =
              levelClasses[issue.level] ??
              "text-slate-400 bg-slate-800/50 border-slate-700";

            return (
              <div
                key={issue.id}
                className="bg-void-light/50 hover:border-neon-magenta/20 rounded-xl border border-slate-800 p-5 transition-all"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {/* Level dot + badge */}
                  <div className="mt-1 shrink-0 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${labelClass}`}
                    >
                      {issue.level}
                    </span>
                  </div>

                  {/* Title + culprit */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-white">
                      {issue.title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                      {issue.culprit || "unknown location"}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                      First:{" "}
                      {new Date(issue.firstSeen).toLocaleDateString("en-IE")}
                      {" · "}
                      Last:{" "}
                      {new Date(issue.lastSeen).toLocaleDateString("en-IE")}
                    </p>
                  </div>

                  {/* Event count */}
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-white">
                      {Number(issue.count).toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-slate-600">
                      events
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-3">
                  <span className="font-mono text-[10px] text-slate-600 mr-1">
                    Actions:
                  </span>
                  <button
                    onClick={() => handleAction(issue.id, "resolved")}
                    disabled={isActing}
                    className="min-h-[30px] rounded-lg border border-neon-green/20 px-3 py-1 font-mono text-[11px] text-neon-green transition-colors hover:bg-neon-green/10 disabled:opacity-40"
                  >
                    {actionLoading === `resolved-${issue.id}`
                      ? "…"
                      : "✓ Resolve"}
                  </button>
                  <button
                    onClick={() => handleAction(issue.id, "ignored")}
                    disabled={isActing}
                    className="min-h-[30px] rounded-lg border border-slate-700 px-3 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    {actionLoading === `ignored-${issue.id}` ? "…" : "⊘ Ignore"}
                  </button>
                  <a
                    href={`https://sentry.io/organizations/${process.env.NEXT_PUBLIC_SENTRY_ORG ?? ""}/issues/${issue.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[30px] inline-flex items-center rounded-lg border border-slate-800 px-3 py-1 font-mono text-[11px] text-slate-500 transition-colors hover:border-slate-700 hover:text-white"
                  >
                    ↗ Sentry
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && issues.length > 0 && (
        <p className="mt-4 font-mono text-[10px] text-slate-600">
          Showing {visible.length} of {issues.length} unresolved issues ·
          Resolving removes from this list immediately
        </p>
      )}
    </div>
  );
}
