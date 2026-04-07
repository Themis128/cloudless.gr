"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

export default function ProfilePage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateProfile({
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">PROFILE</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          {t("dashboard.profile", "Your Profile")}
        </h1>
        <p className="font-body mt-1 text-slate-400">
          {t("dashboard.profileDesc", "Manage your personal information.")}
        </p>
      </div>

      {/* Avatar / Identity */}
      <div className="bg-void-light/50 mb-6 flex items-center gap-5 rounded-xl border border-slate-800 p-6">
        <div className="bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 font-heading text-2xl font-bold">
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-semibold text-white">
            {user?.name || user?.email?.split("@")[0] || "User"}
          </p>
          <p className="text-neon-cyan truncate font-mono text-sm">{user?.email}</p>
          {user?.company && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{user.company}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h2 className="font-heading mb-4 font-semibold text-white">
            {t("dashboard.personalInfo", "Personal Information")}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-email" className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("auth.email", "Email")}
              </label>
              <input
                id="profile-email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-void w-full cursor-not-allowed rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-slate-500"
              />
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>
            <div>
              <label htmlFor="profile-name" className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("auth.fullName", "Full Name")}
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="bg-void-light focus:border-neon-cyan/50 w-full rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
                placeholder={t("auth.namePlaceholder", "John Doe")}
              />
            </div>
            <div>
              <label htmlFor="profile-company" className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("dashboard.company", "Company")}
              </label>
              <input
                id="profile-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
                className="bg-void-light focus:border-neon-cyan/50 w-full rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
                placeholder={t("dashboard.companyPlaceholder", "Your company or organization")}
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="mb-1.5 block font-mono text-xs text-slate-500">
                {t("dashboard.phone", "Phone")}
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="bg-void-light focus:border-neon-cyan/50 w-full rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors focus:outline-none"
                placeholder="+30 210 1234567"
              />
            </div>
          </div>
        </div>

        {/* Save */}
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
              ✓ {t("dashboard.profileSaved", "Profile saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
