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
      timestamp: event.timestamp ?? Date.now(),
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
