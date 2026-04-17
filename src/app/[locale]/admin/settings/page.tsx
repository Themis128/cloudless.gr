/**
 * Admin - Settings page
 *
 * Provides operational controls for the admin panel:
 *
 * - Cache management: buttons to flush the in-memory Notion cache via
 *   POST /api/admin/cache, either globally or scoped to a named prefix
 *   ("blog", "forms", "projects").
 *
 * - Preferences: placeholder save form (currently client-only; no
 *   persistence backend - extend as needed).
 *
 * @module admin/settings
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useState } from "react";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

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

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            General
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-xs text-slate-500">
                Site Name
              </label>
              <input
                type="text"
                defaultValue="Cloudless"
                className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-xs text-slate-500">
                Support Email
              </label>
              <input
                type="email"
                defaultValue="tbaltzakis@cloudless.gr"
                className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            Team Notifications
          </h2>
          <div className="space-y-3">
            {[
              {
                id: "notify-orders",
                label: "New orders",
                desc: "Notify the team when a new order is placed",
                defaultChecked: true,
              },
              {
                id: "notify-signups",
                label: "New sign-ups",
                desc: "Notify the team when a new user registers",
                defaultChecked: true,
              },
              {
                id: "notify-failures",
                label: "Payment failures",
                desc: "Alert when a payment fails",
                defaultChecked: true,
              },
              {
                id: "notify-contact",
                label: "Contact form submissions",
                desc: "Forward contact form messages to the team",
                defaultChecked: true,
              },
            ].map((pref) => (
              <label
                key={pref.id}
                className="bg-void flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700"
              >
                <input
                  type="checkbox"
                  defaultChecked={pref.defaultChecked}
                  className="accent-neon-magenta mt-1"
                />
                <div>
                  <span className="block font-mono text-sm text-white">
                    {pref.label}
                  </span>
                  <span className="text-xs text-slate-500">{pref.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

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

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="bg-neon-magenta/10 border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/20 min-h-[44px] rounded-lg border px-6 py-2.5 font-mono text-sm font-semibold transition-all hover:shadow-[0_0_25px_rgba(255,0,255,0.2)]"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-neon-green animate-fade-in-up font-mono text-xs">
              ✓ Settings saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
