/**
 * SocialAuto analytics — shared types + browser-safe client sender.
 *
 * Client posts to same-origin `/api/analytics/event`; the API route signs and
 * forwards to SocialAuto. Keep this module free of Node-only imports so it can
 * be bundled into client components (TrackedLink → track-client-event).
 *
 * Server signing lives in `@/lib/socialauto-analytics-server`.
 */

export interface SocialAutoAnalyticsEvent {
  event: string;
  domain: string;
  path?: string;
  session_id?: string;
  visitor_id?: string;
  referrer?: string;
  locale?: string;
  timestamp?: number;
  payload?: Record<string, unknown>;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE_KEY = "sa_utm_first_touch";

/**
 * First-touch UTM attribution: ad/landing URLs carry utm_* only on entry;
 * persist them for the session so every later event attributes correctly.
 * Current-URL params win over stored ones (explicit new campaign).
 */
function getUtmParams(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) Object.assign(out, JSON.parse(stored));
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    const fresh: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) fresh[k] = v;
    }
    if (Object.keys(fresh).length) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify({ ...out, ...fresh }));
      Object.assign(out, fresh);
    }
  } catch {
    // storage/URL unavailable — skip attribution
  }
  return out;
}

function randomIdPart(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function getSessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem("sa_session_id");
    if (!id) {
      id = `${Date.now()}-${randomIdPart()}`;
      sessionStorage.setItem("sa_session_id", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function getVisitorId(): string | undefined {
  try {
    let id = localStorage.getItem("sa_visitor_id");
    if (!id) {
      id = `${Date.now()}-${randomIdPart()}`;
      localStorage.setItem("sa_visitor_id", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Send a website event to the local analytics relay (fire-and-forget).
 */
export async function sendSocialAutoEvent(event: SocialAutoAnalyticsEvent): Promise<void> {
  try {
    const payload = JSON.stringify({
      ...event,
      session_id: event.session_id ?? getSessionId(),
      visitor_id: event.visitor_id ?? getVisitorId(),
      referrer:
        event.referrer ??
        (typeof document !== "undefined" ? document.referrer || undefined : undefined),
      timestamp: event.timestamp ?? Date.now(),
      payload: { ...getUtmParams(), ...(event.payload ?? {}) },
    });

    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Non-fatal: analytics must never break the user flow.
  }
}
