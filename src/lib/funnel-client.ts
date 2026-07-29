/**
 * Client helper: consent-gated funnel beacon → POST /api/analytics/track
 * Events land in Cloudflare D1 (search_funnel_events) when AUTH_DB is bound.
 */

import type { FunnelEventType } from "@/lib/search-funnel";

const SESSION_KEY = "cloudless_funnel_sid";

function hasAnalyticsConsent(): boolean {
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
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `sid_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
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
