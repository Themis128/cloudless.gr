"use client";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

export default function SettingsPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, updatePreferences } = useAuth();
  const prefs = user?.preferences;

  const [theme, setTheme] = useState(prefs?.theme ?? "dark");
  const [language, setLanguage] = useState(prefs?.language ?? "en");
  const [emailOrders, setEmailOrders] = useState(prefs?.emailOrders ?? true);
  const [emailNewsletter, setEmailNewsletter] = useState(prefs?.emailNewsletter ?? false);
  const [emailMarketing, setEmailMarketing] = useState(prefs?.emailMarketing ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updatePreferences({
        theme: theme as "system" | "dark" | "light",
        language: language as "en" | "el" | "fr",
        emailOrders,
        emailNewsletter,
        emailMarketing,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
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
          {t("dashboard.settingsDesc", "Manage your preferences and notifications.")}
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
                    onClick={() => setTheme(opt.value as "system" | "dark" | "light")}
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
                desc: t("dashboard.orderUpdatesDesc", "Confirmations, shipping, and delivery"),
                checked: emailOrders,
                onChange: setEmailOrders,
              },
              {
                id: "email-newsletter",
                label: t("dashboard.newsletter", "Newsletter"),
                desc: t("dashboard.newsletterDesc", "Cloud tips, serverless patterns & growth hacks"),
                checked: emailNewsletter,
                onChange: setEmailNewsletter,
              },
              {
                id: "email-marketing",
                label: t("dashboard.productUpdates", "Product updates"),
                desc: t("dashboard.productUpdatesDesc", "New services and features"),
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
                  <span className="block font-mono text-sm text-white">{pref.label}</span>
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
              <span className="font-mono text-xs text-slate-500">{t("auth.email", "Email")}</span>
              <span className="text-neon-cyan font-mono text-sm">{user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">{t("auth.fullName", "Name")}</span>
              <span className="font-mono text-sm text-white">{user?.name || "—"}</span>
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] text-slate-600">
            To update your name, company, or phone, visit your{" "}
            <Link href="/dashboard/profile" className="text-neon-cyan hover:underline">
              Profile
            </Link>
            .
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-11 rounded-lg border px-6 py-2.5 font-mono text-sm font-semibold transition-all hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-50"
          >
            {saving ? t("common.saving", "Saving…") : t("common.saveChanges", "Save Changes")}
          </button>
          {saved && (
            <span className="text-neon-green animate-fade-in-up font-mono text-xs">
              ✓ {t("dashboard.settingsSaved", "Settings saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
