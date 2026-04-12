"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

export default function ForgotPasswordPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { forgotPassword, confirmForgotPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStep("confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await confirmForgotPassword(email, code, newPassword);
      router.push("/auth/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
            {step === "request"
              ? t("auth.resetPasswordTitle", "Reset Password")
              : t("auth.enterCode", "Enter Code")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {step === "request"
              ? t(
                  "auth.resetRequestDesc",
                  "We'll send a verification code to your email",
                )
              : t(
                  "auth.resetCodeDesc",
                  "Enter the code sent to {email}",
                ).replace("{email}", email)}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.email", "Email")}
                </label>
                <input
                  id="forgot-email"
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
                  ? t("auth.sendingCode", "Sending Code...")
                  : t("auth.sendResetCode", "Send Reset Code")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-verification-code"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.verificationCode", "Verification Code")}
                </label>
                <input
                  id="forgot-verification-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 text-center font-mono text-sm tracking-[0.3em] text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <div>
                <label
                  htmlFor="forgot-new-password"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.newPassword", "New Password")}
                </label>
                <input
                  id="forgot-new-password"
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
              <button
                type="submit"
                disabled={submitting}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {submitting
                  ? t("auth.resetting", "Resetting...")
                  : t("auth.resetPassword", "Reset Password")}
              </button>
            </form>
          )}

          <p className="mt-6 text-center font-mono text-sm text-slate-500">
            {t("auth.rememberPassword", "Remember your password?")}{" "}
            <Link href="/auth/login" className="text-neon-cyan hover:underline">
              {t("auth.login", "Sign In")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
