/**
 * Signature verification for the dedicated Newsletter Slack app.
 *
 * Mirrors src/lib/slack-verify.ts but reads NEWSLETTER_SLACK_SIGNING_SECRET
 * (the secret of the SEPARATE Slack app at api.slack.com whose request URLs
 * point to /api/newsletter-slack/*). Keeping verification logic per-app means
 * a leaked or rotated secret on one cannot let the other in.
 *
 * Reference: https://docs.slack.dev/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getNewsletterSlackConfigAsync } from "@/lib/newsletter-slack-config";

const MAX_AGE_SECONDS = 60 * 5;
const SEEN_TTL_MS = MAX_AGE_SECONDS * 1000;

const seenSignatures = new Map<string, number>();

function isReplay(signature: string): boolean {
  const now = Date.now();
  for (const [sig, ts] of seenSignatures) {
    if (now - ts > SEEN_TTL_MS) seenSignatures.delete(sig);
  }
  if (seenSignatures.has(signature)) return true;
  seenSignatures.set(signature, now);
  return false;
}

export async function verifyNewsletterSlackRequest(
  request: Request
): Promise<{ ok: true; body: string } | { ok: false; reason: string }> {
  const envSecret = process.env.NEWSLETTER_SLACK_SIGNING_SECRET;
  if (envSecret !== undefined && !envSecret) {
    return { ok: false, reason: "NEWSLETTER_SLACK_SIGNING_SECRET is not configured" };
  }

  const cfg = await getNewsletterSlackConfigAsync();
  if (!cfg.NEWSLETTER_SLACK_SIGNING_SECRET) {
    return { ok: false, reason: "NEWSLETTER_SLACK_SIGNING_SECRET is not configured" };
  }

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature) {
    return { ok: false, reason: "Missing x-slack-request-timestamp or x-slack-signature header" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const requestAge = Math.abs(nowSeconds - Number(timestamp));
  if (requestAge > MAX_AGE_SECONDS) {
    return { ok: false, reason: `Request timestamp is too old (${requestAge}s)` };
  }

  const body = await request.text();
  const sigBaseString = `v0:${timestamp}:${body}`;
  const expectedHex = createHmac("sha256", cfg.NEWSLETTER_SLACK_SIGNING_SECRET)
    .update(sigBaseString, "utf8")
    .digest("hex");
  const expected = `v0=${expectedHex}`;

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

  if (isReplay(signature)) {
    return { ok: false, reason: "Duplicate request (replay detected)" };
  }

  return { ok: true, body };
}

export function unauthorizedNewsletterSlack(reason: string): Response {
  console.warn(`[NewsletterSlack] Signature verification failed: ${reason}`);
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
