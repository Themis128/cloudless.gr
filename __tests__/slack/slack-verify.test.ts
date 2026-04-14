import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { resetSlackConfigCache } from "@/lib/integrations";

const TEST_SIGNING_SECRET = "test-signing-secret-32chars-padded";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignature(secret: string, timestamp: string, body: string): string {
  const sigBase = `v0:${timestamp}:${body}`;
  const hex = createHmac("sha256", secret).update(sigBase, "utf8").digest("hex");
  return `v0=${hex}`;
}

function nowTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

function makeRequest(body: string, signature: string, timestamp: string): Request {
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
      "content-type": "application/json",
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifySlackRequest", () => {
  let verifySlackRequest: (typeof import("@/lib/slack-verify"))["verifySlackRequest"];
  let unauthorizedSlack: (typeof import("@/lib/slack-verify"))["unauthorizedSlack"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-verify");
    verifySlackRequest = mod.verifySlackRequest;
    unauthorizedSlack = mod.unauthorizedSlack;
  });

  it("returns ok:true with body for a valid signature", async () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "abc123" });
    const ts = nowTs();
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, body);

    const result = await verifySlackRequest(makeRequest(body, sig, ts));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toBe(body);
    }
  });

  it("returns ok:false when SLACK_SIGNING_SECRET is not set", async () => {
    vi.stubEnv("SLACK_SIGNING_SECRET", "");
    resetSlackConfigCache();

    const body = "{}";
    const ts = nowTs();
    const sig = makeSignature("", ts, body);
    const result = await verifySlackRequest(makeRequest(body, sig, ts));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/SLACK_SIGNING_SECRET/);
    }
  });

  it("returns ok:false when x-slack-request-timestamp header is missing", async () => {
    const body = "{}";
    const sig = makeSignature(TEST_SIGNING_SECRET, nowTs(), body);
    const request = new Request("http://localhost/api/slack/events", {
      method: "POST",
      headers: { "x-slack-signature": sig },
      body,
    });

    const result = await verifySlackRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/timestamp/i);
    }
  });

  it("returns ok:false when x-slack-signature header is missing", async () => {
    const body = "{}";
    const ts = nowTs();
    const request = new Request("http://localhost/api/slack/events", {
      method: "POST",
      headers: { "x-slack-request-timestamp": ts },
      body,
    });

    const result = await verifySlackRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/signature/i);
    }
  });

  it("returns ok:false for a timestamp older than 5 minutes", async () => {
    const body = "{}";
    // 6 minutes ago
    const staleTs = String(Math.floor(Date.now() / 1000) - 361);
    const sig = makeSignature(TEST_SIGNING_SECRET, staleTs, body);

    const result = await verifySlackRequest(makeRequest(body, sig, staleTs));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/old/i);
    }
  });

  it("returns ok:false for a timestamp in the future beyond 5 minutes", async () => {
    const body = "{}";
    const futureTs = String(Math.floor(Date.now() / 1000) + 361);
    const sig = makeSignature(TEST_SIGNING_SECRET, futureTs, body);

    const result = await verifySlackRequest(makeRequest(body, sig, futureTs));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/old/i);
    }
  });

  it("returns ok:false when the signature does not match the body", async () => {
    const body = '{"type":"event_callback"}';
    const tamperedBody = '{"type":"malicious"}';
    const ts = nowTs();
    // Signature is for the original body, but we send a tampered body
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, body);

    const result = await verifySlackRequest(makeRequest(tamperedBody, sig, ts));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/mismatch/i);
    }
  });

  it("returns ok:false when signature uses wrong secret", async () => {
    const body = "{}";
    const ts = nowTs();
    const sig = makeSignature("wrong-secret", ts, body);

    const result = await verifySlackRequest(makeRequest(body, sig, ts));

    expect(result.ok).toBe(false);
  });

  it("accepts requests within 5 minutes of the timestamp", async () => {
    const body = '{"type":"url_verification","challenge":"xyz"}';
    // 4 minutes ago — still valid
    const ts = String(Math.floor(Date.now() / 1000) - 240);
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, body);

    const result = await verifySlackRequest(makeRequest(body, sig, ts));

    expect(result.ok).toBe(true);
  });

  it("unauthorizedSlack returns a 401 Response", () => {
    const res = unauthorizedSlack("test reason");
    expect(res.status).toBe(401);
  });
});
