"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useRef, useState } from "react";

interface VoiceBrief {
  text: string;
  generatedAt: string;
  week: string;
}

export default function VoiceBriefPage() {
  const [brief, setBrief] = useState<VoiceBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/voice-brief");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBrief(data.brief ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/voice-brief", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.brief) setBrief(data.brief);
      else throw new Error(data.error ?? "Generation failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function playBrief() {
    if (!brief || !globalThis.speechSynthesis) return;
    if (playing) {
      globalThis.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(brief.text);
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = "en-US";
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utteranceRef.current = u;
    globalThis.speechSynthesis.speak(u);
    setPlaying(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      globalThis.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="border-neon-blue/20 bg-neon-blue/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-blue font-mono text-xs">
              AI VOICE BRIEF
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Weekly Voice Brief
          </h1>
          <p className="font-body mt-1 text-slate-400">
            AI-generated spoken summary of your KPIs — powered by Claude.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="rounded-lg border border-neon-blue/30 px-4 py-2 font-mono text-xs text-neon-blue transition hover:border-neon-blue/60 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Now"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && !brief && (
        <div className="bg-void-light/30 h-48 animate-pulse rounded-xl border border-slate-800" />
      )}

      {!loading && !brief && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 px-6 py-12 text-center">
          <div className="mb-3 text-4xl">🎙️</div>
          <p className="font-heading text-sm text-slate-400">
            No brief generated yet.
          </p>
          <p className="font-mono mt-1 text-xs text-slate-600">
            Click Generate Now to create your first AI voice brief.
          </p>
        </div>
      )}

      {brief && (
        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-slate-500">
              Week: <span className="text-white">{brief.week}</span>
            </span>
            <span className="font-mono text-xs text-slate-500">
              Generated:{" "}
              <span className="text-white">
                {new Date(brief.generatedAt).toLocaleString("en-IE")}
              </span>
            </span>
          </div>

          {/* Player */}
          <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
            <div className="mb-4 flex items-center gap-4">
              <button
                type="button"
                onClick={playBrief}
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border transition ${
                  playing
                    ? "border-neon-blue/50 bg-neon-blue/10 text-neon-blue"
                    : "border-slate-700 bg-slate-800 text-white hover:border-neon-blue/40"
                }`}
              >
                {playing ? "⏹" : "▶"}
              </button>
              <div>
                <div className="font-heading text-sm font-semibold text-white">
                  {playing ? "Playing…" : "Play Brief"}
                </div>
                <div className="font-mono text-xs text-slate-500">
                  Browser speech synthesis
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="rounded-lg border border-slate-700 bg-void/50 p-4">
              <div className="font-mono mb-2 text-xs uppercase tracking-widest text-slate-500">
                Transcript
              </div>
              <p className="font-body leading-relaxed text-slate-300">
                {brief.text}
              </p>
            </div>
          </div>

          <p className="font-mono text-xs text-slate-600">
            Briefs are auto-generated weekly via the /api/cron/voice-brief
            endpoint. Schedule it in vercel.json.
          </p>
        </div>
      )}
    </div>
  );
}
