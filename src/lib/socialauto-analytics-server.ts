/**
 * SocialAuto analytics — server-only signed webhook sender.
 *
 * Do not import this from client components. Uses Node `crypto` + SSM/D1 config.
 */

import "server-only";

import { getConfig } from "@/lib/ssm-config";
import type { SocialAutoAnalyticsEvent } from "@/lib/socialauto-analytics";

const DEFAULT_WEBHOOK_URL =
  "https://social.cloudless.gr/api/v1/analytics/web/webhooks/cloudless-analytics";

/**
 * Send a SocialAuto analytics event from an API route / server handler.
 */
export async function sendSocialAutoEventServer(
  event: SocialAutoAnalyticsEvent,
  request?: Request
): Promise<void> {
  try {
    const cfg = await getConfig();
    const secret = cfg.SOCIALAUTO_WEB_ANALYTICS_SECRET;
    if (!secret) return;
    const url = cfg.SOCIALAUTO_WEB_ANALYTICS_URL || DEFAULT_WEBHOOK_URL;

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

    await fetch(url, {
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
