"use client";

import { useState, useEffect, Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

function SignUpForm() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(isAdmin ? "/admin" : "/dashboard");
    }
  }, [user, isAdmin, isLoading, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("auth.passwordsNoMatch", "Passwords do not match"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordTooShort", "Password must be at least 8 characters"));
      return;
    }
    setSubmitting(true);
    try {
      await useAuth().signUp(email, password, fullName);
      // Show success state
      setError("");
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">NEW_USER</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {t("auth.signup", "Create Account")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {t("auth.signupDesc", "Join Cloudless to access your dashboard")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {error && (
            <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label htmlFor="signup-name" className="mb-2 block font-mono text-sm text-slate-400">
                {t("auth.fullName", "Full Name")}
                <span className="ml-1 text-slate-600">({t("auth.optional", "optional")})</span>
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                placeholder={t("auth.namePlaceholder", "John Doe")}
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="mb-2 block font-mono text-sm text-slate-400">
                {t("auth.email", "Email")}
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="mb-2 block font-mono text-sm text-slate-400">
                {t("auth.password", "Password")}
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                placeholder={t("auth.minChars", "Min. 8 characters")}
              />
            </div>
            <div>
              <label htmlFor="signup-confirm-password" className="mb-2 block font-mono text-sm text-slate-400">
                {t("auth.confirmPassword", "Confirm Password")}
              </label>
              <input
                id="signup-confirm-password"
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
                ? t("auth.creatingAccount", "Creating Account...")
                : t("auth.signup", "Create Account")}
            </button>
          </form>

          <p className="mt-6 text-center font-mono text-sm text-slate-500">
            {t("auth.hasAccount", "Already have an account?")}{" "}
            <Link href="/auth/login" className="text-neon-cyan hover:underline">
              {t("auth.login", "Sign In")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-void flex min-h-screen items-center justify-center">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
