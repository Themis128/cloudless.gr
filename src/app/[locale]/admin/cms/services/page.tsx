"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { CloudlessService, ServiceInput, ServiceCategory } from "@/lib/notion-services";

const SERVICE_CATEGORIES: ServiceCategory[] = ["audit", "devops", "consulting", "training"];

const EMPTY_FORM: ServiceInput = {
  name: "",
  slug: "",
  description: "",
  price: "",
  category: "consulting",
  features: [],
  cta: "Learn more",
  icon: "☁️",
  stripePriceId: "",
  published: false,
  order: undefined,
};

type FormState = ServiceInput & { pageId?: string; featuresText?: string };

export default function AdminServicesPage() {
  const [items, setItems] = useState<CloudlessService[]>([]);
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
      const res = await fetchWithAuth("/api/admin/appflowy/services");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (((((await res.json()) as any)) as any)) as { services: CloudlessService[] };
      setItems(data.services ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {}); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, featuresText: "" });
    setFormError(null);
  };

  const openEdit = (s: CloudlessService) => {
    setForm({
      pageId: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      price: s.price,
      category: s.category,
      features: s.features,
      featuresText: s.features.join("\n"),
      cta: s.cta,
      icon: s.icon,
      stripePriceId: s.stripePriceId ?? "",
      published: true,
    });
    setFormError(null);
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { pageId, featuresText, ...input } = form;
      input.features = (featuresText ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const method = pageId ? "PATCH" : "POST";
      const body = pageId ? { pageId, ...input } : input;
      const res = await fetchWithAuth("/api/admin/appflowy/services", {
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
    if (!confirm("Archive this service?")) return;
    setDeleting(pageId);
    try {
      const res = await fetchWithAuth(
        `/api/admin/appflowy/services?pageId=${encodeURIComponent(pageId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((s) => s.id !== pageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const CATEGORY_COLORS: Record<ServiceCategory, string> = {
    audit: "border-neon-magenta/30 text-neon-magenta",
    devops: "border-neon-cyan/30 text-neon-cyan",
    consulting: "border-neon-green/30 text-neon-green",
    training: "border-yellow-500/30 text-yellow-400",
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">CMS_SERVICES</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Services</h1>
          <p className="font-body mt-1 text-slate-400">
            Manage the service catalog shown on the services page.
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
            className="border-neon-green/30 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 rounded-lg border px-3 py-1.5 font-mono text-xs"
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

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-void-dark max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <h2 className="font-heading mb-4 text-lg font-bold text-white">
              {form.pageId ? "Edit Service" : "New Service"}
            </h2>
            <div className="space-y-3">
              {(["name", "slug", "price", "icon", "cta"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-slate-400 capitalize">
                    {k}
                    {k === "name" ? " *" : ""}
                  </span>
                  <input
                    type="text"
                    className="bg-void font-body focus:border-neon-green rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                    value={(form[k] as string) ?? ""}
                    onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Description</span>
                <textarea
                  rows={3}
                  className="bg-void font-body focus:border-neon-green rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Features (one per line)</span>
                <textarea
                  rows={4}
                  className="bg-void font-body focus:border-neon-green rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.featuresText ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, featuresText: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Category</span>
                <select
                  className="bg-void rounded border border-slate-700 px-3 py-1.5 font-mono text-xs text-white focus:outline-none"
                  value={form.category ?? "consulting"}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, category: e.target.value as ServiceCategory })
                  }
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Stripe Price ID</span>
                <input
                  type="text"
                  className="bg-void font-body focus:border-neon-green rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.stripePriceId ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, stripePriceId: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.published ?? false}
                  onChange={(e) => setForm((f) => f && { ...f, published: e.target.checked })}
                  className="accent-neon-green"
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
                className="border-neon-green/40 bg-neon-green/20 text-neon-green hover:bg-neon-green/30 rounded-lg border px-4 py-1.5 font-mono text-xs disabled:opacity-50"
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
              className="bg-void-light/50 h-20 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-void-light/30 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-slate-500">No services yet. Click + New to add one.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{s.icon}</span>
                    <span className="font-heading font-semibold text-white">{s.name}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-xs ${CATEGORY_COLORS[s.category]}`}
                    >
                      {s.category}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{s.price}</span>
                    {s.slug && <span className="font-mono text-xs text-slate-600">/{s.slug}</span>}
                  </div>
                  {s.description && (
                    <p className="font-body mt-1 line-clamp-1 text-sm text-slate-400">
                      {s.description}
                    </p>
                  )}
                  {s.features.length > 0 && (
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {s.features.length} features
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(s)}
                    className="rounded border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:border-slate-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(s.id)}
                    disabled={deleting === s.id}
                    className="rounded border border-red-900/40 px-2 py-1 font-mono text-xs text-red-500 hover:border-red-700/50 hover:text-red-400 disabled:opacity-40"
                  >
                    {deleting === s.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {items.length} service{items.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
