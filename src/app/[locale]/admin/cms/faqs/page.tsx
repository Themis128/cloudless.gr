"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { Faq, FaqInput, FaqCategory } from "@/lib/notion-faqs";

const FAQ_CATEGORIES: FaqCategory[] = ["general", "pricing", "technical", "process"];

const EMPTY_FORM: FaqInput = {
  question: "",
  answer: "",
  category: "general",
  locales: [],
  published: false,
  order: undefined,
};

type FormState = FaqInput & { pageId?: string };

export default function AdminFaqsPage() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/appflowy/faqs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (((((await res.json()) as any)) as any)) as { faqs: Faq[] };
      setItems(data.faqs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});  
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  };

  const openEdit = (f: Faq) => {
    setForm({
      pageId: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
      locales: f.locales,
      published: true,
    });
    setFormError(null);
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.question.trim()) {
      setFormError("Question is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { pageId, ...input } = form;
      const method = pageId ? "PATCH" : "POST";
      const body = pageId ? { pageId, ...input } : input;
      const res = await fetchWithAuth("/api/admin/appflowy/faqs", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (((((await res.json()) as any)) as any)) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (pageId: string) => {
    if (!confirm("Archive this FAQ?")) return;
    setDeleting(pageId);
    try {
      const res = await fetchWithAuth(
        `/api/admin/appflowy/faqs?pageId=${encodeURIComponent(pageId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((f) => f.id !== pageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const CATEGORY_COLORS: Record<FaqCategory, string> = {
    general: "border-slate-700 text-slate-400",
    pricing: "border-neon-green/30 text-neon-green",
    technical: "border-neon-cyan/30 text-neon-cyan",
    process: "border-yellow-500/30 text-yellow-400",
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            <span className="font-mono text-xs text-yellow-400">CMS_FAQS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">FAQs</h1>
          <p className="font-body mt-1 text-slate-400">Manage frequently asked questions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-400 hover:border-slate-500 disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
          <button
            onClick={openCreate}
            className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 font-mono text-xs text-yellow-400 hover:bg-yellow-500/20"
          >
            + New
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Modal form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-void-dark w-full max-w-lg rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <h2 className="font-heading mb-4 text-lg font-bold text-white">
              {form.pageId ? "Edit FAQ" : "New FAQ"}
            </h2>
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Question *</span>
                <input
                  type="text"
                  className="bg-void font-body rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                  value={form.question}
                  onChange={(e) => setForm((f) => f && { ...f, question: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Answer</span>
                <textarea
                  rows={4}
                  className="bg-void font-body rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                  value={form.answer ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, answer: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Category</span>
                <select
                  className="bg-void rounded border border-slate-700 px-3 py-1.5 font-mono text-xs text-white focus:outline-none"
                  value={form.category ?? "general"}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, category: e.target.value as FaqCategory })
                  }
                >
                  {FAQ_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.published ?? false}
                  onChange={(e) => setForm((f) => f && { ...f, published: e.target.checked })}
                  className="accent-yellow-400"
                />
                Published
              </label>
            </div>
            {formError && <p className="mt-3 font-mono text-xs text-red-400">{formError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setForm(null)}
                className="rounded-lg border border-slate-700 px-4 py-1.5 font-mono text-xs text-slate-400 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={saving}
                className="rounded-lg border border-yellow-500/40 bg-yellow-500/20 px-4 py-1.5 font-mono text-xs text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
              >
                {saving ? "Saving…" : form.pageId ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-void-light/50 h-16 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-void-light/30 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-slate-500">No FAQs yet. Click + New to add one.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-white">{f.question}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-xs ${CATEGORY_COLORS[f.category]}`}
                    >
                      {f.category}
                    </span>
                    {f.locales.length > 0 && (
                      <span className="font-mono text-xs text-slate-600">
                        [{f.locales.join(", ")}]
                      </span>
                    )}
                  </div>
                  {f.answer && (
                    <p className="font-body mt-1 line-clamp-2 text-sm text-slate-400">{f.answer}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(f)}
                    className="rounded border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:border-slate-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(f.id)}
                    disabled={deleting === f.id}
                    className="rounded border border-red-900/40 px-2 py-1 font-mono text-xs text-red-500 hover:border-red-700/50 hover:text-red-400 disabled:opacity-40"
                  >
                    {deleting === f.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {items.length} FAQ{items.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
