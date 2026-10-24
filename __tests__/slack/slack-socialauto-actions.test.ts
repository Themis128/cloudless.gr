import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = vi.fn();
const mockOpsUsers = vi.fn();
const mockGetOpsConsole = vi.fn();
const mockRunOpsAction = vi.fn();
const mockRetryQueueItem = vi.fn();
const mockCancelQueueItem = vi.fn();
const mockIsConfigured = vi.fn();

vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_reason: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

vi.mock("@/lib/slack-ops-users", () => ({
  getSlackOpsUsers: (...args: unknown[]) => mockOpsUsers(...args),
}));

vi.mock("@/lib/socialauto", () => ({
  getOpsConsole: (...args: unknown[]) => mockGetOpsConsole(...args),
  runOpsAction: (...args: unknown[]) => mockRunOpsAction(...args),
  retryQueueItem: (...args: unknown[]) => mockRetryQueueItem(...args),
  cancelQueueItem: (...args: unknown[]) => mockCancelQueueItem(...args),
  isSocialAutoConfigured: (...args: unknown[]) => mockIsConfigured(...args),
}));

// Stub fetch for response_url posts
const fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
vi.stubGlobal("fetch", fetchSpy);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyOk(payloadJson: object) {
  const formBody = new URLSearchParams({
    payload: JSON.stringify(payloadJson),
  }).toString();
  mockVerify.mockResolvedValue({ ok: true, body: formBody });
}

