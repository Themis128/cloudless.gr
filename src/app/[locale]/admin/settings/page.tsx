"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "admin-settings";

interface AdminPrefs {
  notifyOrders: boolean;
  notifySignups: boolean;
  notifyFailures: boolean;
  notifyContact: boolean;
  siteName: string;
  supportEmail: string;
}

const DEFAULTS: AdminPrefs = {
  notifyOrders: true,
  notifySignups: true,
  notifyFailures: true,
  notifyContact: true,
  siteName: "Cloudless",
  supportEmail: "tbaltzakis@cloudless.gr",
};

function loadAdminPrefs(): AdminPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function AdminSettingsPage() {
  const [prefs, setPrefs] = useState<AdminPrefs>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setPrefs(loadAdminPrefs());
  }, []);

  function update<K extends keyof AdminPrefs>(key: K, value: AdminPrefs[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const notificationPrefs = [
    {
      id: "notify-orders" as const,
      key: "notifyOrders" as const,
      label: "New orders",
      desc: "Email the team when a new order is placed",
    },
    {
      id: "notify-signups" as const,
      key: "notifySignups" as const,
      label: "New sign-ups",
      desc: "Email the team when a new user registers",
    },
    {
      id: "notify-failures" as const,
      key: "notifyFailures" as const,
      label: "Payment failures",
      desc: "Alert when a payment fails",
    },
    {
      id: "notify-contact" as const,
      key: "notifyContact" as const,
      label: "Contact form submissions",
      desc: "Forward contact form messages to the team",
    },
  ];

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
                value={prefs.siteName}
                onChange={(e) => update("siteName", e.target.value)}
                className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-xs text-slate-500">
                Support Email
              </label>
              <input
                type="email"
                value={prefs.supportEmail}
                onChange={(e) => update("supportEmail", e.target.value)}
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
            {notificationPrefs.map((pref) => (
              <label
                key={pref.id}
                className="bg-void flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={prefs[pref.key]}
                  onChange={(e) => update(pref.key, e.target.checked)}
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

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6">
          <h2 className="font-heading mb-2 font-semibold text-red-400">
            Danger Zone
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Irreversible actions. Proceed with caution.
          </p>
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-red-900/50 px-4 py-2.5 font-mono text-xs text-red-400 transition-all hover:bg-red-950/30"
            onClick={() => alert("Cache cleared")}
          >
            Clear All Caches
          </button>
        </div>

        {/* Save Button */}
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
