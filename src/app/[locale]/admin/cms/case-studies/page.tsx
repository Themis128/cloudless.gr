"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { CaseStudy, CaseStudyInput, CaseStudyMetric } from "@/lib/notion-case-studies";

const EMPTY_FORM: CaseStudyInput & {
  metricsText?: string;
  tagsText?: string;
  servicesText?: string;
} = {
  title: "",
  slug: "",
  client: "",
  industry: "",
  services: [],
  servicesText: "",
  summary: "",
  challenge: "",
  solution: "",
  results: "",
  metrics: [],
  metricsText: "",
  coverImage: "",
  tags: [],
  tagsText: "",
  published: false,
  featured: false,
  date: new Date().toISOString().slice(0, 10),
};

type FormState = typeof EMPTY_FORM & { pageId?: string };

function parseMetrics(text: string): CaseStudyMetric[] {
  return text
    .split("\n")
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return parts.length >= 2 ? { label: parts[0], value: parts[1] } : null;
    })
    .filter((m): m is CaseStudyMetric => m !== null && Boolean(m.label));
}

export default function AdminCaseStudiesPage() {
  const [items, setItems] = useState<CaseStudy[]>([]);
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
      const res = await fetchWithAuth("/api/admin/notion/case-studies");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (((((await res.json()) as any)) as any)) as { caseStudies: CaseStudy[] };
      setItems(data.caseStudies ?? []);
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
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  };

  const openEdit = (cs: CaseStudy) => {
    setForm({
      pageId: cs.id,
      title: cs.title,
      slug: cs.slug,
      client: cs.client,
      industry: cs.industry,
      services: cs.services,
      servicesText: cs.services.join(", "),
      summary: cs.summary,
      challenge: cs.challenge,
      solution: cs.solution,
      results: cs.results,
      metrics: cs.metrics,
      metricsText: cs.metrics.map((m) => `${m.label} | ${m.value}`).join("\n"),
      coverImage: cs.coverImage ?? "",
      tags: cs.tags,
      tagsText: cs.tags.join(", "),
      published: cs.featured,
      featured: cs.featured,
      date: cs.date?.slice(0, 10) ?? "",
    });
    setFormError(null);
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { pageId, metricsText, tagsText, servicesText, ...input } = form;
      input.metrics = parseMetrics(metricsText ?? "");
      input.tags = (tagsText ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      input.services = (servicesText ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const method = pageId ? "PATCH" : "POST";
      const body = pageId ? { pageId, ...input } : input;
      const res = await fetchWithAuth("/api/admin/notion/case-studies", {
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
    if (!confirm("Archive this case study?")) return;
    setDeleting(pageId);
    try {
      const res = await fetchWithAuth(
        `/api/admin/notion/case-studies?pageId=${encodeURIComponent(pageId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((cs) => cs.id !== pageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CMS_CASE_STUDIES</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Case Studies</h1>
          <p className="font-body mt-1 text-slate-400">
            Manage client success stories and case studies.
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
            className="border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 rounded-lg border px-3 py-1.5 font-mono text-xs"
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
          <div className="bg-void-dark max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <h2 className="font-heading mb-4 text-lg font-bold text-white">
              {form.pageId ? "Edit Case Study" : "New Case Study"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(["title", "slug", "client", "industry", "date"] as const).map((k) => (
                <label
                  key={k}
                  className={`flex flex-col gap-1 ${k === "title" ? "col-span-2" : ""}`}
                >
                  <span className="font-mono text-xs text-slate-400 capitalize">
                    {k}
                    {k === "title" ? " *" : ""}
                  </span>
                  <input
                    type={k === "date" ? "date" : "text"}
                    className="bg-void font-body focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                    value={(form[k] as string) ?? ""}
                    onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label className="col-span-2 flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Services (comma-separated)</span>
                <input
                  type="text"
                  className="bg-void font-body focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.servicesText ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, servicesText: e.target.value })}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Tags (comma-separated)</span>
                <input
                  type="text"
                  className="bg-void font-body focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.tagsText ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, tagsText: e.target.value })}
                />
              </label>
              {(["summary", "challenge", "solution", "results"] as const).map((k) => (
                <label key={k} className="col-span-2 flex flex-col gap-1">
                  <span className="font-mono text-xs text-slate-400 capitalize">{k}</span>
                  <textarea
                    rows={3}
                    className="bg-void font-body focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                    value={(form[k] as string) ?? ""}
                    onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label className="col-span-2 flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">
                  Metrics (one per line: Label | Value)
                </span>
                <textarea
                  rows={3}
                  placeholder={"Cost reduction | 55%\nTime to results | 30 days"}
                  className="bg-void focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 font-mono text-xs text-white placeholder-slate-700 focus:outline-none"
                  value={form.metricsText ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, metricsText: e.target.value })}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="font-mono text-xs text-slate-400">Cover Image URL</span>
                <input
                  type="text"
                  className="bg-void font-body focus:border-neon-magenta rounded border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
                  value={form.coverImage ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, coverImage: e.target.value })}
                />
              </label>
              <div className="col-span-2 flex gap-4">
                {(["published", "featured"] as const).map((k) => (
                  <label
                    key={k}
                    className="flex items-center gap-2 font-mono text-xs text-slate-400"
                  >
                    <input
                      type="checkbox"
                      checked={(form[k] as boolean) ?? false}
                      onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.checked })}
                      className="accent-neon-magenta"
                    />
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </label>
                ))}
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
                className="border-neon-magenta/40 bg-neon-magenta/20 text-neon-magenta hover:bg-neon-magenta/30 rounded-lg border px-4 py-1.5 font-mono text-xs disabled:opacity-50"
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
              className="bg-void-light/50 h-24 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-void-light/30 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-slate-500">No case studies yet. Click + New to add one.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((cs) => (
            <div key={cs.id} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-white">{cs.title}</span>
                    {cs.client && (
                      <span className="font-mono text-xs text-slate-500">{cs.client}</span>
                    )}
                    {cs.industry && (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-xs text-slate-400">
                        {cs.industry}
                      </span>
                    )}
                    {cs.featured && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-xs text-yellow-400">
                        Featured
                      </span>
                    )}
                    {cs.date && (
                      <span className="font-mono text-xs text-slate-600">
                        {cs.date.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {cs.summary && (
                    <p className="font-body mt-1 line-clamp-1 text-sm text-slate-400">
                      {cs.summary}
                    </p>
                  )}
                  {cs.metrics.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-3">
                      {cs.metrics.map((m, i) => (
                        <span key={i} className="text-neon-magenta font-mono text-xs">
                          {m.label}: {m.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(cs)}
                    className="rounded border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:border-slate-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(cs.id)}
                    disabled={deleting === cs.id}
                    className="rounded border border-red-900/40 px-2 py-1 font-mono text-xs text-red-500 hover:border-red-700/50 hover:text-red-400 disabled:opacity-40"
                  >
                    {deleting === cs.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {items.length} case stud{items.length !== 1 ? "ies" : "y"}
        </p>
      )}
    </div>
  );
}
