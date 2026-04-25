"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface Submission {
  id: string;
  name: string;
  email: string;
  company?: string;
  service?: string;
  message?: string;
  status: "New" | "In Review" | "Done";
  createdAt?: string;
  source?: string;
}

const STATUS_STYLES: Record<string, string> = {
  New: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  "In Review": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Done: "bg-neon-green/10 text-neon-green border-neon-green/30",
};

const VALID_STATUSES = ["New", "In Review", "Done"] as const;

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "New" | "In Review" | "Done">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/submissions?limit=100");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { submissions: Submission[] };
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const updateStatus = async (pageId: string, status: "New" | "In Review" | "Done") => {
    setUpdating(pageId);
    try {
      const res = await fetchWithAuth("/api/admin/notion/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmissions((prev) =>
        prev.map((s) => (s.id === pageId ? { ...s, status } : s)),
      );
    } catch (err) {
      console.error("Failed to update submission:", err);
    } finally {
      setUpdating(null);
    }
  };

  const filtered =
    filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  const counts = {
    New: submissions.filter((s) => s.status === "New").length,
    "In Review": submissions.filter((s) => s.status === "In Review").length,
    Done: submissions.filter((s) => s.status === "Done").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">NOTION_SUBMISSIONS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Contact Submissions</h1>
          <p className="font-body mt-1 text-slate-400">
            Incoming leads and contact form entries from cloudless.gr.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {VALID_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl border p-4 text-left transition-all ${
              filter === s
                ? STATUS_STYLES[s]
                : "border-slate-800 bg-void-light/30 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="font-mono text-2xl font-bold">{counts[s]}</div>
            <div className="mt-1 font-mono text-xs">{s}</div>
          </button>
        ))}
      </div>

      {/* Filter pill */}
      {filter !== "all" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">Showing:</span>
          <span className={`rounded-full border px-3 py-1 font-mono text-xs ${STATUS_STYLES[filter]}`}>
            {filter}
          </span>
          <button
            onClick={() => setFilter("all")}
            className="font-mono text-xs text-slate-600 hover:text-slate-400"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error === "Notion submissions not configured"
            ? "Notion Submissions DB not configured. Set NOTION_SUBMISSIONS_DB_ID in SSM."
            : error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/30 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="h-4 w-32 rounded bg-slate-700/60" />
                <div className="h-4 w-48 rounded bg-slate-700/40" />
                <div className="ml-auto h-6 w-20 rounded-full bg-slate-700/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
          <p className="font-mono text-slate-500">
            {filter === "all" ? "No submissions yet." : `No submissions with status "${filter}".`}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-slate-800 bg-void-light/30 overflow-hidden">
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white truncate">{sub.name}</span>
                    {sub.company && (
                      <span className="font-mono text-xs text-slate-500 truncate">
                        {sub.company}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">{sub.email}</span>
                    {sub.service && (
                      <span className="rounded bg-neon-cyan/5 px-1.5 py-0.5 font-mono text-[10px] text-neon-cyan/60">
                        {sub.service}
                      </span>
                    )}
                    {sub.createdAt && (
                      <span className="font-mono text-[10px] text-slate-600">
                        {formatDate(sub.createdAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${STATUS_STYLES[sub.status] ?? ""}`}
                  >
                    {sub.status}
                  </span>
                  <span className="text-slate-600 font-mono text-xs">
                    {expanded === sub.id ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Expanded */}
              {expanded === sub.id && (
                <div className="border-t border-slate-800 px-5 py-4">
                  {sub.message && (
                    <div className="mb-4">
                      <p className="font-mono text-xs text-slate-500 mb-1">Message</p>
                      <p className="font-body text-sm text-slate-300 whitespace-pre-wrap">
                        {sub.message}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">Update status:</span>
                    {VALID_STATUSES.map((s) => (
                      <button
                        key={s}
                        disabled={sub.status === s || updating === sub.id}
                        onClick={() => updateStatus(sub.id, s)}
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-all disabled:opacity-40 ${
                          sub.status === s
                            ? STATUS_STYLES[s]
                            : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                        }`}
                      >
                        {updating === sub.id && sub.status !== s ? "…" : s}
                      </button>
                    ))}
                    <a
                      href={`mailto:${sub.email}`}
                      className="ml-auto text-neon-cyan/70 hover:text-neon-cyan font-mono text-xs transition-colors"
                    >
                      Reply →
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          <p className="mt-2 text-right font-mono text-xs text-slate-600">
            {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
