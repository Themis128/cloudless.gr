"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Report } from "@/lib/reports";

const SECTION_OPTIONS = [
  { id: "pipeline", label: "Lead Pipeline (HubSpot)" },
  { id: "email", label: "Email Marketing (ActiveCampaign)" },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    dateStart: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    dateEnd: new Date().toISOString().split("T")[0],
    includeSections: ["pipeline", "email"],
  });

  async function loadReports() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/reports");
      if (!res.ok) return;
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetchWithAuth("/api/admin/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) return;
      setShowForm(false);
      await loadReports();
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this report?")) return;
    await fetchWithAuth(`/api/admin/reports/${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleSection(id: string) {
    setForm((f) => ({
      ...f,
      includeSections: f.includeSections.includes(id)
        ? f.includeSections.filter((s) => s !== id)
        : [...f.includeSections, id],
    }));
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">REPORTS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Client Reports</h1>
          <p className="font-body mt-1 text-slate-400">
            Generate performance reports combining data from all connected platforms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-4 py-2 font-mono text-xs transition-all"
        >
          + New Report
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <div className="border-neon-cyan h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="font-mono text-sm">Loading reports...</span>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 py-12 text-center">
          <p className="font-mono text-sm text-slate-600">No reports yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 font-mono text-xs text-slate-400 underline hover:text-white"
          >
            Generate your first report
          </button>
        </div>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <div
            key={r.id}
            className="bg-void-light/50 flex items-center justify-between rounded-xl border border-slate-800 px-5 py-4"
          >
            <div>
              <p className="font-mono text-sm font-semibold text-white">{r.clientName}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500">
                {r.dateRange.start} — {r.dateRange.end} · {r.sections.length} sections
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                  r.status === "ready"
                    ? "border-neon-green/30 text-neon-green"
                    : r.status === "generating"
                      ? "border-yellow-500/30 text-yellow-400"
                      : "border-red-500/30 text-red-400"
                }`}
              >
                {r.status}
              </span>
              {r.status === "ready" && (
                <Link
                  href={`/admin/reports/${r.id}`}
                  className="font-mono text-xs text-slate-400 hover:text-white transition-colors"
                >
                  View
                </Link>
              )}
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="font-mono text-xs text-slate-600 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-void w-full max-w-md rounded-xl border border-slate-700 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-sm font-semibold text-white">Generate New Report</h3>
              <button type="button" onClick={() => setShowForm(false)} className="font-mono text-slate-500 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Client Name</label>
                <input
                  required
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">Date Start</label>
                  <input
                    type="date"
                    required
                    value={form.dateStart}
                    onChange={(e) => setForm((f) => ({ ...f, dateStart: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">Date End</label>
                  <input
                    type="date"
                    required
                    value={form.dateEnd}
                    onChange={(e) => setForm((f) => ({ ...f, dateEnd: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">Sections</label>
                <div className="space-y-2">
                  {SECTION_OPTIONS.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.includeSections.includes(s.id)}
                        onChange={() => toggleSection(s.id)}
                        className="rounded border-slate-600"
                      />
                      <span className="font-mono text-xs text-slate-300">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={generating}
                  className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 flex-1 rounded-lg border px-4 py-2 font-mono text-xs transition-all disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
