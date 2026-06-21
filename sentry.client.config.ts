import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // R14: browser events are blind to which surface served them (both serve
  // the same bundle behind the LB). Use NEXT_PUBLIC_SENTRY_ENVIRONMENT for
  // an explicit override (e.g. staging, preview); otherwise NODE_ENV.
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /ChunkLoadError/,
    /Loading chunk \d+ failed/,
    "NetworkError when attempting to fetch resource.",
    "Failed to fetch",
  ],
  // Strip token-shaped values from URLs and breadcrumb data before sending.
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  tunnel: "/monitoring",
});
