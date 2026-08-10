"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useState } from "react";

/* Contract of POST /api/admin/ai/generate (Cloudflare Workers AI). */

interface GenerateResponse {
  success: boolean;
  result: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const MODELS = [
  { id: "@cf/meta/llama-3-8b-instruct", label: "Llama 3 (8B) — fast" },
  { id: "@cf/meta/llama-3-70b-instruct", label: "Llama 3 (70B) — slower, better" },
] as const;

export default function AiGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [usage, setUsage] = useState<GenerateResponse["usage"] | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setUsage(null);
    setCopied(false);
    try {
      const res = await fetchWithAuth("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model }),
      });
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      const data = (await res.json()) as Partial<GenerateResponse> & { error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to generate");
      }
      setResult(data.result ?? "");
      setUsage(data.usage ?? null);
    } catch (err) {
      <form onSubmit={generate} className="space-y-4">
        <div>
          <label htmlFor="prompt" className="mb-2 block font-mono text-xs text-slate-400">
            What would you like to generate?
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={4}
            placeholder='E.g., "Write a catchy tagline for a design tool"'
            className="bg-void-light/50 focus:ring-neon-cyan/50 w-full rounded-lg border border-slate-800 px-4 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="model" className="mb-2 block font-mono text-xs text-slate-400">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="bg-void-light/50 focus:ring-neon-cyan/50 w-full rounded-lg border border-slate-800 px-4 py-2 font-mono text-sm text-white focus:ring-2 focus:outline-none disabled:opacity-50"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 hover:bg-neon-cyan/20 w-full rounded-lg border px-4 py-2 font-mono text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      )}

      {result !== null && (
        <div className="bg-void-light/50 mt-4 rounded-xl border border-slate-800 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs text-slate-500">Generated result</p>
            {usage && (
              <p className="font-mono text-[10px] text-slate-600">
                {usage.inputTokens} in / {usage.outputTokens} out tokens
              </p>
            )}
          </div>
          <p className="font-mono text-sm whitespace-pre-wrap text-white">{result}</p>
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-neon-cyan mt-3 font-mono text-xs hover:underline"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
