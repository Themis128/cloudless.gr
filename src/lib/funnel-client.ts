/**
 * Client helper: consent-gated funnel beacon → POST /api/analytics/track
 * Events land in Cloudflare D1 (search_funnel_events) when AUTH_DB is bound.
 */

import type { FunnelEventType } from "@/lib/search-funnel";

const SESSION_KEY = "cloudless_funnel_sid";

/** Cryptographically strong session id (never Math.random — CodeQL js/insecure-randomness). */
function newFunnelSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `sid_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  return `anon_${Date.now()}`;
}

export function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const raw = document.cookie.match(/(?:^|; )cookieConsent=([^;]+)/)?.[1];
    if (!raw) return false;
    return JSON.parse(decodeURIComponent(raw)).analytics === true;
  } catch {
    return false;
  }
}

export function getFunnelSessionId(): string {
  if (typeof globalThis.sessionStorage === "undefined") {
    return `anon_${Date.now()}`;
  }
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = newFunnelSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

/**
 * Consent-gated page_view beacon → POST /api/track → D1 analytics_events.
 * Captures utm_source/medium/campaign so the attribution + acquisition
 * gold sections have real data. Fires once per SPA navigation.
 */
export function trackPageView(): void {
  if (typeof globalThis.fetch !== "function") return;
  if (!hasAnalyticsConsent()) return;

  const params =
    typeof globalThis.location !== "undefined"
      ? new URLSearchParams(globalThis.location.search)
      : null;
  const body = {
    type: "page_view",
    session_id: getFunnelSessionId(),
    page: globalThis.location?.pathname ?? "/",
    utm_source: params?.get("utm_source") ?? undefined,
    utm_medium: params?.get("utm_medium") ?? undefined,
    utm_campaign: params?.get("utm_campaign") ?? undefined,
  };

  globalThis
    .fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
    .catch(() => {});
}

export function trackFunnelEvent(
  event: FunnelEventType,
  properties: Record<string, unknown> = {}
): void {
  if (typeof globalThis.fetch !== "function") return;
  if (!hasAnalyticsConsent()) return;

  const body = {
    event,
    session_id: getFunnelSessionId(),
    page: typeof globalThis.location !== "undefined" ? globalThis.location.pathname : "/store",
    properties,
  };

  globalThis
    .fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
    .catch(() => {});
}
