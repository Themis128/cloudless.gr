import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  // R14: prefer SENTRY_ENVIRONMENT (per-surface env) over NODE_ENV.
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
