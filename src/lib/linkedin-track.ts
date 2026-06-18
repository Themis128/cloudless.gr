/**
 * Helper for firing LinkedIn Insight Tag conversion events.
 *
 * Usage:
 *   import { trackLinkedInConversion } from "@/lib/linkedin-track";
 *   trackLinkedInConversion(12345678); // your Campaign Manager conversion ID
 *
 * Safe to call before the Insight Tag has finished loading — the loader
 * (see `src/components/LinkedInInsightTag.tsx`) installs a queueing stub on
 * `window.lintrk` so calls are replayed once the real script attaches.
 *
 * Safe to call when marketing consent has not been granted — `lintrk` will
 * be undefined in that case and the call becomes a no-op.
 */
export function trackLinkedInConversion(conversionId: number | string): void {
  if (typeof window === "undefined") return;

  const lintrk = (window as { lintrk?: (action: string, payload?: Record<string, unknown>) => void })
    .lintrk;
  if (!lintrk) return;

  lintrk("track", { conversion_id: conversionId });
}
