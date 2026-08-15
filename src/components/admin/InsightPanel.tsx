"use client";

/**
 * Surfaces a pre-computed datalake gold insight for a given domain.
 * Fetches once on mount; collapses gracefully when the insight isn't ready.
 */
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { DatalakeInsight } from "@/lib/datalake-insights";

interface Props {
  domain: "seo" | "revenue" | "crm_funnel" | "ads" | "ops_errors" | "executive" | "orchestration";
}

export function InsightPanel({ domain }: Props) {
  const [insight, setInsight] = useState<DatalakeInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`/api/admin/insights/${domain}`)
      .then((r) => (r.ok ? (r.json() as Promise<DatalakeInsight>) : null))
      .then((data) => {
        if (data && data.summary && !data.error) setInsight(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domain]);

  const [now] = useState<number>(() => Date.now());

  const ts = insight?.generated_at;
  let age: string | null = null;
  if (ts) {
    const mins = Math.round((now - new Date(ts).getTime()) / 60000);
    if (mins < 60) age = `${mins}m ago`;
    else if (mins < 1440) age = `${Math.round(mins / 60)}h ago`;
    else age = `${Math.round(mins / 1440)}d ago`;
  }

  if (loading) return null;
  if (!insight) return null;

  return (
    <div className="mb-6 rounded-xl border border-neon-green/20 bg-neon-green/5 px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest text-neon-green/70 uppercase">
          AI Insight
        </span>
        {age && (
          <span className="font-mono text-[10px] text-slate-600">{age}</span>
        )}
        {insight.confidence && (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${
              insight.confidence === "high"
                ? "bg-neon-green/10 text-neon-green/70"
                : insight.confidence === "medium"
                  ? "bg-yellow-400/10 text-yellow-400/70"
                  : "bg-slate-700/50 text-slate-500"
            }`}
          >
            {insight.confidence}
          </span>
        )}
      </div>
      <p className="mb-3 text-sm text-slate-200">{insight.summary}</p>
      {insight.bullets.length > 0 && (
        <ul className="space-y-1">
          {insight.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 font-mono text-xs text-slate-400">
              <span className="mt-0.5 shrink-0 text-neon-green/50">▸</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      {insight.metrics_cited.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {insight.metrics_cited.slice(0, 5).map((m) => (
            <span key={m.key} className="font-mono text-[10px] text-slate-600">
              {m.key.replace(/_/g, " ")}: <span className="text-slate-400">{String(m.value ?? "—")}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
