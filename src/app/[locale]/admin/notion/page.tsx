"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface Submission {
  id: string;
  name: string;
  email: string;
  company: string;
  service: string;
  message: string;
  status: string;
  source: string;
  submittedAt: string;
  url: string;
}

type StatusValue = "New" | "In Review" | "Done";

const STATUS_STYLES: Record<string, string> = {
  New: "bg-neon-green/10 text-neon-green border-neon-green/30",
  "In Review": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Done: "bg-slate-700/40 text-slate-500 border-slate-600/30",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function NotionSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/submissions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { submissions: Submission[]; count: number };
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (pageId: string, status: StatusValue) => {
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
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">NOTION_SUBMISSIONS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Contact Submissions</h1>
          <p className="font-body mt-1 text-slate-400">
            Form submissions stored in your Notion database.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && submissions.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
          <p className="font-mono text-slate-500">No submissions yet.</p>
          <p className="mt-2 font-body text-sm text-slate-600">
            Submissions will appear here once the contact form is used.
          </p>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="h-4 w-36 rounded bg-slate-700/60" />
                <div className="h-5 w-20 rounded-full bg-slate-700/60" />
              </div>
              <div className="h-3 w-48 rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!loading && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-slate-800 bg-void-light/50 p-5 transition-all"
            >
              {/* Row header */}
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-white">{sub.name}</span>
                    <span className="font-mono text-xs text-slate-500">{sub.email}</span>
                    {sub.company && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
                        {sub.company}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs text-slate-600">
                    <span>{formatDate(sub.submittedAt)}</span>
                    {sub.service && <span>· {sub.service}</span>}
                    <span>· {sub.source}</span>
                  </div>
                </div>

                {/* Status selector */}
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-xs ${STATUS_STYLES[sub.status] ?? STATUS_STYLES.New}`}
                  >
                    {sub.status}
                  </span>
                  <select
                    value={sub.status}
                    disabled={updating === sub.id}
                    onChange={(e) => updateStatus(sub.id, e.target.value as StatusValue)}
                    className="rounded border border-slate-700 bg-void px-2 py-1 font-mono text-xs text-slate-300 focus:border-neon-magenta/50 focus:outline-none disabled:opacity-50"
                  >
                    <option value="New">New</option>
                    <option value="In Review">In Review</option>
                    <option value="Done">Done</option>
                  </select>

                  <button
                    onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                    className="text-slate-500 hover:text-slate-300 font-mono text-xs transition-colors"
                  >
                    {expanded === sub.id ? "▲ hide" : "▼ show"}
                  </button>
                </div>
              </div>

              {/* Expanded message */}
              {expanded === sub.id && (
                <div className="mt-4 rounded-lg border border-slate-700/50 bg-void/60 p-4">
                  <p className="font-body whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {sub.message}
                  </p>
                  {sub.url && (
                    <a
                      href={sub.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-magenta/80 hover:text-neon-magenta mt-3 block font-mono text-xs transition-colors"
                    >
                      Open in Notion →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && submissions.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
