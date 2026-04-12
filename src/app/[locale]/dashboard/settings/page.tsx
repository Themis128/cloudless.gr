"use client";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

function storageKey(username: string | undefined) {
  return `dashboard-settings:${username ?? "guest"}`;
}

function loadPersistedPrefs(username: string | undefined) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(username));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, updatePreferences } = useAuth();
  const prefs = user?.preferences;

  const persisted = loadPersistedPrefs(user?.username);

  const [theme, setTheme] = useState<"system" | "dark" | "light">(
    persisted?.theme ?? prefs?.theme ?? "dark",
  );
  const [language, setLanguage] = useState<"en" | "el" | "fr">(
    persisted?.language ?? prefs?.language ?? "en",
  );
  const [emailOrders, setEmailOrders] = useState<boolean>(
    persisted?.emailOrders ?? prefs?.emailOrders ?? true,
  );
  const [emailNewsletter, setEmailNewsletter] = useState<boolean>(
    persisted?.emailNewsletter ?? prefs?.emailNewsletter ?? false,
  );
  const [emailMarketing, setEmailMarketing] = useState<boolean>(
    persisted?.emailMarketing ?? prefs?.emailMarketing ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from auth context when user loads (e.g., after refresh)
  useEffect(() => {
    if (!prefs) return;
    const stored = loadPersistedPrefs(user?.username);
    if (!stored) {
      setTheme(prefs.theme ?? "dark");
      setLanguage(prefs.language ?? "en");
      setEmailOrders(prefs.emailOrders ?? true);
      setEmailNewsletter(prefs.emailNewsletter ?? false);
      setEmailMarketing(prefs.emailMarketing ?? false);
    }
  }, [prefs, user?.username]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updatePreferences({
        theme,
        language,
        emailOrders,
        emailNewsletter,
        emailMarketing,
      });
      // Persist to localStorage for instant reload
      try {
        localStorage.setItem(
          storageKey(user?.username),
          JSON.stringify({ theme, language, emailOrders, emailNewsletter, emailMarketing }),
        );
      } catch {
        // localStorage may be unavailable in some browsers/contexts
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save preferences",
      );
    } finally {
      setSaving(false);
    }
  }

  const themeOptions = [
    { value: "dark", label: "Dark (Default)" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "el", label: "Ελληνικά" },
    { value: "fr", label: "Français" },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">SETTINGS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          {t("dashboard.settings", "Settings")}
        </h1>
        <p className="font-body mt-1 text-slate-400">
          {t(
            "dashboard.settingsDesc",
            "Manage your preferences and notifications.",
          )}
        </p>
      </div>

      {error && (
        <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            {t("dashboard.appearance", "Appearance")}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("dashboard.theme", "Theme")}
              </label>
              <div className="flex flex-wrap gap-2">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setTheme(opt.value as "system" | "dark" | "light")
                    }
                    className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
                      theme === opt.value
                        ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 border"
                        : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("dashboard.preferredLanguage", "Preferred Language")}
              </label>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLanguage(opt.value as "en" | "el" | "fr")}
                    className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
                      language === opt.value
                        ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 border"
                        : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            {t("dashboard.notifications", "Notifications")}
          </h2>
          <div className="space-y-3">
            {[
              {
                id: "email-orders",
                label: t("dashboard.orderUpdates", "Order updates"),
                desc: t(
                  "dashboard.orderUpdatesDesc",
                  "Confirmations, shipping, and delivery",
                ),
                checked: emailOrders,
                onChange: setEmailOrders,
              },
              {
                id: "email-newsletter",
                label: t("dashboard.newsletter", "Newsletter"),
                desc: t(
                  "dashboard.newsletterDesc",
                  "Cloud tips, serverless patterns & growth hacks",
                ),
                checked: emailNewsletter,
                onChange: setEmailNewsletter,
              },
              {
                id: "email-marketing",
                label: t("dashboard.productUpdates", "Product updates"),
                desc: t(
                  "dashboard.productUpdatesDesc",
                  "New services and features",
                ),
                checked: emailMarketing,
                onChange: setEmailMarketing,
              },
            ].map((pref) => (
              <label
                key={pref.id}
                className="bg-void flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={pref.checked}
                  onChange={(e) => pref.onChange(e.target.checked)}
                  className="accent-neon-cyan mt-1"
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

        {/* Account Info */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            {t("dashboard.accountInfo", "Account")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">
                {t("auth.email", "Email")}
              </span>
              <span className="text-neon-cyan font-mono text-sm">
                {user?.email ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">
                {t("auth.fullName", "Name")}
              </span>
              <span className="font-mono text-sm text-white">
   