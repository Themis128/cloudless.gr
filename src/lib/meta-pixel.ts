/**
 * Meta (Facebook) Pixel — client-side helpers.
 *
 * STATUS: Staged but not yet wired up. Activated once these are done:
 *   1. Pixel created in Events Manager → ID populated in
 *      NEXT_PUBLIC_META_PIXEL_ID env var (and SSM).
 *   2. <Script> base init added to src/app/layout.tsx (see meta-account-runbook.md
 *      step C.5).
 *
 * Until then, calls to trackPixelEvent are no-ops in the browser
 * (window.fbq is undefined) — safe to import early.
 *
 * Use trackPixelEvent for browser-side standard events (Lead, Contact,
 * SubmitApplication, Purchase, etc.). Pair every call with the matching
 * server-side sendCapiEvent in lib/meta-capi.ts using the SAME eventId
 * for deduplication.
 *
 * Reference: https://developers.facebook.com/docs/meta-pixel/reference
 */

declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom" | "consent",
      eventName?: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/**
 * Returns true if the Pixel base script has loaded and fbq is available.
 * Useful for opt-in event tracking in components without crashing SSR.
 */
export function isPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Track a Meta standard or custom event.
 *
 * @param eventName  e.g. "Lead", "Contact", "Purchase", or any custom name
 * @param params     standard event params (value, currency, content_name, etc.)
 * @param eventId    REQUIRED for deduplication when also sending via CAPI.
 *                   Generate one ID (uuid or a hash of email+timestamp) and
 *                   pass it BOTH here and to sendCapiEvent on the server.
 */
export function trackPixelEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  eventId?: string,
): void {
  if (!isPixelReady()) return;
  try {
    window.fbq?.("track", eventName, params, eventId ? { eventID: eventId } : undefined);
  } catch (err) {
    // Pixel failures must never break the user flow.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[meta-pixel] track failed", err);
    }
  }
}

/**
 * Generate a unique event ID for a given form submission.
 *
 * The browser pixel and the matching server CAPI call MUST share the same
 * eventId so Meta can dedupe them — generate ONCE per event (e.g. on the
 * server when the request comes in) and pass the same value to both sides.
 *
 * The output is unique per call (includes Date.now() and a random suffix);
 * it is NOT deterministic. For deterministic dedup keys (e.g. order-based),
 * pass your own ID directly.
 */
export function generateEventId(prefix: string, ...parts: (string | number)[]): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return [prefix, Date.now(), rand, ...parts].filter(Boolean).join("-");
}
