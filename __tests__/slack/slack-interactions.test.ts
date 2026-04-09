import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = vi.fn();

vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_reason: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyOk(payloadJson: object) {
  const formBody = new URLSearchParams({ payload: JSON.stringify(payloadJson) }).toString();
  mockVerify.mockResolvedValue({ ok: true, body: formBody });
}

function verifyFail(reason = "Signature mismatch") {
  mockVerify.mockResolvedValue({ ok: false, reason });
}

function makeRequest(payloadJson: object): Request {
  const formBody = new URLSearchParams({ payload: JSON.stringify(payloadJson) }).toString();
  return new Request("http://localhost/api/slack/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-slack-signature": "v0=test",
    },
    body: formBody,
  });
}

const baseUser = { id: "U123", username: "themis" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/slack/interactions", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });

  // --- Signature check ---

  it("returns 401 when signature verification fails", async () => {
    verifyFail();
    const response = await POST(makeRequest({ type: "block_actions", user: baseUser, actions: [] }));
    expect(response.status).toBe(401);
  });

  // --- block_actions ---

  it("returns 200 for a known button action (open_stripe_dashboard)", async () => {
    const payload = {
      type: "block_actions",
      user: baseUser,
      actions: [{ action_id: "open_stripe_dashboard", type: "button" }],
    };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  it("returns 200 for a known button action (open_store)", async () => {
    const payload = {
      type: "block_actions",
      user: baseUser,
      actions: [{ action_id: "open_store", type: "button" }],
    };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  it("returns 200 for an unknown action_id without throwing", async () => {
    const payload = {
      type: "block_actions",
      user: baseUser,
      actions: [{ action_id: "some_future_action", type: "button" }],
    };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  it("returns 200 when actions array is empty", async () => {
    const payload = { type: "block_actions", user: baseUser, actions: [] };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  // --- view_submission ---

  it("returns 200 for view_submission with unknown callback_id", async () => {
    const payload = {
      type: "view_submission",
      user: baseUser,
      view: { id: "V123", callback_id: "unknown_modal", state: { values: {} } },
    };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  // --- Unknown interaction types ---

  it("returns 200 for unknown interaction types", async () => {
    const payload = { type: "shortcut", user: baseUser, callback_id: "some_shortcut" };
    verifyOk(payload);

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });

  // --- Invalid payload ---

  it("returns 400 when payload field is missing from form body", async () => {
    const emptyFormBody = new URLSearchParams({ other_field: "value" }).toString();
    mockVerify.mockResolvedValue({ ok: true, body: emptyFormBody });

    const request = new Request("http://localhost/api/slack/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-slack-signature": "v0=test",
      },
      body: emptyFormBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when payload field contains invalid JSON", async () => {
    const badFormBody = "payload=not-valid-json{{{";
    mockVerify.mockResolvedValue({ ok: true, body: badFormBody });

    const request = new Request("http://localhost/api/slack/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-slack-signature": "v0=test",
      },
      body: badFormBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
