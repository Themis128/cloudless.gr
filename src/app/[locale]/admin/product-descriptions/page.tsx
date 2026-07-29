"use client";

import { useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { defaultProducts } from "@/lib/store-products-client";

interface DraftDescription {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

interface GenerateResponse {
  results?: Array<{ id: string; name: string; description: string }>;
  errors?: Array<{ id: string; error: string }>;
  error?: string;
}

interface ApplyResponse {
  applied?: number;
  error?: string;
}

export default function ProductDescriptionsPage() {
  const catalog = useMemo(() => defaultProducts, []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(catalog.map((p) => p.id))
  );
  const [drafts, setDrafts] = useState<DraftDescription[]>([]);
  const [genErrors, setGenErrors] = useState<Array<{ id: string; error: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(on: boolean) {
    setSelectedIds(on ? new Set(catalog.map((p) => p.id)) : new Set());
  }

  async function generate() {
    if (selectedIds.size === 0 || loading) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    setGenErrors([]);
    setNotConfigured(false);
    try {
      const res = await fetchWithAuth("/api/admin/ai/product-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: [...selectedIds] }),
      });
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate descriptions");
      }
      setDrafts(
        (data.results ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          selected: true,
        }))
      );
      setGenErrors(data.errors ?? []);
      setStatus(
        `Generated ${(data.results ?? []).length} draft${(data.results ?? []).length === 1 ? "" : "s"} via Workers AI (Gemini fallback).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function applyApproved() {
    const toApply = drafts.filter((d) => d.selected && d.description.trim());
    if (toApply.length === 0 || applying) return;
    setApplying(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetchWithAuth("/api/admin/ai/product-descriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptions: toApply.map((d) => ({
            id: d.id,
            description: d.description.trim(),
          })),
        }),
      });
      const data = (await res.json()) as ApplyResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to apply descriptions");
      }
      setStatus(`Applied ${data.applied ?? 0} description${(data.applied ?? 0) === 1 ? "" : "s"} to product cache.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setApplying(false);
    }
  }

  if (notConfigured) {
    return (
      <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
        <p className="font-mono text-sm text-yellow-400">
          Workers AI / Gemini is not configured for product copy. Bind{" "}
          <code className="text-yellow-300">AI</code> in wrangler and/or set{" "}
          <code className="text-yellow-300">GEMINI_API_KEY</code> as a Wrangler secret.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="font-mono text-xs text-amber-400">R21d · WORKERS AI</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Product Copy</h1>
        <p className="mt-2 font-mono text-sm text-slate-400">
          Generate store descriptions with Cloudflare Workers AI, edit drafts, then apply only
          what you approve.
        </p>
      </div>

      <section className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-xs tracking-widest text-slate-400 uppercase">
            Products ({selectedIds.size}/{catalog.length})
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => selectAll(true)}
              className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-300 hover:border-neon-cyan/40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-300 hover:border-neon-cyan/40"
            >
              Clear
            </button>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {catalog.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 hover:border-neon-cyan/30">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  className="accent-neon-cyan"
                />
                <span className="font-mono text-xs text-white">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={generate}
          disabled={loading || selectedIds.size === 0}
          className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 hover:bg-neon-cyan/20 mt-4 min-h-[44px] w-full rounded-lg border px-4 py-2.5 font-mono text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate drafts"}
        </button>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      )}

      {status && (
        <div className="mb-4 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-3">
          <p className="font-mono text-sm text-neon-cyan">{status}</p>
        </div>
      )}

      {genErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-900/30 bg-yellow-950/10 px-4 py-3">
          <p className="mb-2 font-mono text-xs text-yellow-400">Generation errors</p>
          <ul className="space-y-1">
            {genErrors.map((e) => (
              <li key={e.id} className="font-mono text-xs text-yellow-300/80">
                {e.id}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {drafts.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-mono text-xs tracking-widest text-slate-400 uppercase">
              Review &amp; approve
            </h2>
            <button
              type="button"
              onClick={applyApproved}
              disabled={applying || drafts.every((d) => !d.selected)}
              className="bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30 hover:bg-neon-magenta/20 min-h-[44px] rounded-lg border px-4 py-2.5 font-mono text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply approved"}
            </button>
          </div>
          {drafts.map((draft, idx) => (
            <div
              key={draft.id}
              className="bg-void-light/50 rounded-xl border border-slate-800 p-4 open:border-neon-cyan/30"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.selected}
                    onChange={() => {
                      setDrafts((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, selected: !d.selected } : d))
                      );
                    }}
                    className="accent-neon-cyan"
                  />
                  <span className="font-heading text-sm font-semibold text-white">{draft.name}</span>
                </label>
                <span className="font-mono text-[10px] text-slate-500">{draft.id}</span>
              </div>
              <textarea
                value={draft.description}
                onChange={(e) => {
                  const value = e.target.value;
                  setDrafts((prev) =>
                    prev.map((d, i) => (i === idx ? { ...d, description: value } : d))
                  );
                }}
                rows={3}
                maxLength={500}
                className="bg-void focus:ring-neon-cyan/50 w-full rounded-lg border border-slate-800 px-3 py-2 font-mono text-sm text-white focus:ring-2 focus:outline-none"
              />
              <p className="mt-1 text-right font-mono text-[10px] text-slate-600">
                {draft.description.length}/500
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
