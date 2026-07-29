"use client";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

type ConfigRow = { key: string; description: string | null; updated_at: number };

export default function AdminSettingsPage() {
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [configs, setConfigs] = useState<ConfigRow[] | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadConfigs = useCallback(async () => {
    setConfigError(null);
    try {
      const res = await fetchWithAuth("/api/admin/config");
      const data = (await res.json()) as {
        configured?: boolean;
        configs?: ConfigRow[];
        error?: string;
      };
      if (res.status === 503) {
        setConfigs([]);
        setConfigError(data.error ?? "AUTH_DB not bound — D1 app_config unavailable");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfigs(data.configs ?? []);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to load app_config");
      setConfigs([]);
    }
  }, []);

  useEffect(() => {
    loadConfigs().catch(() => {}); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadConfigs]);

  async function handleSaveConfig() {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const res = await fetchWithAuth("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editKey.trim(), value: editValue }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfigMsg({ ok: true, text: `Saved ${editKey.trim()}` });
      setEditValue("");
      await loadConfigs();
    } catch (err) {
      setConfigMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg(null), 5000);
    }
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
      interface CacheClearResponse {
        error?: string;
        clearedPrefix?: string;
        clearedAt?: string;
      }
      const data = (await res.json()) as CacheClearResponse;
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const timestamp = data.clearedAt
        ? new Date(data.clearedAt).toLocaleTimeString("en-IE")
        : "now";
      setCacheMsg({ ok: true, text: `Cache cleared: ${data.clearedPrefix} at ${timestamp}` });
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
      {" "}
      <div className="mb-8">
        {" "}
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          {" "}
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />{" "}
          <span className="text-neon-magenta font-mono text-xs">SETTINGS</span>{" "}
        </div>{" "}
        <h1 className="font-heading text-2xl font-bold text-white">Site Settings</h1>{" "}
        <p className="font-body mt-1 text-slate-400">
          Configure your Cloudless platform settings.
        </p>{" "}
      </div>{" "}
      <div className="space-y-6">
        {" "}
        {/* Cache Management */}{" "}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          {" "}
          <h2 className="font-heading mb-1 font-semibold text-white">Cache Management</h2>{" "}
          <p className="mb-4 text-xs text-slate-500">
            {" "}
            The Notion in-memory cache speeds up page loads. Clear it after manual Notion
            changes.{" "}
          </p>{" "}
          {cacheMsg && (
            <div
              className={`mb-4 rounded-lg border px-4 py-2 font-mono text-xs ${cacheMsg.ok ? "border-neon-green/20 bg-neon-green/5 text-neon-green" : "border-red-900/30 bg-red-950/10 text-red-400"}`}
            >
              {" "}
              {cacheMsg.ok ? "✓" : "✗"} {cacheMsg.text}{" "}
            </div>
          )}{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            <button
              type="button"
              disabled={cacheClearing}
              onClick={() => handleClearCache()}
              className="min-h-[40px] rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
            >
              {" "}
              {cacheClearing ? "Clearing…" : "Clear All Caches"}{" "}
            </button>{" "}
            {["blog", "forms", "projects"].map((prefix) => (
              <button
                key={prefix}
                type="button"
                disabled={cacheClearing}
                onClick={() => handleClearCache(prefix)}
                className="min-h-[40px] rounded-lg border border-slate-800 px-3 py-2 font-mono text-xs text-slate-500 transition-all hover:border-slate-700 hover:text-slate-300 disabled:opacity-50"
              >
                {" "}
                Clear {prefix}{" "}
              </button>
            ))}{" "}
          </div>{" "}
        </div>{" "}
        {/* D1 app_config */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-1 font-semibold text-white">D1 App Config</h2>
          <p className="mb-4 text-xs text-slate-500">
            Non-secret keys in Cloudflare D1 <code className="text-slate-400">app_config</code>.
            Secrets stay in Wrangler / k8s — blocked keys return 403.
          </p>
          {configError && (
            <div className="mb-4 rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-2 font-mono text-xs text-amber-300">
              {configError}
            </div>
          )}
          {configMsg && (
            <div
              className={`mb-4 rounded-lg border px-4 py-2 font-mono text-xs ${
                configMsg.ok
                  ? "border-neon-green/20 bg-neon-green/5 text-neon-green"
                  : "border-red-900/30 bg-red-950/10 text-red-400"
              }`}
            >
              {configMsg.ok ? "✓" : "✗"} {configMsg.text}
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value.toUpperCase())}
              placeholder="KEY_NAME"
              className="min-h-[40px] min-w-[12rem] flex-1 rounded-lg border border-slate-700 bg-void px-3 font-mono text-xs text-white"
            />
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="value"
              className="min-h-[40px] min-w-[12rem] flex-[2] rounded-lg border border-slate-700 bg-void px-3 font-mono text-xs text-white"
            />
            <button
              type="button"
              disabled={configSaving || !editKey.trim() || editValue === ""}
              onClick={() => {
                handleSaveConfig().catch(() => {});
              }}
              className="min-h-[40px] rounded-lg border border-neon-cyan/40 px-4 py-2 font-mono text-xs text-neon-cyan transition-all hover:border-neon-cyan disabled:opacity-50"
            >
              {configSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {configs && configs.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {configs.map((row) => (
                <li key={row.key} className="flex gap-2 border-b border-slate-800/80 py-1">
                  <button
                    type="button"
                    className="text-left text-neon-cyan hover:underline"
                    onClick={() => setEditKey(row.key)}
                  >
                    {row.key}
                  </button>
                  <span className="truncate text-slate-600">{row.description ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
          {configs && configs.length === 0 && !configError && (
            <p className="font-mono text-xs text-slate-600">No app_config rows yet.</p>
          )}
        </div>

        {/* Danger Zone */}{" "}
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6">
          {" "}
          <h2 className="font-heading mb-2 font-semibold text-red-400">Danger Zone</h2>{" "}
          <p className="mb-4 text-xs text-slate-500">Irreversible actions. Proceed with caution.</p>{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-red-900/50 px-4 py-2.5 font-mono text-xs text-red-400 transition-all hover:bg-red-950/30"
              onClick={() => {
                if (window.confirm("Delete all Notion cache? Active requests will re-fetch.")) {
                  handleClearCache();
                }
              }}
            >
              {" "}
              Force-flush All Caches{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
