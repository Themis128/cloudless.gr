"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

type StatusPayload = {
  configured: boolean;
  usage: {
    total: number;
    ok: number;
    errors: number;
    viaGateway: number;
    workersAiConfigured: boolean;
    aiGatewayConfigured: boolean;
    gatewayId: string | null;
    geminiConfigured: boolean;
    recent: Array<{
      at: string;
      ok: boolean;
      model: string;
      viaGateway: boolean;
      latencyMs: number;
      error?: string;
    }>;
  };
  vectorize: { configured: boolean };
  turnstile: { configured: boolean };
  espocrmQueue: { configured: boolean };
};

export default function AdminAiUsageCard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth("/api/admin/ai/status")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<StatusPayload>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-slate-800 bg-void-light/50 p-4 text-sm text-slate-400">
        AI status unavailable: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-void-light/50 p-4 text-sm text-slate-500">
        Loading AI usage…
      </div>
    );
  }

  const u = data.usage;
  const lastError = u.recent.find((r) => !r.ok);

  return (
    <div className="rounded-xl border border-slate-800 bg-void-light/50 p-4">
      <h2 className="mb-3 font-mono text-xs tracking-widest text-neon-cyan uppercase">
        AI usage / status
      </h2>
      <div className="grid gap-2 font-mono text-xs text-slate-300 sm:grid-cols-2">
        <p>
          Backend:{" "}
          <span className={data.configured ? "text-neon-green" : "text-neon-magenta"}>
            {data.configured ? "ready" : "not configured"}
          </span>
        </p>
        <p>
          Workers AI: {u.workersAiConfigured ? "on" : "off"} · Gateway:{" "}
          {u.aiGatewayConfigured ? `on (${u.gatewayId})` : "off"} · Gemini:{" "}
          {u.geminiConfigured ? "on" : "off"}
        </p>
        <p>
          Calls (this pod): {u.total} · ok {u.ok} · err {u.errors} · via gateway {u.viaGateway}
        </p>
        <p>
          Vectorize: {data.vectorize.configured ? "on" : "off"} · Turnstile:{" "}
          {data.turnstile.configured ? "on" : "off"} · Espo queue:{" "}
          {data.espocrmQueue.configured ? "on" : "off"}
        </p>
      </div>
      {lastError ? (
        <p className="mt-3 font-mono text-xs text-neon-magenta">
          Last error: {lastError.error ?? "unknown"} ({lastError.latencyMs}ms)
        </p>
      ) : null}
    </div>
  );
}
