"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useState } from "react";

export default function AdminSettingsPage() {
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function handleClearCache(prefix?: string) {
    setCacheClearing(true);
    setCacheMsg(null);
    try {
      const res = await fetchWithAuth("/api/admin/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCacheMsg({
        ok: true,
        text: `Cache cleared: ${data.clearedPrefix} at ${new Date(data.clearedAt).toLocaleTimeString("en-IE")}`,
      });
    } catch (err) {
      setCacheMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to clear cache",
      });
    } finally {
      setCacheClearing(false);
      setTimeout(() => setCacheMsg(null), 5000);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">SETTINGS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Site Settings
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Configure your Cloudless platform settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Cache Management */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-1 font-semibold text-white">
            Cache Management
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            The Notion in-memory cache speeds up page loads. Clear it after
            manual Notion changes.
          </p>

          {cacheMsg && (
            <div
              className={`mb-4 rounded-lg border px-4 py-2 font-mono text-xs ${cacheMsg.ok ? "border-neon-green/20 bg-neon-green/5 text-neon-green" : "border-red-900/30 bg-red-950/10 text-red-400"}`}
            >
              {cacheMsg.ok ? "✓" : "✗"} {cacheMsg.text}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cacheClearing}
              onClick={() => handleClearCache()}
              className="min-h-[40px] rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
            >
              {cacheClearing ? "Clearing…" : "Clear All Caches"}
            </button>
            {["blog", "forms", "projects"].map((prefix) => (
              <button
                key={prefix}
                type="button"
                disabled={cacheClearing}
                onClick={() => handleClearCache(prefix)}
                className="min-h-[40px] rounded-lg border border-slate-800 px-3 py-2 font-mono text-xs text-slate-500 transition-all hover:border-slate-700 hover:text-slate-300 disabled:opacity-50"
              >
                Clear {prefix}
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6">
          <h2 className="font-heading mb-2 font-semibold text-red-400">
            Danger Zone
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Irreversible actions. Proceed with caution.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-red-900/50 px-4 py-2.5 font-mono text-xs text-red-400 transition-all hover:bg-red-950/30"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete all Notion cache? Active requests will re-fetch.",
                  )
                ) {
                  handleClearCache();
                }
              }}
            >
              Force-flush All Caches
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
