"use client";

import { useState, useEffect, Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate, type Locale, isSupportedLocale } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER;
const USE_COGNITO = AUTH_PROVIDER === "cognito";

/**
 * Returns true when `path` is a safe same-origin internal path that the
 * router can push to. Defeats open-redirect attempts via:
 *   //evil.example/x        (protocol-relative URL — browsers treat as cross-origin)
 *   /\evil.example/x        (backslash-prefix — Chrome interprets as protocol-relative)
 *   non-/-prefixed URLs     (relative-to-current — surprising semantics)
 *   embedded \r\n           (header smuggling)
 * Also bounds length so we don't ship a /portal/waiting?... gigaparam.
 */
function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 2048) return false;
  if (!path.startsWith("/")) return false;
  // Defang protocol-relative URLs ("//evil") and Chrome's backslash variant.
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  // Defang header-injection / control codepoints.
  if (/[ -]/.test(path)) return false;
  return true;
}

function normalizeRedirectPath(path: string): string {
  if (!isSafeRedirectPath(path)) return "/";

  const match = path.match(/^\/([^/]+)(\/.*|$)/);
  if (!match) return path;

  const potentialLocale = match[1] as Locale;
  const suffix = match[2] || "/";

  return isSupportedLocale(potentialLocale) ? suffix : path;
}

function LoginContent() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, isAdmin, isLoading, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?next= (preferred) or ?redirect= (legacy / AdminLayoutClient compat)
  const nextParam = searchParams.get("next") ?? searchParams.get("redirect");
  const activated = searchParams.get("activated") === "1";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isLoading && user) {
      if (isSafeRedirectPath(nextParam)) {
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
      if (USE_COGNITO) {
        await signIn("", "");
      } else {
        if (!email.trim() || !password) {
          setError(t("auth.emailPasswordRequired", "Email and password are required"));
          return;
        }
        await signIn(email.trim(), password);
      }
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
            <span className="text-neon-cyan font-mono text-xs">
              {USE_COGNITO ? "SECURE_AUTH" : "D1_AUTH"}
            </span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {t("auth.login", "Sign In")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {t("auth.loginDesc", "Sign in to your Cloudless account")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {activated && (
            <div className="bg-neon-green/10 border-neon-green/30 text-neon-green mb-6 rounded-lg border p-3 font-mono text-sm">
              Account activated — you can now sign in.
            </div>
          )}
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {!USE_COGNITO && (
              <>
                <div>
                  <label htmlFor="email" className="mb-2 block font-mono text-xs text-slate-400">
                    {t("auth.email", "Email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-void focus:border-neon-cyan/50 min-h-[44px] w-full rounded-lg border border-slate-800 px-4 py-2.5 font-mono text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block font-mono text-xs text-slate-400">
                    {t("auth.password", "Password")}
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-void focus:border-neon-cyan/50 min-h-[44px] w-full rounded-lg border border-slate-800 px-4 py-2.5 font-mono text-sm text-white focus:outline-none"
                  />
                </div>
                <p className="text-right">
                  <Link
                    href="/auth/reset-password"
                    className="hover:text-neon-cyan font-mono text-xs text-slate-500"
                  >
                    {t("auth.forgotPassword", "Forgot Password?")}
                  </Link>
                </p>
              </>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
            >
              {submitting
                ? t("auth.signingIn", "Signing In...")
                : USE_COGNITO
                  ? t("auth.continueWithCognito", "Continue with AWS")
                  : t("auth.login", "Sign In")}
            </button>
          </form>

          <p className="mt-6 text-center font-mono text-sm text-slate-500">
            {t("auth.noAccount", "Don't have an account?")}{" "}
            <Link href="/auth/signup" className="text-neon-cyan hover:underline">
              {t("auth.signup", "Create Account")}
            </Link>
          </p>
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
