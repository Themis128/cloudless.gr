"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { Testimonial, TestimonialInput } from "@/lib/appflowy-testimonials";

const EMPTY_FORM: TestimonialInput = {
  name: "",
  company: "",
  role: "",
  quote: "",
  avatar: "",
  service: "",
  rating: undefined,
  featured: false,
  published: false,
  order: undefined,
};

type FormState = TestimonialInput & { pageId?: string };

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
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
      const res = await fetchWithAuth("/api/admin/appflowy/testimonials");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { testimonials: Testimonial[] };
      setItems(data.testimonials ?? []);
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

  const openEdit = (t: Testimonial) => {
    setForm({
      pageId: t.id,
      name: t.name,
      company: t.company,
      role: t.role,
      quote: t.quote,
      avatar: t.avatar ?? "",
      service: t.service ?? "",
      rating: t.rating,
      featured: t.featured,
      published: true,
    });
    setFormError(null);
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.quote.trim()) {
      setFormError("Name and Quote are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { pageId, ...input } = form;
      const method = pageId ? "PATCH" : "POST";
      const body = pageId ? { pageId, ...input } : input;
      const res = await fetchWithAuth("/api/admin/appflowy/testimonials", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
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
    if (!confirm("Archive this testimonial?")) return;
    setDeleting(pageId);
    try {
      const res = await fetchWithAuth(
        `/api/admin/appflowy/testimonials?pageId=${encodeURIComponent(pageId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((t) => t.id !== pageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const field = (key: keyof TestimonialInput, label: string, type: string = "text") => (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs text-slate-400">{label}</span>
      <input
        type={type}
        className="bg-void font-body focus:border-neon-cyan rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
        value={(form?.[key] as string) ?? ""}
        onChange={(e) => setForm((f) => f && { ...f, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">CMS_TESTIMONIALS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Testimonials</h1>
          <p className="font-body mt-1 text-slate-400">
            Manage customer testimonials shown on the site.
          </p>
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
            className="bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-3 py-1.5 font-mono text-xs"
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
              {form.pageId ? "Edit Testimonial" : "New Testimonial"}
            </h2>
            <div className="space-y-3">
              {field("name", "Name *")}
              {field("quote", "Quote *")}
              {field("company", "Company")}
              {field("role", "Role")}
              {field("service", "Service")}
              {field("avatar", "Avatar URL")}
              {field("rating", "Rating (1–5)", "number")}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={form.featured ?? false}
                    onChange={(e) => setForm((f) => f && { ...f, featured: e.target.checked })}
                    className="accent-neon-cyan"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={form.published ?? false}
                    onChange={(e) => setForm((f) => f && { ...f, published: e.target.checked })}
                    className="accent-neon-cyan"
                  />
                  Published
                </label>
              </div>
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
                className="bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/30 rounded-lg border px-4 py-1.5 font-mono text-xs disabled:opacity-50"
              >
                {saving ? "Saving…" : form.pageId ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-void-light/50 h-20 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="bg-void-light/30 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-slate-500">No testimonials yet. Click + New to add one.</p>
        </div>
      )}

      {/* List */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-white">{t.name}</span>
                    {t.company && (
                      <span className="font-mono text-xs text-slate-500">{t.company}</span>
                    )}
                    {t.role && <span className="font-mono text-xs text-slate-600">· {t.role}</span>}
                    {t.featured && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-xs text-yellow-400">
                        Featured
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                        t.featured
                          ? "border-neon-green/30 bg-neon-green/10 text-neon-green"
                          : "border-slate-700 bg-slate-800/50 text-slate-500"
                      }`}
                    >
                      {t.featured ? "Published" : "Draft"}
                    </span>
                    {t.rating != null && (
                      <span className="font-mono text-xs text-yellow-400">
                        {"★".repeat(t.rating)}
                      </span>
                    )}
                  </div>
                  <p className="font-body mt-1 line-clamp-2 text-sm text-slate-400">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {t.service && (
                    <span className="mt-1 inline-block font-mono text-xs text-slate-600">
                      {t.service}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(t)}
                    className="rounded border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:border-slate-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(t.id)}
                    disabled={deleting === t.id}
                    className="rounded border border-red-900/40 px-2 py-1 font-mono text-xs text-red-500 hover:border-red-700/50 hover:text-red-400 disabled:opacity-40"
                  >
                    {deleting === t.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {items.length} testimonial{items.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
