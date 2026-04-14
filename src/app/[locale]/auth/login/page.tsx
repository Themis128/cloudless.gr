"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

export default function LoginPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { signIn, completeNewPassword, user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(isAdmin ? "/admin" : "/dashboard");
    }
  }, [user, isAdmin, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.needsNewPassword) {
        setNeedsNewPassword(true);
      } else if (result.needsConfirmation) {
        router.push(`/auth/signup?verify=${encodeURIComponent(email)}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await completeNewPassword(newPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-void flex min-h-screen items-center justify-center">
        <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">SECURE_AUTH</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {needsNewPassword ? t("auth.newPassword", "New Password") : t("auth.login", "Sign In")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {needsNewPassword
              ? t("auth.newPasswordDesc", "You must set a new password before continuing.")
              : t("auth.loginDesc", "Sign in to your Cloudless account")}
          </p>
        </div>

        {/* Card */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          {needsNewPassword ? (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <div>
                <label
                  htmlFor="login-new-password"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.newPassword", "New Password")}
                </label>
                <input
                  id="login-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder="Enter new password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {submitting
                  ? t("auth.settingPassword", "Setting Password...")
                  : t("auth.resetPassword", "Reset Password")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.email", "Email")}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.password", "Password")}
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-neon-cyan/70 hover:text-neon-cyan font-mono text-sm transition-colors"
                >
                  {t("auth.forgotPassword", "Forgot Password?")}
                </Link>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {submitting ? t("auth.signingIn", "Signing In...") : t("auth.login", "Sign In")}
              </button>
            </form>
          )}

          {!needsNewPassword && (
            <p className="mt-6 text-center font-mono text-sm text-slate-500">
              {t("auth.noAccount", "Don't have an account?")}{" "}
              <Link href="/auth/signup" className="text-neon-cyan hover:underline">
                {t("auth.signup", "Create Account")}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
