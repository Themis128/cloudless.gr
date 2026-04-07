"use client";

import { useEffect, useState } from "react";

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
  error: "text-red-400 bg-red-400/10",
  warning: "text-yellow-400 bg-yellow-400/10",
  info: "text-neon-cyan bg-neon-cyan/10",
  fatal: "text-red-500 bg-red-500/20",
};

export default function AdminErrorsPage() {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchErrors() {
      try {
        const res = await fetch("/api/admin/ops/errors");
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
    }
    fetchErrors();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ERRORS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Error Monitoring</h1>
        <p className="font-body mt-1 text-slate-400">
          Unresolved issues from Sentry — last 20.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Unresolved</p>
          <p className={`font-heading mt-1 text-2xl font-bold ${issues.length === 0 ? "text-neon-green" : "text-red-400"}`}>
            {loading ? "…" : issues.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Errors</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : issues.filter((i) => i.level === "error" || i.level === "fatal").length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Warnings</p>
          <p className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {loading ? "…" : issues.filter((i) => i.level === "warning").length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            {error === "Sentry not configured"
              ? "Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT in your environment."
              : "Check your Sentry configuration."}
          </p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
          <p className="text-neon-green text-4xl">✓</p>
          <p className="font-heading mt-4 text-lg font-semibold text-white">All Clear</p>
          <p className="mt-1 text-sm text-slate-500">No unresolved issues in Sentry.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="bg-void-light/50 hover:border-neon-magenta/30 rounded-xl border border-slate-800 p-5 transition-all"
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${levelClasses[issue.level] ?? "text-slate-400 bg-slate-800/50"}`}>
                  {issue.level}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-mono text-sm font-medium text-white">{issue.title}</h3>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{issue.culprit}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs text-slate-400">{issue.count} events</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">
                    Last: {new Date(issue.lastSeen).toLocaleDateString("en-IE")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
