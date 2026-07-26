import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createHmac } from "crypto";

const getSlackConfigAsyncMock = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: () => getSlackConfigAsyncMock(),
}));

const SIGNING_SECRET = "test-signing-secret";

function sign(timestamp: string, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  const hex = createHmac("sha256", SIGNING_SECRET).update(base, "utf8").digest("hex");
  return `v0=${hex}`;
}

function buildRequest(opts: {
  body: string;
  timestamp: string;
  signature?: string;
  omitTimestamp?: boolean;
  omitSignature?: boolean;
}): Request {
  const headers: Record<string, string> = {};
  if (!opts.omitTimestamp) headers["x-slack-request-timestamp"] = opts.timestamp;
  if (!opts.omitSignature)
    headers["x-slack-signature"] = opts.signature ?? sign(opts.timestamp, opts.body);
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    headers,
    body: opts.body,
  });
}

describe("slack-verify.verifySlackRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
    getSlackConfigAsyncMock.mockResolvedValue({
      SLACK_SIGNING_SECRET: SIGNING_SECRET,
    });
    // Make sure no stale env var bypasses the integration cache.
    delete process.env.SLACK_SIGNING_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when SLACK_SIGNING_SECRET is explicitly empty in env", async () => {
    process.env.SLACK_SIGNING_SECRET = "";
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const r = await verifySlackRequest(buildRequest({ body: "{}", timestamp: ts }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/SLACK_SIGNING_SECRET/);
  });

  it("rejects when async config returns no secret", async () => {
    getSlackConfigAsyncMock.mockResolvedValueOnce({ SLACK_SIGNING_SECRET: "" });
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const r = await verifySlackRequest(buildRequest({ body: "{}", timestamp: ts }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/SLACK_SIGNING_SECRET/);
  });

  it("rejects requests missing the timestamp header", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const r = await verifySlackRequest(
      buildRequest({ body: "{}", timestamp: ts, omitTimestamp: true })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/timestamp/i);
  });

  it("rejects requests missing the signature header", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const r = await verifySlackRequest(
      buildRequest({ body: "{}", timestamp: ts, omitSignature: true })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/signature/i);
  });

  it("rejects requests older than 5 minutes (replay protection)", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    // 10 minutes ago — past the MAX_AGE_SECONDS window.
    const ts = (Math.floor(Date.now() / 1000) - 600).toString();
    const r = await verifySlackRequest(buildRequest({ body: "{}", timestamp: ts }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/timestamp.*too old/i);
  });

  it("rejects a tampered signature", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "ping" });
    const r = await verifySlackRequest(
      buildRequest({
        body,
        timestamp: ts,
        signature: "v0=" + "f".repeat(64),
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/signature mismatch|comparison failed/i);
  });

  it("accepts a request with a correct signature and returns the body", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "ping", id: "evt-1" });
    const r = await verifySlackRequest(buildRequest({ body, timestamp: ts }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toBe(body);
  });

  it("detects replay of an already-seen valid signature", async () => {
    const { verifySlackRequest } = await import("@/lib/slack-verify");
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "ping", id: "evt-replay" });

    const first = await verifySlackRequest(buildRequest({ body, timestamp: ts }));
    expect(first.ok).toBe(true);

    const second = await verifySlackRequest(buildRequest({ body, timestamp: ts }));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/replay/i);
  });
});

describe("slack-verify.unauthorizedSlack", () => {
  it("returns a 401 JSON response with the documented shape", async () => {
    const { unauthorizedSlack } = await import("@/lib/slack-verify");
    const r = unauthorizedSlack("missing signature");
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
