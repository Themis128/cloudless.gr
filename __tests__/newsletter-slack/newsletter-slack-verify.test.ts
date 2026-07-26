/**
 * Unit tests for the dedicated Newsletter Slack signature verifier.
 *
 * Covers the same surface as __tests__/slack/slack-verify.test.ts but for
 * the second app's verifier (NEWSLETTER_SLACK_SIGNING_SECRET). Keeps the
 * two verifiers' behaviour locked together so a regression on one is
 * caught on both.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "crypto";
import {
  verifyNewsletterSlackRequest,
  unauthorizedNewsletterSlack,
} from "@/lib/newsletter-slack-verify";
import { resetNewsletterSlackConfigCache } from "@/lib/newsletter-slack-config";

const SECRET = "test-newsletter-signing-secret-32chr";

function signRequest(body: string, timestamp: number, secret = SECRET): string {
  const base = `v0:${timestamp}:${body}`;
  return "v0=" + createHmac("sha256", secret).update(base, "utf8").digest("hex");
}

function makeRequest(
  body: string,
  timestamp: number,
  options: { signature?: string; missingHeaders?: boolean } = {}
): Request {
  const headers: Record<string, string> = {};
  if (!options.missingHeaders) {
    headers["x-slack-request-timestamp"] = String(timestamp);
    headers["x-slack-signature"] = options.signature ?? signRequest(body, timestamp);
  }
  return new Request("http://localhost/api/newsletter-slack/commands", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  resetNewsletterSlackConfigCache();
  process.env.NEWSLETTER_SLACK_SIGNING_SECRET = SECRET;
});

describe("verifyNewsletterSlackRequest", () => {
  it("accepts a freshly-signed request", async () => {
    const body = "command=%2Fnewsletter-list&text=";
    const ts = Math.floor(Date.now() / 1000);
    const req = makeRequest(body, ts);
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toBe(body);
  });

  it("rejects when signing secret is unset", async () => {
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "";
    resetNewsletterSlackConfigCache();
    const ts = Math.floor(Date.now() / 1000);
    const req = makeRequest("x=1", ts);
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not configured/);
  });

  it("rejects requests missing the Slack headers", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const req = makeRequest("x=1", ts, { missingHeaders: true });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Missing/);
  });

  it("rejects requests older than 5 minutes (replay window)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 6 * 60;
    const req = makeRequest("x=1", ts);
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/timestamp is too old/);
  });

  it("rejects requests signed with the wrong secret", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = "x=1";
    const wrongSig = signRequest(body, ts, "different-secret-entirely");
    const req = makeRequest(body, ts, { signature: wrongSig });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Ss]ignature mismatch/);
  });

  it("rejects malformed signatures (length mismatch)", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const req = makeRequest("x=1", ts, { signature: "v0=too-short" });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Ss]ignature mismatch/);
  });

  it("rejects the SAME signature seen twice (replay protection)", async () => {
    const body = "command=%2Fnewsletter-list&text=&_replay=" + Date.now();
    const ts = Math.floor(Date.now() / 1000);
    const sig = signRequest(body, ts);

    const first = await verifyNewsletterSlackRequest(makeRequest(body, ts, { signature: sig }));
    expect(first.ok).toBe(true);

    const second = await verifyNewsletterSlackRequest(makeRequest(body, ts, { signature: sig }));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/[Dd]uplicate|replay/);
  });

  it("does NOT cross-validate against the main Slack app's secret", async () => {
    // A request signed for the MAIN app must not pass the NEWSLETTER verifier
    // even if SLACK_SIGNING_SECRET is set in the env at the same time.
    process.env.SLACK_SIGNING_SECRET = "main-cloudless-app-secret";
    const ts = Math.floor(Date.now() / 1000);
    const body = "x=1";
    const sigForMainApp = signRequest(body, ts, "main-cloudless-app-secret");
    const req = makeRequest(body, ts, { signature: sigForMainApp });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Ss]ignature mismatch/);
  });
});

describe("unauthorizedNewsletterSlack", () => {
  it("returns a 401 JSON Response", async () => {
    const res = unauthorizedNewsletterSlack("test reason");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
