"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { ABFlag } from "@/lib/ab-flags";

function Toggle({
  checked,
  onChange,
}: Readonly<{
  checked: boolean;
  onChange: (v: boolean) => void;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-neon-green/80" : "bg-slate-700"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function ABTestsPage() {
  const [flags, setFlags] = useState<ABFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/ab-tests");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlags(data.flags ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function updateFlag(id: string, patch: Partial<ABFlag>) {
    setSaving(id);
    setError(null);
    setWarning(null);
    try {
      const res = await fetchWithAuth("/api/admin/ab-tests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlags(data.flags ?? flags);
      if (data.warning) setWarning(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  function setTrafficSplit(id: string, value: number) {
    setFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, trafficSplit: value } : f)),
    );
  }

  async function resetAll() {
    setSaving("reset");
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlags(data.flags ?? flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(null);
    }
  }

  const activeCount = flags.filter((f) => f.enabled).length;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-yellow/10 border-neon-yellow/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-yellow h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-yellow font-mono text-xs">
              A/B TESTS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            A/B Test Manager
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Toggle feature flags and traffic splits for live experiments.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={saving === "reset"}
            className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 px-4 py-3">
          <div className="font-mono text-xl font-bold text-white">
            {flags.length}
          </div>
          <div className="font-mono text-xs text-slate-500">Total flags</div>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 px-4 py-3">
          <div className="text-neon-green font-mono text-xl font-bold">
            {activeCount}
          </div>
          <div className="font-mono text-xs text-slate-500">Active tests</div>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 px-4 py-3">
          <div className="text-slate-400 font-mono text-xl font-bold">
            {flags.length - activeCount}
          </div>
          <div className="font-mono text-xs text-slate-500">Inactive</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {warning && (
        <div className="mb-4 rounded-lg border border-yellow-900/30 bg-yellow-950/10 px-4 py-3 font-mono text-xs text-yellow-400">
          {warning}
        </div>
      )}

      {loading && flags.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-void-light/30 h-28 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="bg-void-light/50 rounded-xl border border-slate-800 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-heading font-semibold text-white">
                    {flag.name}
                  </span>
                  <span
                    className={`font-mono text-xs ${flag.enabled ? "text-neon-green" : "text-slate-600"}`}
                  >
                    {flag.enabled ? "LIVE" : "OFF"}
                  </span>
                </div>
                <p className="font-body mt-1 text-sm text-slate-400">
                  {flag.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="rounded-lg border border-slate-700 px-3 py-1.5">
                    <div className="font-mono text-xs text-slate-500">
                      Variant A
                    </div>
                    <div className="font-mono text-xs text-white">
                      {flag.variants.a}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neon-yellow/20 bg-neon-yellow/5 px-3 py-1.5">
                    <div className="font-mono text-xs text-neon-yellow">
                      Variant B ({flag.trafficSplit}% traffic)
                    </div>
                    <div className="font-mono text-xs text-white">
                      {flag.variants.b}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <Toggle
                  checked={flag.enabled}
                  onChange={(v) => updateFlag(flag.id, { enabled: v })}
                />
                {saving === flag.id && (
                  <span className="font-mono text-xs text-slate-500">
                    Saving…
                  </span>
                )}
              </div>
            </div>

            {/* Traffic split slider */}
            <div className="mt-4 flex items-center gap-3">
              <span className="font-mono text-xs text-slate-500 w-16">
                Split: {flag.trafficSplit}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={flag.trafficSplit}
                onChange={(e) =>
                  setTrafficSplit(flag.id, Number(e.target.value))
                }
                onMouseUp={(e) =>
                  updateFlag(flag.id, {
                    trafficSplit: Number((e.target as HTMLInputElement).value),
                  })
                }
                className="flex-1 accent-neon-yellow h-1.5 cursor-pointer rounded-full"
              />
              <span className="font-mono text-xs text-slate-500 w-16 text-right">
                B: {flag.trafficSplit}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
