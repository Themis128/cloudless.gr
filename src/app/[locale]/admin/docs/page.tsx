"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { DocRecord } from "@/lib/notion-docs";

export default function AdminDocsPage() {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/docs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocs(data.docs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load docs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const filtered = showDrafts ? docs : docs.filter((d) => d.published);

  const categories = Array.from(new Set(filtered.map((d) => d.category)));
  const publishedCount = docs.filter((d) => d.published).length;
  const draftCount = docs.filter((d) => !d.published).length;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">DOCS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Documentation</h1>
          <p className="font-body mt-1 text-slate-400">
            All docs from your Notion docs database.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-500">
              <span className="text-neon-green">{publishedCount}</span> published
              &nbsp;·&nbsp;
              <span className="text-slate-400">{draftCount}</span> drafts
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showDrafts}
              onChange={(e) => setShowDrafts(e.target.checked)}
              className="rounded border-slate-600"
            />
            <span className="font-mono text-xs text-slate-400">Show drafts</span>
          </label>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5">
              <div className="mb-2 h-4 w-1/3 rounded bg-slate-700/60" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="h-3 w-2/3 rounded bg-slate-800/80" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 py-12 text-center">
          <p className="font-mono text-sm text-slate-500">
            {docs.length === 0 ? "No docs in Notion yet." : "No docs to show."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryDocs = filtered.filter((d) => d.category === category);
            return (
              <div key={category} className="rounded-xl border border-slate-800 bg-void-light/50 overflow-hidden">
                <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
                  <h2 className="font-mono text-xs font-semibold text-white">{category}</h2>
                  <span className="font-mono text-[10px] text-slate-600">{categoryDocs.length} doc{categoryDocs.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {categoryDocs.map((doc) => (
                    <div key={doc.id} className="hover:bg-void-lighter/20 flex items-center justify-between px-5 py-3 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 w-6 shrink-0">
                            {doc.order}
                          </span>
                          <span className="font-medium text-white text-sm truncate">{doc.title || "(Untitled)"}</span>
                        </div>
                        {doc.description && (
                          <p className="mt-0.5 ml-8 font-mono text-[10px] text-slate-600 truncate">{doc.description}</p>
                        )}
                        <p className="mt-0.5 ml-8 font-mono text-[10px] text-slate-700">{doc.slug}</p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                            doc.published
                              ? "border-neon-green/30 text-neon-green"
                              : "border-slate-700 text-slate-500"
                          }`}
                        >
                          {doc.published ? "Published" : "Draft"}
                        </span>
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neon-cyan/60 hover:text-neon-cyan font-mono text-[10px] transition-colors"
                          >
                            Notion →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-right font-mono text-[10px] text-slate-600">
            {filtered.length} doc{filtered.length !== 1 ? "s" : ""} across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </div>
      )}
    </div>
  );
}
