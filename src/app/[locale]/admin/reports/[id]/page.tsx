"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Report } from "@/lib/reports";

export default function ReportViewPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/reports/${id}`);
      if (!res.ok) {
        setError("Report not found.");
        return;
      }
      const data = await res.json();
      setReport(data.report);
    } catch {
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-400">
        <div className="border-neon-cyan h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="font-mono text-sm">Loading report...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/admin/reports" className="font-mono text-xs text-slate-500 hover:text-slate-300">
            ← Reports
          </Link>
        </div>
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
          {error ?? "Report not found."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/reports" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          ← Reports
        </Link>
      </div>

      <div className="mb-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">REPORT</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">{report.clientName}</h1>
        <p className="font-body mt-1 text-slate-400">
          {report.dateRange.start} — {report.dateRange.end}
        </p>
      </div>

      <div className="space-y-6">
        {report.sections.map((section) => (
          <div key={section.id} className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
            <h2 className="font-heading mb-4 font-semibold text-white">{section.title}</h2>

            {section.insights && (
              <div className="border-neon-cyan/20 bg-neon-cyan/5 mb-4 rounded-lg border p-4">
                <p className="text-neon-cyan mb-1 font-mono text-[10px] uppercase tracking-wider">
                  AI Insights
                </p>
                <p className="font-mono text-xs text-slate-300">{section.insights}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(section.data).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="font-mono text-[10px] text-slate-500">
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-white">
                    {typeof value === "number"
                      ? value.toLocaleString()
                      : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {report.sections.length === 0 && (
          <div className="rounded-xl border border-slate-800 py-12 text-center">
            <p className="font-mono text-sm text-slate-600">No sections in this report.</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 hover:text-white transition-colors"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
