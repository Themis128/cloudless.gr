"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { NotionPost } from "@/lib/notion-blog";

type Filter = "all" | "published" | "draft";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  published: "Published",
  draft: "Drafts",
};

function formatDate(iso: string) {
  if (!iso) return "—";
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

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<NotionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/blog");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const filtered = posts.filter((p) => {
    if (filter === "published") return p.published;
    if (filter === "draft") return !p.published;
    return true;
  });

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.filter((p) => !p.published).length;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">BLOG</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Blog Posts
          </h1>
          <p className="font-body mt-1 text-slate-400">
            All posts from your Notion blog database.
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
        <div className="mb-4 flex items-center gap-2">
          {(["all", "published", "draft"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${
                filter === f
                  ? "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan"
                  : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
              }`}
            >
              {FILTER_LABELS[f]}
              <span className="ml-1.5 font-mono text-[10px] opacity-60">
                {f === "all"
                  ? posts.length
                  : f === "published"
                    ? publishedCount
                    : draftCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5"
            >
              <div className="mb-2 h-4 w-2/3 rounded bg-slate-700/60" />
              <div className="h-3 w-1/3 rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 py-12 text-center">
          <p className="font-mono text-sm text-slate-500">
            {posts.length === 0
              ? "No posts in Notion yet."
              : "No posts match this filter."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-void-light/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">
                    Category
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">
                    Tags
                  </th>
                  <th className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                    Read Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-void-lighter/20 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {post.featured && (
                          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 font-mono text-[9px] text-yellow-400">
                            FEATURED
                          </span>
                        )}
                        <span className="font-medium text-white">
                          {post.title || "(Untitled)"}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                        {post.slug}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">
                      {post.category}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">
                      {formatDate(post.date)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                          post.published
                            ? "border-neon-green/30 text-neon-green"
                            : "border-slate-700 text-slate-500"
                        }`}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 3 && (
                          <span className="font-mono text-[9px] text-slate-600">
                            +{post.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {post.readTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-800 px-5 py-2.5 text-right font-mono text-[10px] text-slate-600">
            {filtered.length} post{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
