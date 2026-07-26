"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { isValidPlan } from "@/lib/plans";

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER;
const USE_COGNITO = AUTH_PROVIDER === "cognito";

function SignUpForm() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validate against the shared plan allowlist. An unknown ?plan= would
  // forward into /portal/waiting and silently dead-end at the server
  // enroll step (which validates the same allowlist) — drop it here so
  // the user isn't shipped to a confusing waiting room with no enroll.
  const rawPlan = searchParams.get("plan");
  const planParam = isValidPlan(rawPlan) ? rawPlan : null;
  const postSignupDestination = planParam
    ? `/portal/waiting?plan=${encodeURIComponent(planParam)}`
    : null;

  useEffect(() => {
    if (!isLoading && user) {
      if (postSignupDestination) {
        router.push(postSignupDestination);
      } else {
        router.push(isAdmin ? "/admin" : "/dashboard");
      }
    }
  }, [user, isAdmin, isLoading, router, postSignupDestination]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"signup" | "confirm-code" | "done">("signup");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  // token is returned by /api/auth/register and needed to verify the OTP
  const [activationToken, setActivationToken] = useState("");
  // 5-min countdown — seconds remaining until auto-resend fires
  const [secondsLeft, setSecondsLeft] = useState(0);
  const autoResendFiredRef = useRef(false);

  const handleCognitoSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Cognito Hosted UI handles both sign-in and sign-up.
      // Redirect to it so the user can create an account there.
      const callbackUrl = postSignupDestination ?? "/auth/post-login";
      await nextAuthSignIn("cognito", { callbackUrl });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setSubmitting(false);
    }
  };

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
      const res = await globalThis.fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: fullName || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; token?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.signupFailed", "Sign up failed"));
        return;
      }
      if (data.token) setActivationToken(data.token);
      setStep("confirm-code");
      setSecondsLeft(5 * 60);
      autoResendFiredRef.current = false;
    } catch {
      setError(t("auth.signupFailed", "Sign up failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConfirming(true);
    try {
      const res = await globalThis.fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, token: activationToken }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.confirmFailed", "Confirmation failed"));
        return;
      }
      setStep("done");
    } catch {
      setError(t("auth.confirmFailed", "Confirmation failed"));
    } finally {
      setConfirming(false);
    }
  };

  // Countdown timer + auto-resend when it hits zero
  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try {
      const res = await globalThis.fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // resend-verification returns a new token so the OTP stays in sync
      const data = (await res.json()) as { ok?: boolean; token?: string };
      if (data.token) setActivationToken(data.token);
      setResent(true);
      setSecondsLeft(5 * 60);
      autoResendFiredRef.current = false;
    } catch {
      // Keep the button available so the user can retry.
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (step !== "confirm-code" || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (!autoResendFiredRef.current) {
            autoResendFiredRef.current = true;
            handleResend();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, secondsLeft > 0]);

  return (
    <div className="bg-void flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">NEW_USER</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">
            {step === "signup"
              ? t("auth.signup", "Create Account")
              : step === "confirm-code"
                ? t("auth.verifyEmail", "Verify Your Email")
                : t("auth.checkYourEmail", "Account Activated")}
          </h1>
          <p className="font-body mt-2 text-slate-400">
            {step === "signup"
              ? t("auth.signupDesc", "Join Cloudless to access your dashboard")
              : step === "confirm-code"
                ? t("auth.enterCodeDesc", "Enter the 6-digit code from your email")
                : t("auth.checkEmailDesc", "Your account is ready — sign in below")}
          </p>
        </div>

        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8">
          {USE_COGNITO ? (
            // Cognito Hosted UI handles sign-up — redirect there.
            <form onSubmit={handleCognitoSignUp} className="space-y-5">
              {error && (
                <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta rounded-lg border p-3 font-mono text-sm">
                  {error}
                </div>
              )}
              <p className="font-mono text-sm text-slate-400">
                {t(
                  "auth.cognitoSignupDesc",
                  "Account creation is handled securely through AWS. Click below to continue."
                )}
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-11 w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {submitting
                  ? t("auth.redirecting", "Redirecting...")
                  : t("auth.continueWithAws", "Continue with AWS")}
              </button>
              <p className="text-center font-mono text-sm text-slate-500">
                {t("auth.hasAccount", "Already have an account?")}{" "}
                <Link href="/auth/login" className="text-neon-cyan hover:underline">
                  {t("auth.login", "Sign In")}
                </Link>
              </p>
            </form>
          ) : step === "confirm-code" ? (
            <form onSubmit={handleConfirm} className="space-y-5">
              {error && (
                <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta rounded-lg border p-3 font-mono text-sm">
                  {error}
                </div>
              )}
              <p className="font-mono text-sm text-slate-300">
                {t("auth.verificationSentTo", "We sent a verification code to")}{" "}
                <span className="text-white">{email}</span>
              </p>
              <div>
                <label
                  htmlFor="confirm-code"
                  className="mb-2 block font-mono text-sm text-slate-400"
                >
                  {t("auth.verificationCode", "Verification Code")}
                </label>
                <input
                  id="confirm-code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  className="bg-void focus:border-neon-cyan/50 w-full rounded-lg border border-slate-700 px-4 py-3 font-mono text-sm tracking-widest text-white transition-all focus:shadow-[0_0_10px_rgba(0,255,245,0.1)] focus:outline-none"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={confirming}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-11 w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
              >
                {confirming
                  ? t("auth.confirming", "Confirming...")
                  : t("auth.confirmAccount", "Confirm Account")}
              </button>
              <div className="space-y-2 text-center">
                <p className="font-mono text-xs text-slate-500">
                  {secondsLeft > 0
                    ? t("auth.codeExpiresIn", "Code expires in") +
                      ` ${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : t("auth.didntGetEmail", "Didn't get the email?")}
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || (resent && secondsLeft > 0)}
                  className="font-mono text-xs text-slate-400 hover:text-white disabled:opacity-60"
                >
                  {resending
                    ? t("auth.resending", "Resending…")
                    : resent && secondsLeft > 0
                      ? t("auth.verificationResent", "New code sent ✓")
                      : t("auth.resendVerification", "Resend code")}
                </button>
              </div>
            </form>
          ) : step === "done" ? (
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
                {t("auth.accountActivated", "Your account has been activated.")}
              </p>
              <p className="font-mono text-xs text-slate-500">
                {t("auth.canSignInNow", "You can now sign in with your email and password.")}
              </p>
              <Link
                href="/auth/login"
                className="text-neon-cyan block font-mono text-sm hover:underline"
              >
                {t("auth.goToSignIn", "Go to Sign In →")}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta mb-6 rounded-lg border p-3 font-mono text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSignUp} className="space-y-5">
                <div>
                  <label
                    htmlFor="signup-name"
                    className="mb-2 block font-mono text-sm text-slate-400"
                  >
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
                  <label
                    htmlFor="signup-email"
                    className="mb-2 block font-mono text-sm text-slate-400"
                  >
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
                  <label
                    htmlFor="signup-password"
                    className="mb-2 block font-mono text-sm text-slate-400"
                  >
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
                  <label
                    htmlFor="signup-confirm-password"
                    className="mb-2 block font-mono text-sm text-slate-400"
                  >
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
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-11 w-full rounded-lg border py-3 font-mono font-semibold transition-all hover:shadow-[0_0_15px_rgba(0,255,245,0.2)] disabled:opacity-50"
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
            </>
          )}
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
