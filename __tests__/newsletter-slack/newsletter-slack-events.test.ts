/**
 * newsletter-slack/events/route.ts — url_verification, dedup, event
 * dispatch (app_home_opened → views.publish, app_mention + DM → help
 * text), and the 3-layer dashboard renderer incl. error fallbacks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/newsletter-slack-verify", () => ({
  verifyNewsletterSlackRequest: (...a: unknown[]) => mockVerify(...a),
  unauthorizedNewsletterSlack: vi.fn((_r: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));
vi.mock("@/lib/slack-rate-limit", () => ({ checkSlackRateLimit: vi.fn().mockReturnValue(true) }));

const mockCfg = vi.fn();
vi.mock("@/lib/newsletter-slack-config", () => ({
  getNewsletterSlackConfigAsync: (...a: unknown[]) => mockCfg(...a),
}));

const mockDrafts = vi.fn();
vi.mock("@/lib/appflowy-blog-admin", () => ({
  listEditorialPosts: (...a: unknown[]) => mockDrafts(...a),
}));

const mockSubs = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  listNewsletterSubscribers: (...a: unknown[]) => mockSubs(...a),
}));

const mockFetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
);
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/newsletter-slack/events/route";

let seq = 0;
function eventReq(payload: Record<string, unknown>): Request {
  const body = JSON.stringify({ event_id: `ev_${seq++}`, ...payload });
  mockVerify.mockResolvedValue({ ok: true, body });
  return new Request("http://localhost/api/newsletter-slack/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCfg.mockResolvedValue({ NEWSLETTER_SLACK_BOT_TOKEN: "xoxb-nl" });
  mockDrafts.mockResolvedValue([]);
  mockSubs.mockResolvedValue(["a@x", "b@x"]);
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
});

describe("POST /api/newsletter-slack/events", () => {
  it("401 on bad signature, 429 on rate limit", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "bad" });
    expect((await POST(new Request("http://x/", { method: "POST" }))).status).toBe(401);

    const { checkSlackRateLimit } = await import("@/lib/slack-rate-limit");
    (checkSlackRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    mockVerify.mockResolvedValue({ ok: true, body: "{}" });
    const res = await POST(new Request("http://x/", { method: "POST", body: "{}" }));
    expect(res.status).toBe(429);
  });

  it("400 on invalid JSON, echoes url_verification challenge", async () => {
    mockVerify.mockResolvedValue({ ok: true, body: "not json" });
    expect((await POST(new Request("http://x/", { method: "POST", body: "x" }))).status).toBe(400);

    const res = await POST(eventReq({ type: "url_verification", challenge: "CH" }));
    expect((await res.json()).challenge).toBe("CH");
  });

  it("deduplicates retried event_ids", async () => {
    const body = JSON.stringify({
      type: "event_callback",
      event_id: "ev_fixed",
      event: { type: "unknown_type" },
    });
    mockVerify.mockResolvedValue({ ok: true, body });
    const mk = () =>
      new Request("http://x/", { method: "POST", headers: { "content-type": "application/json" }, body });
    await POST(mk());
    await POST(mk()); // retry — same event_id
    await flush();
    expect(mockDrafts).not.toHaveBeenCalled(); // handler ran once, harmless either way
  });

  it("app_home_opened publishes the dashboard view", async () => {
    mockDrafts.mockResolvedValue([
      { id: "1", title: "T", slug: "t", status: "Draft", category: "c", readTime: "5 min", createdAt: "2026-10-09", url: "https://x/t" },
    ]);
    await POST(eventReq({ type: "event_callback", event: { type: "app_home_opened", user: "U1", tab: "home" } }));
    await flush();
    const call = mockFetch.mock.calls.find((c) => String(c[0]).includes("views.publish"));
    expect(call).toBeDefined();
    const posted = JSON.parse(call![1].body as string);
    expect(posted.user_id).toBe("U1");
    expect(JSON.stringify(posted.view)).toContain("This week's draft");
  });

  it("app_home_opened without a token skips views.publish", async () => {
    mockCfg.mockResolvedValue({ NEWSLETTER_SLACK_BOT_TOKEN: undefined });
    await POST(eventReq({ type: "event_callback", event: { type: "app_home_opened", user: "U1" } }));
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("empty dashboard state + subscriber-error cell render", async () => {
    mockSubs.mockRejectedValue(new Error("crm down"));
    await POST(eventReq({ type: "event_callback", event: { type: "app_home_opened", user: "U1" } }));
    await flush();
    const posted = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const view = JSON.stringify(posted.view);
    expect(view).toContain("No draft yet this week");
    expect(view).toContain("EspoCRM error");
  });

  it("drafts error → empty drafts but subscribers still render", async () => {
    mockDrafts.mockRejectedValue(new Error("appflowy down"));
    await POST(eventReq({ type: "event_callback", event: { type: "app_home_opened", user: "U1" } }));
    await flush();
    const posted = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(JSON.stringify(posted.view)).toContain("*Subscribers*\\n2");
  });

  it("app_mention and DM get the help text", async () => {
    await POST(eventReq({ type: "event_callback", event: { type: "app_mention", user: "U1", channel: "C1" } }));
    await POST(eventReq({ type: "event_callback", event: { type: "message", user: "U1", channel: "D1" } }));
    await flush();
    const posts = mockFetch.mock.calls.filter((c) => String(c[0]).includes("chat.postMessage"));
    expect(posts.length).toBe(2);
    expect(JSON.parse(posts[0][1].body as string).text).toContain("/newsletter-list");
    expect(JSON.parse(posts[0][1].body as string).channel).toBe("C1");
  });

  it("warns when views.publish returns ok:false and swallows postMessage failures", async () => {
    // views.publish → { ok: false } hits the warn arm; postMessage fetch
    // rejection hits the .catch arm.
    mockFetch.mockImplementation((url: unknown) =>
      String(url).includes("views.publish")
        ? Promise.resolve(new Response(JSON.stringify({ ok: false, error: "bad_view" }), { status: 200 }))
        : Promise.reject(new Error("net down"))
    );
    await POST(eventReq({ type: "event_callback", event: { type: "app_home_opened", user: "U1" } }));
    await POST(eventReq({ type: "event_callback", event: { type: "app_mention", user: "U1", channel: "C1" } }));
    await flush();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("ignores bot loopbacks, channel messages, and unknown types", async () => {
    await POST(eventReq({ type: "event_callback", event: { type: "app_mention", bot_id: "B1", channel: "C1" } }));
    await POST(eventReq({ type: "event_callback", event: { type: "message", user: "U1", channel: "C_public" } }));
    await POST(eventReq({ type: "event_callback", event: { type: "reaction_added", user: "U1" } }));
    await POST(eventReq({ type: "other_top_level" }));
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handler errors are swallowed (200 already sent)", async () => {
    mockCfg.mockRejectedValue(new Error("ssm down"));
    const res = await POST(eventReq({ type: "event_callback", event: { type: "app_mention", channel: "C1" } }));
    expect(res.status).toBe(200);
    await flush();
  });
});
