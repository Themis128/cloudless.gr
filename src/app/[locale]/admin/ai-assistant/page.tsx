"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useState } from "react";

type Mode = "strategy" | "copy";

interface CopyVariant {
  headline: string;
  body: string;
  cta: string;
  tone: string;
}

export default function AIAssistantPage() {
  const [mode, setMode] = useState<Mode>("strategy");

  // Strategy
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [strategy, setStrategy] = useState<Record<string, unknown> | null>(null);

  // Copy
  const [service, setService] = useState("");
  const [platform, setPlatform] = useState("Meta");
  const [objective, setObjective] = useState("awareness");
  const [language, setLanguage] = useState("English");
  const [copyVariants, setCopyVariants] = useState<CopyVariant[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateStrategy(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStrategy(null);
    try {
      const res = await fetchWithAuth("/api/admin/ai/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, budget, targetAudience }),
      });
      if (res.status === 503) {
        setError("ANTHROPIC_API_KEY is not configured in AWS SSM.");
        return;
      }
      if (!res.ok) throw new Error("Failed to generate strategy");
      const data = await res.json();
      setStrategy(data.strategy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateCopy(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCopyVariants(null);
    try {
      const res = await fetchWithAuth("/api/admin/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, platform, objective, language }),
      });
      if (res.status === 503) {
        setError("ANTHROPIC_API_KEY is not configured in AWS SSM.");
        return;
      }
      if (!res.ok) throw new Error("Failed to generate copy");
      const data = await res.json();
      setCopyVariants(data.variants?.variants ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">AI ASSISTANT</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">AI Campaign Assistant</h1>
        <p className="font-body mt-1 text-slate-400">
          Generate campaign strategies and ad copy with Claude AI.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {(["strategy", "copy"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 rounded-md px-3 py-2 font-mono text-xs capitalize transition-all ${
              mode === m ? "bg-neon-magenta/10 text-neon-magenta" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {m === "strategy" ? "Campaign Strategy" : "Ad Copy Generator"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {mode === "strategy" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={generateStrategy} className="bg-void-light/50 space-y-4 rounded-xl border border-slate-800 p-6">
            <h2 className="font-mono text-sm font-semibold text-white">Campaign Brief</h2>
            <div>
              <label className="mb-1 block font-mono text-xs text-slate-400">What do you want to promote?</label>
              <textarea
                required
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="e.g. AI marketing services for Greek SMBs, focusing on lead generation"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Monthly Budget</label>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. €1,000/month"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Target Audience</label>
                <input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Greek SMB owners, 30-55"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 w-full rounded-lg border px-4 py-2.5 font-mono text-xs transition-all disabled:opacity-50"
            >
              {loading ? "Generating strategy..." : "Generate Strategy"}
            </button>
          </form>

          {strategy && (
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
              <h2 className="mb-4 font-mono text-sm font-semibold text-white">Strategy</h2>
              <StrategyDisplay strategy={strategy} />
            </div>
          )}
        </div>
      )}

      {mode === "copy" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={generateCopy} className="bg-void-light/50 space-y-4 rounded-xl border border-slate-800 p-6">
            <h2 className="font-mono text-sm font-semibold text-white">Ad Copy Brief</h2>
            <div>
              <label className="mb-1 block font-mono text-xs text-slate-400">Service / Product</label>
              <input
                required
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. AI-powered social media management"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                >
                  {["Meta", "LinkedIn", "TikTok", "X", "Google"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Objective</label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                >
                  {["awareness", "lead_generation", "conversions", "traffic", "engagement"].map((o) => (
                    <option key={o} value={o}>{o.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-slate-400">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Greek">Greek</option>
                <option value="English and Greek">English and Greek</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 w-full rounded-lg border px-4 py-2.5 font-mono text-xs transition-all disabled:opacity-50"
            >
              {loading ? "Generating copy..." : "Generate 5 Copy Variants"}
            </button>
          </form>

          {copyVariants && (
            <div className="space-y-3">
              {copyVariants.map((v, i) => (
                <div key={i} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">Variant {i + 1}</span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      {v.tone}
                    </span>
                  </div>
                  {v.headline && (
                    <p className="text-neon-cyan mb-1 font-mono text-sm font-semibold">{v.headline}</p>
                  )}
                  <p className="font-mono text-xs text-slate-300">{v.body}</p>
                  <p className="mt-2 font-mono text-xs font-bold text-white">{v.cta}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StrategyDisplay({ strategy }: { strategy: Record<string, unknown> }) {
  if (strategy.raw) {
    return <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{String(strategy.raw)}</pre>;
  }

  const platforms = (strategy.recommended_platforms as string[]) ?? [];
  const budgetSplit = (strategy.budget_split as Record<string, number>) ?? {};
  const copySuggestions = strategy.copy_suggestions as {
    headline?: string[];
    body?: string[];
    cta?: string[];
  } | undefined;

  return (
    <div className="space-y-4">
      {platforms.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs text-slate-500">Recommended Platforms</p>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <span key={p} className="border-neon-cyan/30 text-neon-cyan rounded-full border px-2 py-0.5 font-mono text-xs">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {Boolean(strategy.campaign_objective) && (
        <div>
          <p className="mb-1 font-mono text-xs text-slate-500">Objective</p>
          <p className="font-mono text-sm text-white">{String(strategy.campaign_objective)}</p>
        </div>
      )}
      {Object.keys(budgetSplit).length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs text-slate-500">Budget Split</p>
          <div className="space-y-1">
            {Object.entries(budgetSplit).map(([p, pct]) => (
              <div key={p} className="flex items-center gap-3">
                <span className="w-24 font-mono text-xs text-slate-400">{p}</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800">
                  <div
                    className="bg-neon-magenta h-1.5 rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-white">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {Boolean(strategy.timeline) && (
        <div>
          <p className="mb-1 font-mono text-xs text-slate-500">Timeline</p>
          <p className="font-mono text-xs text-white">{String(strategy.timeline)}</p>
        </div>
      )}
      {copySuggestions?.headline && (
        <div>
          <p className="mb-2 font-mono text-xs text-slate-500">Headline Suggestions</p>
          <ul className="space-y-1">
            {copySuggestions.headline.map((h, i) => (
              <li key={i} className="font-mono text-xs text-slate-300">
                {i + 1}. {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
