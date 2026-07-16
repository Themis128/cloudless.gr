"use client";

import { useState, Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

function ResetConfirmForm() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await globalThis.fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.resetFailed", "Reset failed"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("auth.resetFailed", "Reset failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center">
          <p className="font-mono text-slate-400">Invalid or missing reset token.</p>
          <Link
            href="/auth/reset-password"
            className="text-neon-cyan font-mono text-sm hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">RESET_PASSWORD</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {success
              ? t("auth.passwordResetSuccess", "Password Reset")
              : t("auth.resetPasswordTitle", "Reset Password")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {success
              ? t("auth.passwordResetSuccessDesc", "Your password has been updated")
              : t("auth.enterNewPassword", "Enter your new password below")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-5 text-center">
              <div className="bg-neon-green/10 border-neon-green/20 mx-auto flex h-16 w-16 items-center justify-center rounded-full border">
                <svg
                  className="text-neon-green h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="font-mono text-sm text-slate-300">
                {t("auth.passwordUpdated", "Your password has been reset successfully.")}
              </p>
              <Link
                href="/auth/login"
                className="text-neon-cyan block font-mono text-sm hover:underline"
              >
                {t("auth.goToSignIn", "Go to Sign In →")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.newPassword", "New Password")}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder={t("auth.minChars", "Min. 8 characters")}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.confirmPassword", "Confirm Password")}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder={t("auth.reenterPassword", "Re-enter password")}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {submitting
                  ? t("auth.updating", "Updating...")
                  : t("auth.updatePassword", "Update Password")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-void flex min-h-screen items-center justify-center">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <ResetConfirmForm />
    </Suspense>
  );
}
