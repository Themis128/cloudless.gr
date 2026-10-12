import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Extended coverage for src/app/api/slack/events/route.ts — the handler
 * internals not covered by slack-events.test.ts: event dedup, app_home_opened
 * views.publish, member_joined_channel welcome DMs, and the DM ops console
 * (status / queue / heal keywords, allowlist, SocialAuto boundary errors).
 */

const mockVerify = vi.fn();
vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_r: string) => Response.json({ error: "Unauthorized" }, { status: 401 })),
}));

const mockRateLimit = vi.fn().mockReturnValue(true);
vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: (...args: unknown[]) => mockRateLimit(...args),
  resetRateLimiter: vi.fn(),
}));

const getSlackConfigAsync = vi.fn();
vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: (...a: unknown[]) => getSlackConfigAsync(...a),
}));

const getSlackOpsUsers = vi.fn();
vi.mock("@/lib/slack-ops-users", () => ({
  getSlackOpsUsers: (...a: unknown[]) => getSlackOpsUsers(...a),
}));

const isSocialAutoConfigured = vi.fn();
const getOpsConsole = vi.fn();
const runOpsAction = vi.fn();
vi.mock("@/lib/socialauto", () => ({
  isSocialAutoConfigured: (...a: unknown[]) => isSocialAutoConfigured(...a),
  getOpsConsole: (...a: unknown[]) => getOpsConsole(...a),
  runOpsAction: (...a: unknown[]) => runOpsAction(...a),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function slackOk() {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

function makeRequest(body: object): Request {
  return new Request("http://localhost/api/slack/events", {
    method: "POST",
    headers: { "x-slack-request-timestamp": "1", "x-slack-signature": "v0=t" },
    body: JSON.stringify(body),
  });
}

let seq = 0;
function eventBody(event: object, teamId = "T1") {
  return {
    type: "event_callback",
    team_id: teamId,
    event_id: `EvX${seq++}`,
    event_time: Math.floor(Date.now() / 1000),
    event,
  };
}

function sentPostBodies() {
  return mockFetch.mock.calls
    .filter((c) => String(c[0]).includes("chat.postMessage"))
    .map((c) => JSON.parse((c[1] as RequestInit).body as string));
}

describe("POST /api/slack/events — handler internals", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(slackOk());
    mockVerify.mockReset();
    mockRateLimit.mockReset().mockReturnValue(true);
    getSlackConfigAsync.mockReset().mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-test" });
    getSlackOpsUsers.mockReset().mockResolvedValue([]);
    isSocialAutoConfigured.mockReset().mockResolvedValue(true);
    getOpsConsole.mockReset();
    runOpsAction.mockReset().mockResolvedValue({});
    const mod = await import("@/app/api/slack/events/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const settle = () => new Promise((r) => setTimeout(r, 50));

  it("deduplicates repeated event_id deliveries (Slack retry window)", async () => {
    const body = eventBody({ type: "app_mention", channel: "C1", text: "status", ts: "1.0" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await POST(makeRequest(body)); // same event_id
    await settle();
    expect(sentPostBodies()).toHaveLength(1);
  });

  it("applies the per-team rate limit after parsing", async () => {
    mockRateLimit.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const body = eventBody({ type: "app_mention", channel: "C1", text: "hi", ts: "1.1" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(429);
    expect(mockRateLimit.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^ip:/),
      "team:T1",
    ]);
  });

  it("ignores non-DM channel messages", async () => {
    const body = eventBody({ type: "message", channel: "C123", channel_type: "channel", text: "status" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies()).toHaveLength(0);
  });

  it("app_home_opened publishes the home view via views.publish", async () => {
    const body = eventBody({ type: "app_home_opened", user: "U9", tab: "home" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const call = mockFetch.mock.calls.find((c) => String(c[0]).includes("views.publish"));
    expect(call).toBeDefined();
    const view = JSON.parse((call![1] as RequestInit).body as string);
    expect(view.user_id).toBe("U9");
    expect(view.view.type).toBe("home");
    expect((call![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer xoxb-test" });
  });

  it("app_home_opened ignores the messages tab and missing user/token", async () => {
    let body = eventBody({ type: "app_home_opened", user: "U9", tab: "messages" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();

    getSlackConfigAsync.mockResolvedValue({ SLACK_BOT_TOKEN: "" });
    body = eventBody({ type: "app_home_opened", user: "U9", tab: "home" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();

    expect(mockFetch.mock.calls.filter((c) => String(c[0]).includes("views.publish"))).toHaveLength(0);
  });

  it("member_joined_channel sends a welcome DM for managed channels", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("conversations.info")) {
        return new Response(JSON.stringify({ ok: true, channel: { name: "orders" } }), { status: 200 });
      }
      if (String(url).includes("conversations.open")) {
        return new Response(JSON.stringify({ ok: true, channel: { id: "D777" } }), { status: 200 });
      }
      return slackOk();
    });
    const body = eventBody({ type: "member_joined_channel", user: "U55", channel: "C9" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const posts = sentPostBodies();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.channel).toBe("D777");
    expect(posts[0]!.text).toContain("#orders");
  });

  it("member_joined_channel skips unmanaged channels and lookup failures", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("conversations.info")) {
        return new Response(JSON.stringify({ ok: true, channel: { name: "random" } }), { status: 200 });
      }
      return slackOk();
    });
    let body = eventBody({ type: "member_joined_channel", user: "U55", channel: "C1" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies()).toHaveLength(0);

    mockFetch.mockRejectedValueOnce(new Error("net down"));
    body = eventBody({ type: "member_joined_channel", user: "U55", channel: "C2" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies()).toHaveLength(0);
  });

  it("DM 'status' posts the ops console summary", async () => {
    getOpsConsole.mockResolvedValue({
      checked_at: "2026-10-11",
      services: [{ name: "api", online: true }, { name: "worker", online: false }],
      publish_queue: { pending: 3 },
      accounts: [{ platform: "x", username: "t", status: "expired" }],
    });
    const body = eventBody({ type: "message", channel: "D1", user: "U1", text: "status" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const posts = sentPostBodies();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toContain("SocialAuto ops");
    expect(posts[0]!.text).toContain("x (@t)");
  });

  it("DM 'queue' posts the publish queue; 'heal' respects the ops allowlist", async () => {
    getOpsConsole.mockResolvedValue({ checked_at: "t", services: [], publish_queue: { pending: 2 }, accounts: [] });
    let body = eventBody({ type: "message", channel: "D2", user: "U1", text: "queue" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies()[0]!.text).toContain("Publish queue");

    // heal allowed when allowlist empty
    body = eventBody({ type: "message", channel: "D3", user: "U1", text: "heal" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(runOpsAction).toHaveBeenCalledWith({ action: "session-heal" });

    // heal denied for non-allowlisted user
    getSlackOpsUsers.mockResolvedValue(["UOPS"]);
    body = eventBody({ type: "message", channel: "D4", user: "UHACK", text: "heal" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const lastPost = sentPostBodies().at(-1)!;
    expect(lastPost.text).toContain("restricted to the ops allowlist");
  });

  it("DM ops keywords degrade gracefully when SocialAuto is unconfigured or errors", async () => {
    isSocialAutoConfigured.mockResolvedValue(false);
    let body = eventBody({ type: "message", channel: "D5", user: "U1", text: "status" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies()[0]!.text).toContain("isn't configured");

    isSocialAutoConfigured.mockResolvedValue(true);
    getOpsConsole.mockRejectedValue(new Error("api down"));
    body = eventBody({ type: "message", channel: "D6", user: "U1", text: "status" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies().at(-1)!.text).toContain("Ops console fetch failed: api down");

    runOpsAction.mockRejectedValue(new Error("boom"));
    body = eventBody({ type: "message", channel: "D7", user: "U1", text: "heal" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(sentPostBodies().at(-1)!.text).toContain("Session heal failed to start");
  });

  it("DM with an unknown keyword replies with the help menu", async () => {
    const body = eventBody({ type: "message", channel: "D8", user: "U1", text: "hello there" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const posts = sentPostBodies();
    expect(posts[0]!.text).toContain("ops keyword");
  });

  it("returns ok for non-event payload types", async () => {
    const body = { type: "app_rate_limited", team_id: "T1" };
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("logs the handler error when handleEvent rejects", async () => {
    // getSlackOpsUsers throwing inside dmSessionHeal propagates out of
    // handleEvent → the fire-and-forget .catch logs it.
    getSlackOpsUsers.mockRejectedValue(new Error("ops store down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = eventBody({ type: "message", channel: "D9", user: "U1", text: "heal" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    await settle();
    expect(errSpy).toHaveBeenCalledWith(
      "[Slack Events] Handler error:",
      expect.any(Error)
    );
    errSpy.mockRestore();
  });

  it("DM 'help' replies with the help text", async () => {
    const body = eventBody({ type: "message", channel: "D10", user: "U1", text: "help" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const posts = sentPostBodies();
    expect(posts[0]!.text).toContain("/cloudless-");
  });

  it("DM 'sessions' triggers the heal path; unconfigured SocialAuto degrades queue", async () => {
    const body = eventBody({ type: "message", channel: "D11", user: "U1", text: "sessions" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    expect(runOpsAction).toHaveBeenCalledWith({ action: "session-heal" });

    isSocialAutoConfigured.mockResolvedValue(false);
    const body2 = eventBody({ type: "message", channel: "D12", user: "U1", text: "queue" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body2) });
    await POST(makeRequest(body2));
    await settle();
    const mine = sentPostBodies().filter((b) => b.channel === "D12");
    expect(mine.at(-1)!.text).toContain("isn't configured");
  });

  it("DM 'queue' posts a warning when the queue fetch fails", async () => {
    getOpsConsole.mockRejectedValue(new Error("redis gone"));
    const body = eventBody({ type: "message", channel: "D13", user: "U1", text: "queue" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    await POST(makeRequest(body));
    await settle();
    const mine = sentPostBodies().filter((b) => b.channel === "D13");
    expect(mine.at(-1)!.text).toContain("Queue fetch failed: redis gone");
  });

  it("member_joined_channel swallows a conversations.open failure", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("conversations.info")) {
        return new Response(JSON.stringify({ ok: true, channel: { name: "orders" } }), { status: 200 });
      }
      if (String(url).includes("conversations.open")) {
        throw new Error("slack down");
      }
      return slackOk();
    });
    const body = eventBody({ type: "member_joined_channel", user: "U56", channel: "C10" });
    mockVerify.mockResolvedValue({ ok: true, body: JSON.stringify(body) });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    await settle();
    expect(sentPostBodies()).toHaveLength(0);
  });
});
