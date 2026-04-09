/**
 * Slack request signature verification.
 *
 * Every incoming request from Slack (Events API, slash commands, interactions)
 * is signed with the app's Signing Secret using HMAC-SHA256.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * This module verifies that signature before any handler processes the payload.
 * Uses the Node.js built-in `crypto` module — no extra dependencies needed.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getSlackConfig } from "@/lib/integrations";

/** Maximum age of a request timestamp before it is considered a replay. */
const MAX_AGE_SECONDS = 60 * 5; // 5 minutes

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verifies the Slack request signature on an incoming Request.
 *
 * Reads the raw body as text — callers must NOT consume `request.body` before
 * calling this function. Returns the raw body string on success so the caller
 * does not need to read it again.
 */
export async function verifySlackRequest(request: Request): Promise<{ ok: true; body: string } | { ok: false; reason: string }> {
  const { SLACK_SIGNING_SECRET } = getSlackConfig();

  if (!SLACK_SIGNING_SECRET) {
    return { ok: false, reason: "SLACK_SIGNING_SECRET is not configured" };
  }

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!timestamp || !signature) {
    return { ok: false, reason: "Missing x-slack-request-timestamp or x-slack-signature header" };
  }

  // Reject requests older than MAX_AGE_SECONDS (replay attack prevention)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const requestAge = Math.abs(nowSeconds - Number(timestamp));
  if (requestAge > MAX_AGE_SECONDS) {
    return { ok: false, reason: `Request timestamp is too old (${requestAge}s)` };
  }

  const body = await request.text();
  const sigBaseString = `v0:${timestamp}:${body}`;

  const expectedHex = createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(sigBaseString, "utf8")
    .digest("hex");

  const expected = `v0=${expectedHex}`;

  // Constant-time comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (sigBuffer.length !== expectedBuffer.length) {
      return { ok: false, reason: "Signature mismatch" };
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { ok: false, reason: "Signature mismatch" };
    }
  } catch {
    return { ok: false, reason: "Signature comparison failed" };
  }

  return { ok: true, body };
}

/**
 * Returns a standard 401 response for failed Slack signature verification.
 * Use this as a one-liner in route handlers.
 */
export function unauthorizedSlack(reason: string): Response {
  console.warn(`[Slack] Signature verification failed: ${reason}`);
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
