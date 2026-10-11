/**
 * Coverage batch: slack/interactions/route.ts async responders —
 * linkedinAdsControlAsync (allowlist, API + sidecar fallback),
 * socialautoActionAsync (configured? ops-status, mutations, card
 * rewrite), acknowledgeAsync (blocks + fallback), refreshOrdersAsync
 * (SSRF pin + order lines), rerunWorkflowAsync (allowlist + dispatch).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...a: unknown[]) => mockVerify(...a),
  unauthorizedSlack: vi.fn((_r: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));
vi.mock("@/lib/slack-rate-limit", () => ({ checkSlackRateLimit: vi.fn().mockReturnValue(true) }));

const mockOrders = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...a: unknown[]) => mockOrders(...a),
  formatPrice: vi.fn((a: number) => `€${(a / 100).toFixed(2)}`),
}));

vi.mock("@/lib/slack-notify", () => ({ SlackClient: vi.fn() }));

const mockDispatch = vi.fn();
vi.mock("@/lib/github-dispatch", () => ({
  dispatchWorkflow: (...a: unknown[]) => mockDispatch(...a),
}));

const mockOpsUsers = vi.fn();
vi.mock("@/lib/slack-ops-users", () => ({
  getSlackOpsUsers: (...a: unknown[]) => mockOpsUsers(...a),
}));

const mockConfigured = vi.fn();
const mockRetry = vi.fn();
const mockCancel = vi.fn();
const mockOpsAction = vi.fn();
const mockOpsConsole = vi.fn();
const mockAdsControl = vi.fn();
vi.mock("@/lib/socialauto", () => ({
  isSocialAutoConfigured: (...a: unknown[]) => mockConfigured(...a),
  retryQueueItem: (...a: unknown[]) => mockRetry(...a),
  cancelQueueItem: (...a: unknown[]) => mockCancel(...a),
  runOpsAction: (...a: unknown[]) => mockOpsAction(...a),
  getOpsConsole: (...a: unknown[]) => mockOpsConsole(...a),
  socialautoAdsControl: (...a: unknown[]) => mockAdsControl(...a),
}));

const mockCampaigns = vi.fn();
vi.mock("@/data/campaigns", () => ({
  getLiveCampaigns: (...a: unknown[]) => mockCampaigns(...a),
}));

const mockLiStatus = vi.fn();
const mockLiPause = vi.fn();
const mockLiResume = vi.fn();
vi.mock("@/lib/campaigns/linkedin", () => ({
  getLinkedInCampaignStatus: (...a: unknown[]) => mockLiStatus(...a),
  pauseLinkedInCampaign: (...a: unknown[]) => mockLiPause(...a),
  resumeLinkedInCampaign: (...a: unknown[]) => mockLiResume(...a),
}));

const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/slack/interactions/route";

const USER = { id: "U1", username: "themis" };
const RESP = "https://hooks.slack.com/actions/T/1/x";

function interact(payload: Record<string, unknown>): Promise<Response> {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  mockVerify.mockResolvedValue({ ok: true, body });
  return POST(
    new Request("http://localhost/api/slack/interactions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
  );
}

function action(action_id: string, extra: Record<string, unknown> = {}) {
  return interact({
    type: "block_actions",
    user: USER,
    response_url: RESP,
    actions: [{ action_id, type: "button", value: "", ...extra }],
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

const respCalls = () =>
  mockFetch.mock.calls
    .filter((c) => String(c[0]) === RESP)
    .map((c) => JSON.parse(c[1].body as string));

beforeEach(() => {
  vi.clearAllMocks();
  mockOpsUsers.mockResolvedValue([]);
  mockConfigured.mockResolvedValue(true);
  mockCampaigns.mockReturnValue([
    { slug: "c", adPlatforms: [{ platform: "linkedin", campaignIds: ["99"] }] },
  ]);
  mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("URL-button acks", () => {
  it.each([
    "open_stripe_dashboard",
    "open_store",
    "open_socialauto_admin",
    "open_socialauto_queue",
    "open_webmail",
    "home_open_stripe",
    "home_open_site",
    "home_open_admin",
  ])("%s → 200 ack, no fetch", async (id) => {
    expect((await action(id)).status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("slack_ack", () => {
  it("rewrites the message minus actions + appends ack context", async () => {
    await interact({
      type: "block_actions",
      user: USER,
      response_url: RESP,
      message: { ts: "1", blocks: [{ type: "section" }, { type: "actions" }] },
      actions: [{ action_id: "slack_ack", type: "button" }],
    });
    await flush();
    const posted = respCalls()[0];
    expect(posted.replace_original).toBe(true);
    expect(posted.blocks.some((b: { type: string }) => b.type === "actions")).toBe(false);
    expect(JSON.stringify(posted.blocks)).toContain("Acknowledged by <@U1>");
  });

  it("falls back to a plain ack line when there are no blocks", async () => {
    await action("slack_ack");
    await flush();
    expect(respCalls()[0].text).toContain("Acknowledged by <@U1>");
  });
});

describe("refresh_orders", () => {
  it("posts refreshed order lines", async () => {
    mockOrders.mockResolvedValue({
      orders: [
        { email: "a@b.c", amount: 4900, currency: "eur", paymentStatus: "paid" },
        { email: null, amount: 100, currency: "eur", paymentStatus: "unpaid" },
      ],
    });
    await action("refresh_orders");
    await flush();
    const posted = respCalls()[0];
    expect(posted.blocks[1].text.text).toContain("a@b.c");
    expect(posted.blocks[1].text.text).toContain(":hourglass:");
  });

  it("renders the empty state and refuses non-Slack response URLs", async () => {
    mockOrders.mockResolvedValue({ orders: [] });
    await action("refresh_orders");
    await flush();
    expect(respCalls()[0].blocks[1].text.text).toBe("No orders found.");

    mockFetch.mockClear();
    await interact({
      type: "block_actions",
      user: USER,
      response_url: "https://evil.internal/x",
      actions: [{ action_id: "refresh_orders", type: "button" }],
    });
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("rerun_weekly_draft", () => {
  it("gates on the ops allowlist", async () => {
    mockOpsUsers.mockResolvedValue(["ADMIN"]);
    await action("rerun_weekly_draft");
    await flush();
    expect(respCalls()[0].text).toContain("not on the ops allowlist");
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("dispatches the workflow and posts the result", async () => {
    mockOpsUsers.mockResolvedValue(["U1"]);
    mockDispatch.mockResolvedValue({ ok: true });
    await action("rerun_weekly_draft");
    await flush();
    expect(mockDispatch).toHaveBeenCalledWith("weekly-article-draft.yml", "main");
    expect(respCalls()[0].text).toContain("re-triggered");

    mockDispatch.mockResolvedValue({ ok: false, status: 404, error: "wf missing" });
    await action("rerun_weekly_draft");
    await flush();
    expect(respCalls()[1].text).toContain("failed (HTTP 404)");
  });
});

describe("linkedin_ads_* buttons", () => {
  it("status reads are open to the workspace", async () => {
    mockOpsUsers.mockResolvedValue(["OTHER"]); // allowlist set but status is open
    mockLiStatus.mockResolvedValue({ ok: true, name: "Boost", status: "ACTIVE", dailyBudget: "€25" });
    await action("linkedin_ads_status");
    await flush();
    expect(respCalls()[0].text).toContain("*Boost* — status *ACTIVE*");
  });

  it("status failure is surfaced", async () => {
    mockLiStatus.mockResolvedValue({ ok: false, error: "bad token" });
    await action("linkedin_ads_status");
    await flush();
    expect(respCalls()[0].text).toContain("Status check failed");
  });

  it("warns when no campaign can be resolved", async () => {
    mockCampaigns.mockReturnValue([]);
    await action("linkedin_ads_status");
    await flush();
    expect(respCalls()[0].text).toContain("No LinkedIn campaign configured");
  });

  it("pause gates on the ops allowlist", async () => {
    mockOpsUsers.mockResolvedValue(["ADMIN"]);
    await action("linkedin_ads_pause", { value: "907100946" });
    await flush();
    expect(respCalls()[0].text).toContain("not on the ops allowlist");
    expect(mockLiPause).not.toHaveBeenCalled();
  });

  it("pause via API succeeds", async () => {
    mockOpsUsers.mockResolvedValue(["U1"]);
    mockLiPause.mockResolvedValue({ ok: true });
    await action("linkedin_ads_pause", { value: "907100946" });
    await flush();
    expect(respCalls()[0].text).toContain("paused by <@U1> via LinkedIn API");
  });

  it("401/403 → falls back to the SocialAuto sidecar", async () => {
    mockLiResume.mockResolvedValue({ ok: false, error: "403 ACCESS_DENIED" });
    mockAdsControl.mockResolvedValue({ ok: true });
    await action("linkedin_ads_resume", { value: "907100946" });
    await flush();
    expect(respCalls()[0].text).toContain("resumed by <@U1> via Campaign Manager (queued)");
  });

  it("sidecar fallback failure merges both errors", async () => {
    mockLiPause.mockResolvedValue({ ok: false, error: "ACCESS_DENIED" });
    mockAdsControl.mockResolvedValue({ ok: false, error: "sidecar down" });
    await action("linkedin_ads_pause", { value: "1" });
    await flush();
    expect(respCalls()[0].text).toContain("sidecar fallback: sidecar down");
  });

  it("non-permission failure skips the sidecar", async () => {
    mockLiPause.mockResolvedValue({ ok: false, error: "500 server" });
    await action("linkedin_ads_pause", { value: "1" });
    await flush();
    expect(mockAdsControl).not.toHaveBeenCalled();
    expect(respCalls()[0].text).toContain("Failed to pause");
  });
});

describe("socialauto_* buttons", () => {
  it("warns when SocialAuto is not configured", async () => {
    mockConfigured.mockResolvedValue(false);
    await action("socialauto_ops_status");
    await flush();
    expect(respCalls()[0].text).toContain("isn't configured");
  });

  it("ops_status renders services, queue, dead accounts", async () => {
    mockOpsConsole.mockResolvedValue({
      checked_at: "now",
      services: [
        { name: "api", online: true },
        { name: "worker", online: false },
      ],
      publish_queue: { queued: 3 },
      accounts: [{ platform: "tiktok", username: "cloudless", status: "revoked" }],
    });
    await action("socialauto_ops_status");
    await flush();
    const text = respCalls()[0].text;
    expect(text).toContain(":large_green_circle: api");
    expect(text).toContain(":red_circle: worker");
    expect(text).toContain("queued: 3");
    expect(text).toContain("tiktok (@cloudless)");
  });

  it("ops_status failure is surfaced", async () => {
    mockOpsConsole.mockRejectedValue(new Error("sa down"));
    await action("socialauto_ops_status");
    await flush();
    expect(respCalls()[0].text).toContain("Ops console fetch failed");
  });

  it("mutations gate on the allowlist", async () => {
    mockOpsUsers.mockResolvedValue(["ADMIN"]);
    await action("socialauto_retry_queue", { value: "q1" });
    await flush();
    expect(respCalls()[0].text).toContain("not on the ops allowlist");
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it("retry/cancel post results and stamp the alert card", async () => {
    mockRetry.mockResolvedValue({ ok: true });
    await interact({
      type: "block_actions",
      user: USER,
      response_url: RESP,
      message: { blocks: [{ type: "section" }, { type: "actions" }] },
      actions: [{ action_id: "socialauto_retry_queue", type: "button", value: "q7" }],
    });
    await flush();
    const posts = respCalls();
    expect(posts[0].text).toContain("re-queued publish item `q7`");
    const stamp = posts[1];
    expect(stamp.replace_original).toBe(true);
    expect(stamp.blocks.some((b: { type: string }) => b.type === "actions")).toBe(false);
    expect(JSON.stringify(stamp.blocks)).toContain("Handled by <@U1>");

    mockCancel.mockResolvedValue({ ok: false, error: "not found" });
    await action("socialauto_cancel_queue", { value: "q9" });
    await flush();
    expect(respCalls().at(-1)!.text).toContain("Cancel failed for `q9`");
  });

  it("retry/cancel warn when the button carries no value", async () => {
    await action("socialauto_retry_queue");
    await action("socialauto_cancel_queue");
    await flush();
    const texts = respCalls().map((p) => p.text);
    expect(texts[0]).toContain("can't retry");
    expect(texts[1]).toContain("can't cancel");
  });

  it("session-heal and browser-release dispatch ops actions", async () => {
    mockOpsAction.mockResolvedValue({});
    await action("socialauto_session_heal");
    await flush();
    expect(respCalls()[0].text).toContain("triggered a session heal");
    expect(mockOpsAction).toHaveBeenCalledWith({ action: "session-heal" });

    mockOpsAction.mockRejectedValue(new Error("locked"));
    await action("socialauto_browser_release");
    await flush();
    expect(respCalls()[1].text).toContain("Browser-lock release failed: locked");
  });
});
