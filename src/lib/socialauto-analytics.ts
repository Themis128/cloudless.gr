/**
 * SocialAuto analytics webhook sender.
 *
 * Sends homepage engagement events from cloudless.gr to the SocialAuto
 * marketing-data hub so they can be forwarded to GA4, Plausible, and Meta
 * Conversions API from a single tenant-scoped configuration.
 *
 * The webhook is best-effort: failures are logged but never block the user flow.
 */

import { getConfig } from "@/lib/ssm-config";

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

const WEBHOOK_URL =
  process.env.SOCIALAUTO_WEB_ANALYTICS_URL ||
  "https://social.cloudless.gr/api/v1/webhooks/cloudless-analytics";

async function computeSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem("sa_session_id");
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("sa_visitor_id", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

async function isConfigured(): Promise<boolean> {
  try {
    const cfg = await getConfig();
    return Boolean(cfg.SOCIALAUTO_WEB_ANALYTICS_SECRET);
  } catch {
    return false;
  }
}

/**
 * Send a website event to SocialAuto. Runs fire-and-forget; the returned
 * promise resolves once the network request completes or fails.
 */
export async function sendSocialAutoEvent(event: SocialAutoAnalyticsEvent): Promise<void> {
  if (!(await isConfigured())) return;

  try {
    const cfg = await getConfig();
    const secret = cfg.SOCIALAUTO_WEB_ANALYTICS_SECRET;
    if (!secret) return;

    const payload = JSON.stringify({
      event: event.event,
      domain: event.domain,
      path: event.path,
      session_id: event.session_id ?? getSessionId(),
      visitor_id: event.visitor_id ?? getVisitorId(),
      referrer: event.referrer,
      locale: event.locale,
      timestamp: event.timestamp ?? Date.now(),
      payload: event.payload,
    });

    const signature = await computeSignature(payload, secret);

    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Non-fatal: analytics must never break the user flow.
  }
}

/**
 * Server-side helper: send a SocialAuto analytics event from an API route.
 * Uses Node crypto so it does not rely on Web Crypto globals.
 */
export async function sendSocialAutoEventServer(
  event: SocialAutoAnalyticsEvent,
  request?: Request
): Promise<void> {
  try {
    const cfg = await getConfig();
    const secret = cfg.SOCIALAUTO_WEB_ANALYTICS_SECRET;
    if (!secret) return;

    const payload = JSON.stringify({
      event: event.event,
      domain: event.domain,
      path: event.path,
      session_id: event.session_id,
      visitor_id: event.visitor_id,
      referrer: request?.headers.get("referer") ?? event.referrer,
      locale: event.locale,
      timestamp: event.timestamp ?? Date.now(),
      payload: event.payload,
    });

    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body: payload,
    });
  } catch {
    // Non-fatal.
  }
}
