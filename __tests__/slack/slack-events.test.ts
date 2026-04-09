import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock slack-verify — all route tests control verification at this boundary
// ---------------------------------------------------------------------------

const mockVerify = vi.fn();

vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((reason: string) => {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }),
}));

vi.mock("@/lib/integrations", () => ({
  getSlackConfig: vi.fn(() => ({
    SLACK_BOT_TOKEN: "xoxb-test-token",
    SLACK_SIGNING_SECRET: "test-secret",
    SLACK_WEBHOOK_URL: "",
  })),
  resetSlackConfigCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyOk(body: string) {
  mockVerify.mockResolvedValue({ ok: true, body });
}

function verifyFail(reason = "Signature mismatch") {
  mockVerify.mockResolvedValue({ ok: false, reason });
}

function makeRequest(body: object): Request {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    headers: {
      "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-slack-signature": "v0=test",
      "content-type": "application/json",
    },
    body: raw,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/slack/events", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/slack/events/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Signature verification ---

  it("returns 401 when signature verification fails", async () => {
    verifyFail("Signature mismatch");
    const request = makeRequest({ type: "event_callback" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  // --- URL verification challenge ---

  it("responds to url_verification challenge with the challenge value", async () => {
    const body = { type: "url_verification", challenge: "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P", token: "Jhj5dZrVaK7ZwHHjRyZWjbDl" };
    verifyOk(JSON.stringify(body));

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.challenge).toBe("3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P");
  });

  // --- Event callback: app_mention ---

  it("returns 200 for app_mention event and calls chat.postMessage", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const body = {
      type: "event_callback",
      team_id: "T123",
      event_id: "Ev123",
      event_time: Math.floor(Date.now() / 1000),
      event: {
        type: "app_mention",
        user: "U123",
        text: "<@U456> status",
        channel: "C123",
        ts: "1234567890.000001",
      },
    };
    verifyOk(JSON.stringify(body));

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // Allow async handlers to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("responds to app_mention with status text when 'status' is in the message", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const body = {
      type: "event_callback",
      team_id: "T123",
      event_id: "Ev001",
      event_time: Math.floor(Date.now() / 1000),
      event: {
        type: "app_mention",
        user: "U123",
        text: "<@UBOT> status check",
        channel: "C123",
        ts: "1234567890.000002",
      },
    };
    verifyOk(JSON.stringify(body));

    await POST(makeRequest(body));
    await new Promise((r) => setTimeout(r, 50));

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(opts.body as string);
    expect(sentBody.text).toContain("online");
  });

  it("responds to app_mention with help text when 'help' is in the message", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const body = {
      type: "event_callback",
      team_id: "T123",
      event_id: "Ev002",
      event_time: Math.floor(Date.now() / 1000),
      event: {
        type: "app_mention",
        user: "U123",
        text: "<@UBOT> help please",
        channel: "C123",
        ts: "1234567890.000003",
      },
    };
    verifyOk(JSON.stringify(body));

    await POST(makeRequest(body));
    await new Promise((r) => setTimeout(r, 50));

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(opts.body as string);
    expect(sentBody.text).toContain("cloudless-status");
  });

  // --- Bot message filtering ---

  it("ignores messages with bot_id to prevent feedback loops", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const body = {
      type: "event_callback",
      team_id: "T123",
      event_id: "Ev003",
      event_time: Math.floor(Date.now() / 1000),
      event: {
        type: "app_mention",
        bot_id: "B123",
        text: "<@UBOT> status",
        channel: "C123",
        ts: "1234567890.000004",
      },
    };
    verifyOk(JSON.stringify(body));

    await POST(makeRequest(body));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Unknown event types ---

  it("returns 200 for unknown event types without calling fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const body = {
      type: "event_callback",
      team_id: "T123",
      event_id: "Ev999",
      event_time: Math.floor(Date.now() / 1000),
      event: { type: "reaction_added", user: "U123" },
    };
    verifyOk(JSON.stringify(body));

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Invalid JSON ---

  it("returns 400 for invalid JSON body", async () => {
    mockVerify.mockResolvedValue({ ok: true, body: "not-json{{{" });

    const response = await POST(
      new Request("http://localhost/api/slack/events", {
        method: "POST",
        headers: { "x-slack-request-timestamp": "123", "x-slack-signature": "v0=abc" },
        body: "not-json{{{",
      }),
    );

    expect(response.status).toBe(400);
  });
});
