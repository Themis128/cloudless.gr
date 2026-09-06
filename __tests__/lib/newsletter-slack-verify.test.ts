import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));

vi.mock("@/lib/newsletter-slack-config", () => ({
  getNewsletterSlackConfigAsync: mockGetCfg,
  resetNewsletterSlackConfigCache: vi.fn(),
}));

import { verifyNewsletterSlackRequest } from "@/lib/newsletter-slack-verify";

const SECRET = "test-signing-secret-abc123";

function makeTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function makeSignature(secret: string, timestamp: string, body: string): string {
  const sigBase = `v0:${timestamp}:${body}`;
  const hex = createHmac("sha256", secret).update(sigBase, "utf8").digest("hex");
  return `v0=${hex}`;
}

function makeRequest(opts: {
  timestamp?: string;
  signature?: string;
  body?: string;
  headers?: Record<string, string>;
}): Request {
  const { timestamp, signature, body = "", headers = {} } = opts;
  const init: Record<string, string> = { ...headers };
  if (timestamp !== undefined) init["x-slack-request-timestamp"] = timestamp;
  if (signature !== undefined) init["x-slack-signature"] = signature;
  return new Request("https://example.com/api/newsletter-slack", {
    method: "POST",
    headers: init,
    body,
  });
}

beforeEach(() => {
  mockGetCfg.mockResolvedValue({ NEWSLETTER_SLACK_SIGNING_SECRET: SECRET });
});

describe("verifyNewsletterSlackRequest", () => {
  it("returns ok:false when no signing secret is configured", async () => {
    mockGetCfg.mockResolvedValue({ NEWSLETTER_SLACK_SIGNING_SECRET: "" });
    const req = makeRequest({ timestamp: makeTimestamp(), signature: "v0=abc", body: "" });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when timestamp header is missing", async () => {
    const req = makeRequest({ signature: "v0=abc", body: "payload" });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Missing/i);
  });

  it("returns ok:false when signature header is missing", async () => {
    const req = makeRequest({ timestamp: makeTimestamp(), body: "payload" });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when timestamp is too old", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 400);
    const body = "payload";
    const sig = makeSignature(SECRET, old, body);
    const req = makeRequest({ timestamp: old, signature: sig, body });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too old/i);
  });

  it("returns ok:false when signature does not match", async () => {
    const ts = makeTimestamp();
    const req = makeRequest({ timestamp: ts, signature: "v0=wrongsig", body: "payload" });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Signature/i);
  });

  it("returns ok:true with valid signature", async () => {
    const ts = makeTimestamp();
    const body = "command=%2Ftest&user_id=U123";
    const sig = makeSignature(SECRET, ts, body);
    const req = makeRequest({ timestamp: ts, signature: sig, body });
    const result = await verifyNewsletterSlackRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toBe(body);
  });
});