function makeRequest(payloadJson: object): Request {
  const formBody = new URLSearchParams({
    payload: JSON.stringify(payloadJson),
  }).toString();
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

const baseUser = { id: "U-OPS", username: "themis" };
const responseUrl = "https://hooks.slack.com/actions/T/B/xyz";

function waitForAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

function lastFetchBody(): Record<string, unknown> {
  const call = fetchSpy.mock.calls.at(-1);
  return JSON.parse((call?.[1] as RequestInit)?.body as string);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SocialAuto interaction actions", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOpsUsers.mockResolvedValue(["U-OPS"]);
    mockIsConfigured.mockResolvedValue(true);
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });

  it("ops status replies with an ephemeral console summary", async () => {
    mockGetOpsConsole.mockResolvedValue({
      checked_at: "2026-10-06T12:00:00Z",
      services: [{ name: "social-api", online: true, detail: "" }],
      accounts: [{ id: "a1", platform: "linkedin", username: "tb", status: "active" }],
      publish_queue: { scheduled: 3, failed: 1 },
      media: {},
      browser_orchestrator: { queue_length: 0, lock_held: false },
    });
    verifyOk({
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      actions: [{ action_id: "socialauto_ops_status", type: "button" }],
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    await waitForAsync();
    expect(mockGetOpsConsole).toHaveBeenCalled();
    const body = lastFetchBody();
    expect(String(body.text)).toContain("social-api");
    expect(String(body.text)).toContain("failed: 1");
    expect(body.response_type).toBe("ephemeral");
  });

  it("retry re-queues the item for ops users and posts in_channel", async () => {
    mockRetryQueueItem.mockResolvedValue({ ok: true });
    verifyOk({
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      message: { ts: "1", blocks: [{ type: "section" }, { type: "actions" }] },
      actions: [{ action_id: "socialauto_retry_queue", value: "q-123", type: "button" }],
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    await waitForAsync();
    expect(mockRetryQueueItem).toHaveBeenCalledWith("q-123");
    const bodies = fetchSpy.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    const inChannel = bodies.find((b) => b.response_type === "in_channel");
    expect(String(inChannel?.text)).toContain("re-queued");
    // original card updated — actions block stripped, handled-by context added
    const replaced = bodies.find((b) => b.replace_original === true);
    expect(replaced?.blocks?.some((b) => (b as { type: string }).type === "actions")).toBe(false);
  });

  it("blocks queue mutations for non-ops users", async () => {
    verifyOk({
      type: "block_actions",
      user: { id: "U-STRANGER", username: "x" },
      response_url: responseUrl,
      actions: [{ action_id: "socialauto_cancel_queue", value: "q-9", type: "button" }],
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    await waitForAsync();
    expect(mockCancelQueueItem).not.toHaveBeenCalled();
    expect(String(lastFetchBody().text)).toContain("ops allowlist");
  });

  it("session heal runs the ops action for allowlisted users", async () => {
    mockRunOpsAction.mockResolvedValue({ healed: 2 });
    verifyOk({
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      actions: [{ action_id: "socialauto_session_heal", type: "button" }],
    });

    await POST(makeRequest({}));
    await waitForAsync();
    expect(mockRunOpsAction).toHaveBeenCalledWith({ action: "session-heal" });
    expect(String(lastFetchBody().text)).toContain("session heal");
  });

  it("reports when SocialAuto is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    verifyOk({
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      actions: [{ action_id: "socialauto_ops_status", type: "button" }],
    });

    await POST(makeRequest({}));
    await waitForAsync();
    expect(String(lastFetchBody().text)).toContain("isn't configured");
    expect(mockGetOpsConsole).not.toHaveBeenCalled();
  });

  it("slack_ack stamps the original message", async () => {
    verifyOk({
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      message: {
        ts: "1",
        blocks: [{ type: "section" }, { type: "actions" }],
      },
      actions: [{ action_id: "slack_ack", value: "fp", type: "button" }],
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    await waitForAsync();
    const body = lastFetchBody();
    expect(body.replace_original).toBe(true);
    const ctx = (body.blocks as Array<{ type: string; elements?: Array<{ text: string }> }>).find(
      (b) => b.type === "context"
    );
    expect(ctx?.elements?.[0]?.text).toContain("Acknowledged by <@U-OPS>");
  });
});


describe("agency proposal actions", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOpsUsers.mockResolvedValue(["U-OPS"]);
    mockIsConfigured.mockResolvedValue(true);
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });

  function proposalPayload(actionId: string, value?: string) {
    return {
      type: "block_actions",
      user: baseUser,
      response_url: responseUrl,
      message: { ts: "1", blocks: [{ type: "section" }, { type: "actions" }] },
      actions: [{ action_id: actionId, value, type: "button" }],
    };
  }

  it("approve calls agency-proposal-approve and posts in_channel", async () => {
    mockRunOpsAction.mockResolvedValue({ ok: true });
    verifyOk(proposalPayload("socialauto_proposal_approve", "prop-1"));
    expect((await POST(makeRequest({}))).status).toBe(200);
    await waitForAsync();
    expect(mockRunOpsAction).toHaveBeenCalledWith({ action: "agency-proposal-approve", id: "prop-1" });
    const bodies = fetchSpy.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    const msg = bodies.find((b) => b.response_type === "in_channel");
    expect(String(msg?.text)).toContain("approved proposal `prop-1`");
  });

  it("approve failure surfaces the error", async () => {
    mockRunOpsAction.mockRejectedValue(new Error("boom"));
    verifyOk(proposalPayload("socialauto_proposal_approve", "prop-2"));
    await POST(makeRequest({}));
    await waitForAsync();
    expect(String(lastFetchBody().text)).toContain("Proposal approve failed: boom");
  });

  it("approve without a value warns instead of calling upstream", async () => {
    verifyOk(proposalPayload("socialauto_proposal_approve", ""));
    await POST(makeRequest({}));
    await waitForAsync();
    expect(mockRunOpsAction).not.toHaveBeenCalled();
    expect(String(lastFetchBody().text)).toContain("No proposal id");
  });

  it("reject calls agency-proposal-reject and posts in_channel", async () => {
    mockRunOpsAction.mockResolvedValue({ ok: true });
    verifyOk(proposalPayload("socialauto_proposal_reject", "prop-3"));
    await POST(makeRequest({}));
    await waitForAsync();
    expect(mockRunOpsAction).toHaveBeenCalledWith({ action: "agency-proposal-reject", id: "prop-3" });
    expect(String(lastFetchBody().text)).toContain("rejected proposal `prop-3`");
  });

  it("reject failure surfaces the error", async () => {
    mockRunOpsAction.mockRejectedValue(new Error("nope"));
    verifyOk(proposalPayload("socialauto_proposal_reject", "prop-4"));
    await POST(makeRequest({}));
    await waitForAsync();
    expect(String(lastFetchBody().text)).toContain("Proposal reject failed: nope");
  });

  it("reject without a value warns instead of calling upstream", async () => {
    verifyOk(proposalPayload("socialauto_proposal_reject", ""));
    await POST(makeRequest({}));
    await waitForAsync();
    expect(mockRunOpsAction).not.toHaveBeenCalled();
    expect(String(lastFetchBody().text)).toContain("No proposal id");
  });
});
