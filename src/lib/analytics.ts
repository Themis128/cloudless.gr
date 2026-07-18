/**
 * Analytics event sink — R2 primary with S3 fallback.
 *
 * The primary implementation now uses analytics-r2.ts which provides R2
 * for Workers and S3 for Lambda compatibility. This module re-exports
 * trackEvent for backward compatibility.
 */

import { trackEvent as trackEventR2, type AnalyticsEvent } from "@/lib/analytics-r2";

// Re-export AnalyticsEvent interface
export type { AnalyticsEvent } from "@/lib/analytics-r2";

/**
 * Track an analytics event.
 * Uses R2 in Workers environment, S3 in Lambda.
 * Fire-and-forget (errors are logged but not thrown).
 */
export function trackS3Event(evt: AnalyticsEvent): void {
  // Delegate to the unified analytics-r2 module
  // In Workers, env.DATALAKE_BUCKET is used; in Lambda, S3 falls back
  // The global binding is injected at runtime in Workers
  const env = (globalThis as any).__ENV__ ?? {};
  trackEventR2(env, evt);
}

// Re-export trackEvent for new code paths
export { trackEvent, trackR2Event } from "@/lib/analytics-r2";