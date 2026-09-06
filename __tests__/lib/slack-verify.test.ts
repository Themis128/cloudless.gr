import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const { mockGetSlackConfig } = vi.hoisted(() => ({ mockGetSlackConfig: vi.fn() }));

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: mockGetSlackConfig,
}));

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";

const SECRET = "slack-signing-secret-xyz";

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
}): Request {
  const { timestamp, signature, body = "" } = opts;
  const headers: Record<string, string> = {};
  if (timestamp) headers["x-slack-request-timestamp"] = timestamp;
  if (signature) headers["x-slack-signature"] = signature;
  return new Request("https://example.com/api/slack", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  mockGetSlackConfig.mockResolvedValue({ SLACK_SIGNING_SECRET: SECRET });
});

describe("verifySlackRequest", () => {
  it("returns ok:false when signing secret is not configured", async () => {
    mockGetSlackConfig.mockResolvedValue({ SLACK_SIGNING_SECRET: "" });
    const req = makeRequest({ timestamp: makeTimestamp(), signature: "v0=abc" });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when timestamp header is missing", async () => {
    const req = makeRequest({ signature: "v0=abc" });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when signature header is missing", async () => {
    const req = makeRequest({ timestamp: makeTimestamp() });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when timestamp is too old", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 400);
    const body = "payload";
    const sig = makeSignature(SECRET, old, body);
    const req = makeRequest({ timestamp: old, signature: sig, body });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too old/i);
  });

  it("returns ok:false when signature does not match", async () => {
    const ts = makeTimestamp();
    const req = makeRequest({ timestamp: ts, signature: "v0=badsig", body: "payload" });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(false);
  });

  it("returns ok:true with a valid signature", async () => {
    const ts = makeTimestamp();
    const body = "command=%2Fhello&user_id=U123";
    const sig = makeSignature(SECRET, ts, body);
    const req = makeRequest({ timestamp: ts, signature: sig, body });
    const result = await verifySlackRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toBe(body);
  });
});

describe("unauthorizedSlack", () => {
  it("returns a 401 Response", () => {
    const res = unauthorizedSlack("Signature mismatch");
    expect(res.status).toBe(401);
  });

  it("includes the reason in the log (does not throw)", () => {
    expect(() => unauthorizedSlack("bad sig", new Request("https://example.com"))).not.toThrow();
  });
});
