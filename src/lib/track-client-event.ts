/**
 * Safe, multi-sink client-side event tracker.
 *
 * Fires to whichever analytics providers are present in the browser:
 *   - Google Analytics / Tag Manager (gtag)
 *   - Plausible (window.plausible)
 *   - Meta Pixel (window.fbq)
 *
 * All calls are guarded and swallowed on failure so analytics can never
 * break the user flow or crash SSR.
 *
 * Use for click/interaction events where server-side tracking is not
 * practical (e.g. outbound/internal link clicks, inline widget interactions).
 * For form submissions, prefer server-side CAPI/datalake events and use
 * this as a supplementary browser-side signal.
 */

import { trackPixelEvent } from "@/lib/meta-pixel";
import { sendSocialAutoEvent, type SocialAutoAnalyticsEvent } from "@/lib/socialauto-analytics";

type GtagFn = (
  _command: "event" | "config" | "consent" | "js",
  _eventName?: string,
  _params?: Record<string, unknown>
) => void;

type PlausibleFn = (_eventName: string, _options?: { props?: Record<string, unknown> }) => void;

type WindowWithAnalytics = Window & {
  gtag?: GtagFn;
  plausible?: PlausibleFn;
};

export interface TrackEventOptions {
  /** Event name. Keep lowercase_with_underscores for consistency. */
  name: string;
  /** Extra dimensions attached to every sink that supports them. */
  params?: Record<string, unknown>;
}

function getAnalyticsWindow(): WindowWithAnalytics | null {
  if (typeof window === "undefined") return null;
  return window as unknown as WindowWithAnalytics;
}

export function trackClientEvent(
  name: string,
  params: Record<string, unknown> = {},
  options: { path?: string; locale?: string } = {}
): void {
  const w = getAnalyticsWindow();

  // SocialAuto analytics hub — fire-and-forget; non-blocking.
  if (typeof window !== "undefined") {
    const saEvent: SocialAutoAnalyticsEvent = {
      event: name,
      domain: "cloudless.gr",
      path: options.path ?? window.location?.pathname,
      referrer: document.referrer || undefined,
      locale: options.locale ?? document.documentElement.lang,
      timestamp: Date.now(),
      payload: params,
    };
    sendSocialAutoEvent(saEvent).catch(() => {});
  }

  if (!w) return;

  // Google Analytics 4 / GTM — gtag("event", name, params)
  try {
    if (typeof w.gtag === "function") {
      w.gtag("event", name, params);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] gtag event failed", err);
    }
  }

  // Plausible — window.plausible(name, { props: params })
  try {
    if (typeof w.plausible === "function") {
      w.plausible(name, { props: params });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] plausible event failed", err);
    }
  }

  // Meta Pixel — fbq("trackCustom", name, params)
  trackPixelEvent(name, params);
}
