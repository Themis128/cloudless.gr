"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
// useRouter from next/navigation is intentional here: the page lives OUTSIDE
// [locale]/ (portal URLs are locale-neutral by design, see PR #955), so
// @/i18n/navigation's router can't infer a locale. We resolve locale below
// via the NEXT_LOCALE cookie for the one place we link to a locale-prefixed
// route (/<locale>/auth/login).
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import TerminalBlock from "@/components/TerminalBlock";
// Single source of truth — also consumed by /api/portal/enroll +
// src/lib/pending-clients.ts (server) and the signup gate (client).
// Lives in a dependency-free module so the AWS SDK isn't pulled into the
// browser bundle.
import { isValidPlan, PLAN_LABELS } from "@/lib/plans";

interface PortalStatus {
  status: "none" | "waiting" | "approved";
  portalToken?: string;
  plan?: string;
  planLabel?: string;
  submittedAt?: string;
  approvedAt?: string;
  email?: string;
  name?: string;
}

const POLL_INTERVAL_MS = 30_000;

function SystemIndicator({ activeStep }: Readonly<{ activeStep: 1 | 2 | 3 }>) {
  const steps = [
    { num: "01", label: "Order received", color: "neon-cyan" },
    { num: "02", label: "Portal setup", color: "neon-magenta" },
    { num: "03", label: "Project access", color: "neon-green" },
  ];

  function stepColorClasses(s: (typeof steps)[number], isComplete: boolean, isActive: boolean) {
    if (isComplete) {
      return {
        border: "border-neon-green",
        ring: "ring-neon-green/30",
        text: "text-neon-green",
        bg: "bg-neon-green",
      };
    }
    if (!isActive)
      return {
        border: "border-slate-700",
        ring: "ring-transparent",
        text: "text-slate-500",
        bg: "bg-slate-700",
      };
    if (s.color === "neon-cyan")
      return {
        border: "border-neon-cyan",
        ring: "ring-neon-cyan/30",
        text: "text-neon-cyan",
        bg: "bg-neon-cyan",
      };
    if (s.color === "neon-magenta")
      return {
        border: "border-neon-magenta",
        ring: "ring-neon-magenta/30",
        text: "text-neon-magenta",
        bg: "bg-neon-magenta",
      };
    return {
      border: "border-neon-green",
      ring: "ring-neon-green/30",
      text: "text-neon-green",
      bg: "bg-neon-green",
    };
  }

  return (
    <div className="relative mx-auto max-w-xl">
      <div className="from-neon-cyan/40 via-neon-magenta/40 to-neon-green/40 absolute top-5 right-[calc(16.67%+1.5rem)] left-[calc(16.67%+1.5rem)] hidden h-px bg-gradient-to-r sm:block" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:justify-between">
        {steps.map((s, i) => {
          const stepIndex = i + 1;
          const isComplete = stepIndex < activeStep;
          const isActive = stepIndex === activeStep;
          const cc = stepColorClasses(s, isComplete, isActive);

          return (
            <div
              key={s.num}
              className="relative z-10 flex flex-1 flex-col items-center text-center"
            >
              <div
                className={`bg-void mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-sm font-bold ring-2 transition-all duration-500 ${cc.border} ${cc.ring} ${cc.text}`}
              >
                {isComplete ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span className={`font-mono text-xs font-semibold ${cc.text}`}>{s.label}</span>
              {isActive && (
                <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
                  <span className={`h-1 w-1 animate-pulse rounded-full ${cc.bg}`} />
                  In progress
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref-Set keyed by planParam so:
  //  - failures don't lock the user out from retry on a different plan
  //  - successful enrolls don't reuse the post-success flag for a different plan
  //  - two-tab races each see their own entry
  const enrollAttemptedFor = useRef<Set<string>>(new Set());

  const rawPlan = searchParams.get("plan");
  const planParam = isValidPlan(rawPlan) ? rawPlan : null;

  useEffect(() => {
    if (!isLoading && !user) {
      const next = encodeURIComponent("/portal/waiting" + (planParam ? `?plan=${planParam}` : ""));
      // /auth/login only exists under /[locale]/auth/login — there is no
      // top-level /auth/login. Read NEXT_LOCALE the same way next-intl's
      // middleware does and prefix it; fall back to the default locale.
      const cookieLocale = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
      const allowed = new Set(["en", "el", "fr", "de"]);
      const locale = cookieLocale && allowed.has(cookieLocale) ? cookieLocale : "en";
      router.push(`/${locale}/auth/login?next=${next}`);
    }
  }, [user, isLoading, router, planParam]);

  useEffect(() => {
    if (isLoading || !user) return;

    async function loadAndEnroll() {
      try {
        const meRes = await fetchWithAuth("/api/portal/me");
        if (!meRes.ok) throw new Error(`Portal status check failed (HTTP ${meRes.status})`);
        const me: PortalStatus = await meRes.json();

        if (planParam && !enrollAttemptedFor.current.has(planParam)) {
          if (me.status === "none" || (me.status === "waiting" && me.plan !== planParam)) {
            setEnrolling(true);
            const enrollRes = await fetchWithAuth("/api/portal/enroll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: planParam, name: user?.name }),
            });
            // Record the attempt AFTER receiving any kind of response. On
            // success: stops the next render from re-firing the POST. On
            // 4xx (e.g. email_verified=false → 403): the message is shown
            // and we don't grind. On network error: the catch below clears
            // the entry so the next user action (refresh, retry) can retry.
            enrollAttemptedFor.current.add(planParam);
            if (!enrollRes.ok) {
              const data = (await enrollRes.json().catch(() => ({}))) as { error?: string };
              throw new Error(data.error ?? `Enrollment failed (HTTP ${enrollRes.status})`);
            }
            const refreshed = await fetchWithAuth("/api/portal/me");
            setStatus(await refreshed.json());
            setEnrolling(false);
            return;
          }
          // Plan already enrolled with — just record as attempted to avoid
          // doing this branch repeatedly.
          enrollAttemptedFor.current.add(planParam);
        }

        setStatus(me);
      } catch (e) {
        // Allow retry on the next prop/state change (e.g. user picks a new
        // plan, refreshes the page, or hits the in-page retry button).
        if (planParam) enrollAttemptedFor.current.delete(planParam);
        setEnrolling(false);
        setError(e instanceof Error ? e.message : "Failed to load status");
      }
    }

    loadAndEnroll();
  }, [user, isLoading, planParam]);

  useEffect(() => {
    if (status?.status !== "waiting") return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    async function pollOnce() {
      try {
        const res = await fetchWithAuth("/api/portal/me");
        if (res.ok) setStatus(await res.json());
      } catch {
        // silent
      }
    }
    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(pollOnce, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    }
    function onVisibility() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediate refresh on tab-focus return, then resume background poll.
        pollOnce();
        startPolling();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) startPolling();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopPolling();
    };
  }, [status?.status]);

  useEffect(() => {
    // Immediate redirect on the approved transition. The previous
    // setTimeout(1800ms) + setRedirecting flag dance had a stale-closure
    // bug that could pin the user to an outdated portalToken (audit #8/#21).
    if (status?.status !== "approved" || !status.portalToken) return;
    router.push(`/portal/${status.portalToken}`);
  }, [status?.status, status?.portalToken, router]);

  if (isLoading || !user) {
    return (
      <div className="bg-void flex min-h-screen items-center justify-center">
        <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-void relative min-h-screen overflow-hidden">
      <div className="bg-neon-cyan/5 animate-float pointer-events-none absolute -top-20 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl" />
      <div
        className="bg-neon-magenta/5 animate-float-slow pointer-events-none absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
        style={{ animationDelay: "2s" }}
      />
      <div className="cyber-grid absolute inset-0 opacity-10" />

      <header className="relative z-10 border-b border-slate-800/50 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="font-mono text-sm text-white">cloudless.gr</span>
          </div>
          <span className="font-mono text-xs tracking-[0.15em] text-slate-500">
            CUSTOMER PORTAL
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-6 py-16 lg:py-24">
        {error && (
          <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-6 py-4 font-mono text-sm text-red-400 backdrop-blur-sm">
            <span className="font-semibold">Error: </span>
            {error}
          </div>
        )}

        {(enrolling || (!status && !error)) && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="border-neon-cyan mb-6 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="font-mono text-sm text-slate-400">
              {enrolling ? "Submitting your order..." : "Loading your status..."}
            </p>
          </div>
        )}

        {status?.status === "none" && (
          <div className="text-center">
            <div className="bg-neon-cyan/10 border-neon-cyan/20 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border text-3xl">
              ✨
            </div>
            <p className="text-neon-cyan mb-2 font-mono text-xs tracking-[0.3em] uppercase">
              [ ALL SET ]
            </p>
            <h1 className="font-heading text-3xl font-bold text-white">You&rsquo;re signed in</h1>
            <p className="mt-3 text-slate-400">
              Pick a service or bundle to get started — your portal will be set up right after.
            </p>
            <Link
              href="/services"
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 animate-glow-pulse mt-8 inline-flex items-center gap-2 rounded-lg border px-6 py-3 font-mono text-sm font-semibold transition-all"
            >
              Browse services
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 14 14"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M1 7h12M8 2l5 5-5 5" />
              </svg>
            </Link>
          </div>
        )}

        {status?.status === "waiting" && (
          <div className="space-y-12">
            <div className="text-center">
              <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan animate-fade-in-up mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="bg-neon-cyan animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-75" />
                  <span className="bg-neon-cyan relative inline-flex h-2 w-2 rounded-full" />
                </span>
                ORDER RECEIVED
              </div>
              <h1 className="animate-fade-in-up font-heading text-3xl leading-tight font-bold text-white delay-100 md:text-4xl">
                Welcome, {status.name || (user.email || "").split("@")[0]}.
              </h1>
              <p className="animate-fade-in-up mx-auto mt-4 max-w-lg text-slate-400 delay-200">
                Your project manager has been notified. We&rsquo;ll prepare your personalized portal
                and email you the moment it&rsquo;s ready.
              </p>
            </div>

            <div className="bg-void-light/30 rounded-2xl border border-slate-800 p-8 backdrop-blur-sm">
              <p className="mb-7 text-center font-mono text-[10px] tracking-[0.3em] text-slate-500">
                [ HOW IT WORKS ]
              </p>
              <SystemIndicator activeStep={2} />
            </div>

            <div className="space-y-4">
              <p className="font-mono text-[10px] tracking-[0.3em] text-slate-500">
                [ YOUR ORDER ]
              </p>
              <TerminalBlock
                title="cloudless-portal — order"
                lines={[
                  `$ portal order --status`,
                  `  ✓ account: ${status.email}`,
                  `  ✓ plan: ${status.planLabel ?? PLAN_LABELS[status.plan ?? ""] ?? status.plan}`,
                  `  ✓ submitted: ${status.submittedAt ? new Date(status.submittedAt).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" }) : "just now"}`,
                  `  ---`,
                  `  status: pending review`,
                  `  estimated wait: usually < 24h`,
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: "📬",
                  title: "Email confirmation",
                  desc: "We'll send a notification to your inbox the moment your portal is ready.",
                  iconBg: "bg-neon-cyan/10",
                  iconBorder: "border-neon-cyan/20",
                },
                {
                  icon: "🗺",
                  title: "Project timeline",
                  desc: "Your portal will show every step of your project with status updates.",
                  iconBg: "bg-neon-magenta/10",
                  iconBorder: "border-neon-magenta/20",
                },
                {
                  icon: "💬",
                  title: "Live updates",
                  desc: "Comments from our team appear under each step in real time.",
                  iconBg: "bg-neon-green/10",
                  iconBorder: "border-neon-green/20",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-void-light/20 rounded-xl border border-slate-800 p-5 backdrop-blur-sm transition-all hover:border-slate-700"
                >
                  <div
                    className={`${item.iconBg} ${item.iconBorder} mb-3 flex h-9 w-9 items-center justify-center rounded-lg border text-base`}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-heading text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-void-light/10 rounded-xl border border-slate-800/50 px-5 py-4 text-center backdrop-blur-sm">
              <p className="flex items-center justify-center gap-2 font-mono text-xs text-slate-500">
                <span className="bg-neon-green h-1.5 w-1.5 animate-pulse rounded-full" />
                Watching for portal — this page refreshes automatically
              </p>
            </div>
          </div>
        )}

        {status?.status === "approved" && (
          <div className="space-y-10 text-center">
            <div>
              <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                <span className="bg-neon-green/30 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-neon-green/15 border-neon-green/50 relative inline-flex h-24 w-24 items-center justify-center rounded-full border-2">
                  <svg
                    className="text-neon-green h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <p className="text-neon-green mb-3 font-mono text-xs tracking-[0.3em] uppercase">
                [ PORTAL READY ]
              </p>
              <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
                You&rsquo;re all set!
              </h1>
              <p className="mx-auto mt-4 max-w-md text-slate-400">Taking you to your portal now…</p>
            </div>

            <div className="bg-void-light/30 rounded-2xl border border-slate-800 p-8 backdrop-blur-sm">
              <SystemIndicator activeStep={3} />
            </div>

            {status.portalToken && (
              <a
                href={`/portal/${status.portalToken}`}
                className="bg-neon-green/10 border-neon-green/50 text-neon-green hover:bg-neon-green/20 inline-flex items-center gap-2 rounded-lg border px-8 py-3.5 font-mono text-sm font-semibold transition-all hover:shadow-[0_0_25px_rgba(34,197,94,0.25)]"
              >
                Enter your portal
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 14 14"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1 7h12M8 2l5 5-5 5" />
                </svg>
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function WaitingRoomClient() {
  return (
    <Suspense
      fallback={
        <div className="bg-void flex min-h-screen items-center justify-center">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <WaitingRoomContent />
    </Suspense>
  );
}
