/**
 * Slack interactions — SocialAuto responder and dispatch branches the other
 * suites skip: buttons without a response_url, payloads without user/actions,
 * empty queues and username-less accounts in the ops summary, console fetch
 * failures, retry/cancel success and failure texts, session-heal and
 * browser-release error paths, non-Slack response URLs, and the original
 * card being replaced after a handled action.
 */
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

function action(action_id: string, extra: Record<string, unknown> = {}) {
  return {
    type: "block_actions",
    user: baseUser,
    response_url: responseUrl,
    actions: [{ action_id, type: "button", ...extra }],
  };
}

async function run(payload: object): Promise<Response> {
  verifyOk(payload);
  const res = await POST(makeRequest({}));
  await waitForAsync();
  return res;
}

const postedTexts = () =>
  fetchSpy.mock.calls.map((c) => String(JSON.parse((c[1] as RequestInit).body as string).text));

let POST: (req: Request) => Promise<Response>;

describe("Slack interactions — SocialAuto / dispatch branches", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockOpsUsers.mockResolvedValue(["U-OPS"]);
    mockIsConfigured.mockResolvedValue(true);
    POST = (await import("@/app/api/slack/interactions/route")).POST;
  });

  it("buttons without a response_url are acknowledged with no follow-up", async () => {
    for (const id of [
      "linkedin_ads_status",
      "socialauto_ops_status",
      "slack_ack",
      "refresh_orders",
      "rerun_weekly_draft",
    ]) {
      const res = await run({
        type: "block_actions",
        user: baseUser,
        actions: [{ action_id: id }],
      });
      expect(res.status).toBe(200);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockIsConfigured).not.toHaveBeenCalled();
  });

  it("payloads without a user or actions list are still acknowledged", async () => {
    const res = await run({ type: "block_actions" });
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ops status: empty queue and username-less unhealthy accounts", async () => {
    mockGetOpsConsole.mockResolvedValue({
      checked_at: "t0",
      services: [{ name: "api", online: false }],
      accounts: [
        { id: "a1", platform: "x", status: "expired" },
        { id: "a2", platform: "linkedin", username: "tb", status: "error" },
      ],
      publish_queue: {},
    });
    await run(action("socialauto_ops_status"));
    const text = postedTexts().at(-1)!;
    expect(text).toContain(":red_circle: api");
    expect(text).toContain("Queue: empty");
    expect(text).toContain("Accounts needing attention: x (@?), linkedin (@tb)");
  });

  it("ops status: a healthy roster reports none; a console failure is reported", async () => {
    mockGetOpsConsole.mockResolvedValueOnce({
      checked_at: "t1",
      services: [],
      accounts: [{ id: "a", platform: "x", username: "u", status: "active" }],
      publish_queue: { scheduled: 0 },
    });
    await run(action("socialauto_ops_status"));
    expect(postedTexts().at(-1)).toContain("Accounts needing attention: none");

    mockGetOpsConsole.mockRejectedValueOnce(new Error("sidecar down"));
    await run(action("socialauto_ops_status"));
    expect(postedTexts().at(-1)).toBe(":warning: Ops console fetch failed: sidecar down");
  });

  it("retry/cancel: missing id, success and failure texts", async () => {
    await run(action("socialauto_retry_queue"));
    expect(postedTexts().at(-1)).toContain("No queue item id on this button — can't retry");
    await run(action("socialauto_cancel_queue"));
    expect(postedTexts().at(-1)).toContain("can't cancel");

    mockRetryQueueItem.mockResolvedValueOnce({ ok: false, detail: "already published" });
    await run(action("socialauto_retry_queue", { value: "q1" }));
    expect(postedTexts().at(-1)).toBe(":warning: Retry failed for `q1`: already published");
    mockRetryQueueItem.mockResolvedValueOnce({ ok: false, error: "HTTP 500" });
    await run(action("socialauto_retry_queue", { value: "q2" }));
    expect(postedTexts().at(-1)).toBe(":warning: Retry failed for `q2`: HTTP 500");

    mockCancelQueueItem.mockResolvedValueOnce({ ok: true });
    await run(action("socialauto_cancel_queue", { value: "q3" }));
    expect(postedTexts().at(-1)).toBe(":no_entry_sign: <@U-OPS> cancelled queue item `q3`.");
    mockCancelQueueItem.mockResolvedValueOnce({ ok: false, error: "gone" });
    await run(action("socialauto_cancel_queue", { value: "q4" }));
    expect(postedTexts().at(-1)).toBe(":warning: Cancel failed for `q4`: gone");
  });

  it("session heal / browser release: rejected and error results, release success", async () => {
    mockRunOpsAction.mockRejectedValueOnce(new Error("no route"));
    await run(action("socialauto_session_heal"));
    expect(postedTexts().at(-1)).toBe(":warning: Session heal failed to start: no route");

    mockRunOpsAction.mockResolvedValueOnce({ error: "lock busy" });
    await run(action("socialauto_browser_release"));
    expect(postedTexts().at(-1)).toBe(":warning: Browser-lock release failed: lock busy");

    mockRunOpsAction.mockResolvedValueOnce({ released: true });
    await run(action("socialauto_browser_release"));
    expect(postedTexts().at(-1)).toBe(":unlock: <@U-OPS> released the browser orchestrator lock.");
    expect(mockRunOpsAction).toHaveBeenLastCalledWith({ action: "release-browser-lock" });
  });

  it("handled action replaces the original card without its actions row", async () => {
    mockRunOpsAction.mockResolvedValueOnce({});
    await run({
      ...action("socialauto_session_heal"),
      message: {
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: "alert" } },
          { type: "actions", elements: [] },
        ],
      },
    });
    const last = JSON.parse((fetchSpy.mock.calls.at(-1)![1] as RequestInit).body as string);
    expect(last.replace_original).toBe(true);
    expect(last.blocks.map((b: { type: string }) => b.type)).toEqual(["section", "context"]);
    expect(last.blocks[1].elements[0].text).toBe("Handled by <@U-OPS> — socialauto_session_heal");
  });

  it("an empty ops allowlist lets anyone mutate", async () => {
    mockOpsUsers.mockResolvedValue([]);
    mockCancelQueueItem.mockResolvedValueOnce({ ok: true });
    await run({ ...action("socialauto_cancel_queue", { value: "q9" }), user: { id: "U-ANY" } });
    expect(postedTexts().at(-1)).toBe(":no_entry_sign: <@U-ANY> cancelled queue item `q9`.");
  });

  it("non-Slack response URLs are never posted to", async () => {
    await run({ ...action("socialauto_ops_status"), response_url: "https://evil.example/hook" });
    await run({ ...action("slack_ack"), response_url: "https://evil.example/hook" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
