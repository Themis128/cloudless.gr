import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";

// ---------------------------------------------------------------------------
// Slack error alerting — rate-limited to avoid spam
// ---------------------------------------------------------------------------

/** Deduplicate Slack error alerts: one alert per unique fingerprint per 5 min. */
const _alerted = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60_000;

function shouldAlert(fingerprint: string): boolean {
  const now = Date.now();
  const last = _alerted.get(fingerprint);
  if (last && now - last < ALERT_COOLDOWN_MS) return false;
  _alerted.set(fingerprint, now);
  return true;
}

function maybeAlertSlack(event: any, hint?: any): void {
  // Only alert for error-level and fatal events, not warnings or info
  if (event.level !== "error" && event.level !== "fatal") return;

  const fingerprint = (event.fingerprint ?? [event.message ?? "unknown"]).join(":");
  if (!shouldAlert(fingerprint)) return;

  const err = hint?.originalException;
  const route = (event.request?.url ?? "").replace("https://cloudless.gr", "") || undefined;

  // Lazy import to avoid circular dependency at module load time
  import("@/lib/slack-notify")
    .then(({ slackErrorNotify }) =>
      slackErrorNotify({
        title: event.message ?? (err instanceof Error ? err.name : "Server error"),
        message: err instanceof Error ? err.message : (event.message ?? "An unhandled server error occurred."),
        route,
        error: err ?? undefined,
      }),
    )
    .catch(() => {/* never block */});
}

// ---------------------------------------------------------------------------
// Sentry init
// ---------------------------------------------------------------------------

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // R14: prefer SENTRY_ENVIRONMENT (set per-surface in deploy config) so failover
  // events land in the right Sentry environment instead of both being "production".
  // Lambda env: `production` · Pi k8s env: `pi-standby` · dev: NODE_ENV fallback.
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  // Turbopack hashes require-in-the-middle at dev time, breaking OTel module patching.
  // Skip OTel setup in dev; production Webpack builds work fine with it enabled.
  skipOpenTelemetrySetup: process.env.NODE_ENV === "development",
  initialScope: {
    tags: {
      "aws.region": process.env.AWS_REGION ?? "us-east-1",
    },
  },
  // Strip sensitive values from headers, query strings, request bodies, and
  // breadcrumb data before events leave the runtime.
  beforeSend: ((event: unknown, hint: unknown) => {
    maybeAlertSlack(event as any, hint as any);
    return scrubEvent(event as any, hint as any) as unknown;
  }) as any,
  beforeBreadcrumb: scrubBreadcrumb as any,
  debug: false,
});
