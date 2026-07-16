"use client";

import { useState, useEffect, Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate, type Locale, isSupportedLocale } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

function normalizeRedirectPath(path: string): string {
  if (!path.startsWith("/")) return path;
  const match = path.match(/^\/([^/]+)(\/.*|$)/);
  if (!match) return path;
  const potentialLocale = match[1] as Locale;
  const suffix = match[2] || "/";
  return isSupportedLocale(potentialLocale) ? suffix : path;
}

function LoginContent() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? searchParams.get("redirect");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isLoading && user) {
      if (nextParam && nextParam.startsWith("/")) {
        router.push(normalizeRedirectPath(nextParam));
      } else {
        router.push(isAdmin ? "/admin" : "/dashboard");
      }
    }
  }, [user, isAdmin, isLoading, router, nextParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await useAuth().signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
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
        <div className="mb-8 text-center">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">SECURE_AUTH</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {t("auth.login", "Sign In")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {t("auth.loginDesc", "Sign in to your Cloudless account")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block font-mono text-sm text-slate-400">
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
              <label htmlFor="login-password" className="mb-2 block font-mono text-sm text-slate-400">
                {t("auth.password", "Password")}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
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
                ? t("auth.signingIn", "Signing In...")
                : t("auth.login", "Sign In")}
            </button>
          </form>

          <div className="mt-6 space-y-4 text-center">
            <p className="font-mono text-sm text-slate-500">
              {t("auth.noAccount", "Don't have an account?")}{" "}
              <Link href="/auth/signup" className="text-neon-cyan hover:underline">
                {t("auth.signup", "Create Account")}
              </Link>
            </p>
            <p className="font-mono text-sm text-slate-500">
              <Link href="/auth/forgot-password" className="text-neon-cyan hover:underline">
                {t("auth.forgotPassword", "Forgot password?")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-void flex min-h-screen items-center justify-center">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
