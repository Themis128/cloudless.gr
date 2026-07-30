"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

function ResetPasswordForm() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await globalThis.fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.resetFailed", "Reset request failed"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("auth.resetFailed", "Reset request failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-neon-blue/10 border-neon-blue/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-blue font-mono text-xs">RECOVERY</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {t("auth.resetPasswordTitle", "Reset Password")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {t("auth.resetRequestDesc", "Enter your email and we'll send a reset link")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {sent ? (
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
                {t(
                  "auth.resetLinkSent",
                  "If an account exists with that email, we've sent a reset link."
                )}
              </p>
              <p className="font-mono text-xs text-slate-500">
                {t("auth.checkInbox", "Check your inbox (and spam folder) for the reset link.")}
              </p>
              <Link
                href="/auth/login"
                className="text-neon-cyan block font-mono text-sm hover:underline"
              >
                {t("auth.backToSignIn", "Back to Sign In →")}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequest} className="space-y-5">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="mb-2 block font-mono text-sm text-slate-400"
                  >
                    {t("auth.email", "Email")}
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
                >
                  {submitting
                    ? t("auth.sending", "Sending...")
                    : t("auth.sendResetLink", "Send Reset Link")}
                </button>
              </form>

              <p className="mt-6 text-center font-mono text-sm text-slate-500">
                {t("auth.rememberPassword", "Remember your password?")}{" "}
                <Link href="/auth/login" className="text-neon-cyan hover:underline">
                  {t("auth.login", "Sign In")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
