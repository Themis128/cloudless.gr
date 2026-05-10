import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";
import type { Event, EventHint } from "@sentry/nextjs";

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

function maybeAlertSlack(event: Event, hint?: EventHint): void {
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
  environment: process.env.NODE_ENV,
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
  beforeSend(event: Event, hint?: EventHint) {
    maybeAlertSlack(event, hint);
    return scrubEvent(event, hint);
  },
  beforeBreadcrumb: scrubBreadcrumb,
  debug: false,
});
