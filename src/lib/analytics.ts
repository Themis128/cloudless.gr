/**
 * Analytics event sink — Cloudflare R2.
 *
 * The primary implementation uses analytics-r2.ts which provides R2
 * for Workers environment. This module re-exports trackEvent for backward compatibility.
 */

export type { AnalyticsEvent } from "@/lib/analytics-r2";

/**
 * Track an analytics event.
 * Uses R2 in Workers environment. Fire-and-forget (errors are logged but not thrown).
 */
export function trackS3Event(evt: AnalyticsEvent): void {
  // Delegate to the unified analytics-r2 module
  // The global binding is injected at runtime in Workers
  const env = (globalThis as any).__ENV__ ?? {};
  trackEventR2(env, evt);
}

// Re-export for new code paths
import { trackEvent as trackEventR2, type AnalyticsEvent } from "@/lib/analytics-r2";
export { trackEvent, trackR2Event } from "@/lib/analytics-r2";