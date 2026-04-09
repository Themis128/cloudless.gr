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

function verifyOk(formBody: string) {
  mockVerify.mockResolvedValue({ ok: true, body: formBody });
}

function verifyFail(reason = "Signature mismatch") {
  mockVerify.mockResolvedValue({ ok: false, reason });
}

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function makeCommandRequest(fields: Record<string, string>): Request {
  const body = formBody(fields);
  return new Request("http://localhost/api/slack/commands", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-slack-signature": "v0=test",
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/slack/commands", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/slack/commands/route");
    POST = mod.POST;
  });

  // --- Signature check ---

  it("returns 401 when signature verification fails", async () => {
    verifyFail();
    const response = await POST(
      makeCommandRequest({ command: "/cloudless-status", user_id: "U123", user_name: "themis" }),
    );
    expect(response.status).toBe(401);
  });

  // --- /cloudless-status ---

  it("/cloudless-status returns in_channel response with status fields", async () => {
    const fields = { command: "/cloudless-status", user_id: "U123", user_name: "themis", text: "", channel_id: "C1", response_url: "", trigger_id: "t1" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.response_type).toBe("in_channel");
    expect(data.blocks).toBeDefined();
    expect(Array.isArray(data.blocks)).toBe(true);
    expect(data.blocks.length).toBeGreaterThan(0);
  });

  it("/cloudless-status header block contains 'Status'", async () => {
    const fields = { command: "/cloudless-status", user_id: "U123", user_name: "themis", text: "", channel_id: "C1", response_url: "", trigger_id: "t1" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = await response.json();

    const headerBlock = data.blocks.find((b: { type: string }) => b.type === "header");
    expect(headerBlock).toBeDefined();
    expect(headerBlock.text.text).toMatch(/status/i);
  });

  it("/cloudless-status includes version and uptime fields", async () => {
    const fields = { command: "/cloudless-status", user_id: "U123", user_name: "themis", text: "", channel_id: "C1", response_url: "", trigger_id: "t1" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = await response.json();
    const blockStr = JSON.stringify(data.blocks);
    expect(blockStr).toContain("Version");
    expect(blockStr).toContain("Uptime");
  });

  // --- /cloudless-orders ---

  it("/cloudless-orders returns ephemeral response with action buttons", async () => {
    const fields = { command: "/cloudless-orders", user_id: "U456", user_name: "themis", text: "", channel_id: "C2", response_url: "", trigger_id: "t2" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.response_type).toBe("ephemeral");
    expect(data.blocks).toBeDefined();
  });

  it("/cloudless-orders includes Stripe Dashboard button", async () => {
    const fields = { command: "/cloudless-orders", user_id: "U456", user_name: "themis", text: "", channel_id: "C2", response_url: "", trigger_id: "t2" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = await response.json();
    const blockStr = JSON.stringify(data.blocks);
    expect(blockStr).toContain("stripe");
    expect(blockStr).toContain("open_stripe_dashboard");
  });

  it("/cloudless-orders context block shows the requesting user", async () => {
    const fields = { command: "/cloudless-orders", user_id: "U789", user_name: "themis", text: "", channel_id: "C2", response_url: "", trigger_id: "t2" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = await response.json();
    const blockStr = JSON.stringify(data.blocks);
    expect(blockStr).toContain("U789");
  });

  // --- Unknown command ---

  it("returns 200 with an error message for unknown commands", async () => {
    const fields = { command: "/unknown-command", user_id: "U123", user_name: "themis", text: "", channel_id: "C1", response_url: "", trigger_id: "t1" };
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.response_type).toBe("ephemeral");
    expect(data.text).toContain("/unknown-command");
  });
});
