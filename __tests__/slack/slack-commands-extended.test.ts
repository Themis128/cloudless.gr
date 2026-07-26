/**
 * Extended tests for the new slash commands added in the Slack bot upgrade:
 *   /cloudless-ticket  — opens a modal (views.open)
 *   /cloudless-analytics — ephemeral Stripe revenue summary
 *   /cloudless-deploy  — opens a confirmation modal
 *   /cloudless-help    — lists all 7 commands
 *   /cloudless-channels — channel status listing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = vi.fn();

vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_reason: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: vi.fn().mockReturnValue(true),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockListOrders = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...args: unknown[]) => mockListOrders(...args),
  formatPrice: vi.fn(
    (amount: number, currency: string) => `€${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  ),
}));

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: vi.fn(async () => ({
    SLACK_BOT_TOKEN: "xoxb-test-token",
    SLACK_WEBHOOK_URL: undefined,
    SLACK_SIGNING_SECRET: "test-secret",
  })),
  resetSlackConfigCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyOk(formBody: string) {
  mockVerify.mockResolvedValue({ ok: true, body: formBody });
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

function baseFields(command: string, extra: Record<string, string> = {}) {
  return {
    command,
    user_id: "U123",
    user_name: "themis",
    text: "",
    channel_id: "C1",
    response_url: "https://hooks.slack.com/commands/test",
    trigger_id: "trigger.abc123",
    ...extra,
  };
}

function makeOrdersFixture(count: number, daysAgo = 0) {
  const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return Array.from({ length: count }, (_, i) => ({
    id: `cs_test_${i}`,
    email: `customer${i}@example.com`,
    amount: 4900 + i * 100,
    currency: "eur",
    status: "complete",
    created,
    paymentStatus: "paid",
    mode: "payment",
  }));
}

// ---------------------------------------------------------------------------
// /cloudless-ticket — modal open
// ---------------------------------------------------------------------------

describe("/cloudless-ticket", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // views.open returns ok
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const mod = await import("@/app/api/slack/commands/route");
    POST = mod.POST;
  });

  it("returns 200 with empty body after opening the modal", async () => {
    const fields = baseFields("/cloudless-ticket");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("");
  });

  it("calls views.open with correct callback_id", async () => {
    const fields = baseFields("/cloudless-ticket");
    verifyOk(formBody(fields));

    await POST(makeCommandRequest(fields));

    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/views.open",
      expect.objectContaining({ method: "POST" })
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      trigger_id: string;
      view: { callback_id: string };
    };
    expect(callBody.trigger_id).toBe("trigger.abc123");
    expect(callBody.view.callback_id).toBe("create-ticket-modal");
  });

  it("modal contains required input blocks: email, issue_type, priority, description", async () => {
    const fields = baseFields("/cloudless-ticket");
    verifyOk(formBody(fields));

    await POST(makeCommandRequest(fields));

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      view: { blocks: Array<{ block_id?: string }> };
    };
    const blockIds = callBody.view.blocks.map((b) => b.block_id).filter(Boolean);
    expect(blockIds).toContain("ticket_email");
    expect(blockIds).toContain("ticket_issue_type");
    expect(blockIds).toContain("ticket_priority");
    expect(blockIds).toContain("ticket_description");
  });
});

// ---------------------------------------------------------------------------
// /cloudless-analytics — Stripe revenue summary
// ---------------------------------------------------------------------------

describe("/cloudless-analytics", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/slack/commands/route");
    POST = mod.POST;
  });

  it("returns 200 ephemeral response", async () => {
    mockListOrders.mockResolvedValue({
      orders: makeOrdersFixture(3),
      hasMore: false,
    });

    const fields = baseFields("/cloudless-analytics");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { response_type: string };
    expect(data.response_type).toBe("ephemeral");
  });

  it("response includes revenue figures and order counts", async () => {
    mockListOrders.mockResolvedValue({
      orders: makeOrdersFixture(5),
      hasMore: false,
    });

    const fields = baseFields("/cloudless-analytics");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = (await response.json()) as { blocks: unknown[] };
    const blockStr = JSON.stringify(data.blocks);

    // Should contain revenue / order indicators
    expect(blockStr).toMatch(/revenue|orders|Revenue|Orders/i);
  });

  it("shows zero-state message when no orders", async () => {
    mockListOrders.mockResolvedValue({ orders: [], hasMore: false });

    const fields = baseFields("/cloudless-analytics");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = (await response.json()) as { blocks?: unknown[]; text?: string };
    const bodyStr = JSON.stringify(data);

    expect(bodyStr).toMatch(/no orders|no paid orders|no order data|0/i);
  });

  it("includes a Stripe Dashboard button", async () => {
    mockListOrders.mockResolvedValue({
      orders: makeOrdersFixture(2),
      hasMore: false,
    });

    const fields = baseFields("/cloudless-analytics");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = (await response.json()) as { blocks: unknown[] };
    const blockStr = JSON.stringify(data.blocks);

    expect(blockStr).toContain("dashboard.stripe.com");
  });

  it("handles Stripe fetch failure gracefully", async () => {
    mockListOrders.mockRejectedValue(new Error("Stripe timeout"));

    const fields = baseFields("/cloudless-analytics");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { response_type: string; text?: string };
    expect(data.response_type).toBe("ephemeral");
    // Should return an error message rather than crashing
    expect(JSON.stringify(data)).toMatch(/error|unavailable|failed/i);
  });
});

// ---------------------------------------------------------------------------
// /cloudless-deploy — confirmation modal open
// ---------------------------------------------------------------------------

describe("/cloudless-deploy", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const mod = await import("@/app/api/slack/commands/route");
    POST = mod.POST;
  });

  it("returns 200 with empty body after opening the modal", async () => {
    const fields = baseFields("/cloudless-deploy");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("");
  });

  it("calls views.open with deploy-confirm-modal callback_id", async () => {
    const fields = baseFields("/cloudless-deploy");
    verifyOk(formBody(fields));

    await POST(makeCommandRequest(fields));

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      view: { callback_id: string };
    };
    expect(callBody.view.callback_id).toBe("deploy-confirm-modal");
  });

  it("modal private_metadata contains the triggering user info", async () => {
    const fields = baseFields("/cloudless-deploy", {
      user_id: "U999",
      user_name: "deployer",
    });
    verifyOk(formBody(fields));

    await POST(makeCommandRequest(fields));

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      view: { private_metadata: string };
    };
    const meta = JSON.parse(callBody.view.private_metadata) as {
      user_id: string;
      user_name: string;
    };
    expect(meta.user_id).toBe("U999");
    expect(meta.user_name).toBe("deployer");
  });

  it("modal contains warning text about production", async () => {
    const fields = baseFields("/cloudless-deploy");
    verifyOk(formBody(fields));

    await POST(makeCommandRequest(fields));

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      view: { blocks: unknown[] };
    };
    const blockStr = JSON.stringify(callBody.view.blocks);
    expect(blockStr).toMatch(/production|deploy|warning/i);
  });
});

// ---------------------------------------------------------------------------
// /cloudless-help — lists all commands
// ---------------------------------------------------------------------------

describe("/cloudless-help", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/slack/commands/route");
    POST = mod.POST;
  });

  it("lists all 7 cloudless commands", async () => {
    const fields = baseFields("/cloudless-help");
    verifyOk(formBody(fields));

    const response = await POST(makeCommandRequest(fields));
    const data = (await response.json()) as { text?: string; blocks?: unknown[] };
    const bodyStr = JSON.stringify(data);

    expect(bodyStr).toContain("/cloudless-status");
    expect(bodyStr).toContain("/cloudless-orders");
    expect(bodyStr).toContain("/cloudless-channels");
    expect(bodyStr).toContain("/cloudless-ticket");
    expect(bodyStr).toContain("/cloudless-analytics");
    expect(bodyStr).toContain("/cloudless-deploy");
    expect(bodyStr).toContain("/cloudless-help");
  });
});
