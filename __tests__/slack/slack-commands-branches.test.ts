/**
 * Branch batch for slack/commands/route.ts — the fallback arms the other
 * suites skip: missing form fields, uptime formatting, order status icons
 * and pluralisation, campaigns without ad wiring, LinkedIn status rendering
 * with zero metrics / unknown status, failed pause/resume/budget, and
 * error objects without a message.
 *
 * Same harness as slack-commands-coverage.test.ts: real route code, fakes
 * only at lib + fetch boundaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...a: unknown[]) => mockVerify(...a),
  unauthorizedSlack: vi.fn((_r: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));
const mockRateLimit = vi.fn().mockReturnValue(true);
vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: (...a: unknown[]) => mockRateLimit(...a),
}));
const mockSessions = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...a: unknown[]) => mockSessions(...a),
  formatPrice: vi.fn((a: number, c: string) => `€${(a / 100).toFixed(2)} ${c}`),
}));

const mockListChannels = vi.fn();
const mockGetBotInfo = vi.fn();
vi.mock("@/lib/slack-admin", () => ({
  listChannels: (...a: unknown[]) => mockListChannels(...a),
}));
vi.mock("@/lib/slack-workspace", () => ({
  getBotInfo: (...a: unknown[]) => mockGetBotInfo(...a),
}));

const mockSlackConfig = vi.fn();
vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: (...a: unknown[]) => mockSlackConfig(...a),
}));

const mockDispatch = vi.fn();
vi.mock("@/lib/github-dispatch", () => ({
  dispatchWorkflow: (...a: unknown[]) => mockDispatch(...a),
}));

const mockListPosts = vi.fn();
const mockFindPost = vi.fn();
const mockSetStatus = vi.fn();
vi.mock("@/lib/appflowy-blog-admin", () => ({
  listEditorialPosts: (...a: unknown[]) => mockListPosts(...a),
  findEditorialPost: (...a: unknown[]) => mockFindPost(...a),
  setEditorialStatus: (...a: unknown[]) => mockSetStatus(...a),
}));

const mockLiveCampaigns = vi.fn();
const mockGetCampaign = vi.fn();
vi.mock("@/data/campaigns", () => ({
  getLiveCampaigns: (...a: unknown[]) => mockLiveCampaigns(...a),
  getCampaign: (...a: unknown[]) => mockGetCampaign(...a),
}));

const mockSnapshot = vi.fn();
vi.mock("@/lib/ad-analytics/runtime", () => ({
  runAdHocSnapshot: (...a: unknown[]) => mockSnapshot(...a),
}));
vi.mock("@/lib/ad-analytics/digest", () => ({
  renderDigest: vi.fn(() => [{ type: "section", text: { type: "mrkdwn", text: "digest" } }]),
}));

const mockLiStatus = vi.fn();
const mockLiInsights = vi.fn();
const mockLiPause = vi.fn();
const mockLiResume = vi.fn();
const mockLiBudget = vi.fn();
vi.mock("@/lib/campaigns/linkedin", () => ({
  getLinkedInCampaignStatus: (...a: unknown[]) => mockLiStatus(...a),
  getLinkedInInsights: (...a: unknown[]) => mockLiInsights(...a),
  pauseLinkedInCampaign: (...a: unknown[]) => mockLiPause(...a),
  resumeLinkedInCampaign: (...a: unknown[]) => mockLiResume(...a),
  setLinkedInCampaignBudget: (...a: unknown[]) => mockLiBudget(...a),
}));

const mockSeo = vi.fn();
const mockLeads = vi.fn();
const mockErrors = vi.fn();
const mockUptime = vi.fn();
const mockSubs = vi.fn();
const mockCache = vi.fn();
vi.mock("@/lib/slack-commands-extra", () => ({
  buildSeoBlocks: (...a: unknown[]) => mockSeo(...a),
  buildLeadsBlocks: (...a: unknown[]) => mockLeads(...a),
  buildErrorsBlocks: (...a: unknown[]) => mockErrors(...a),
  buildUptimeBlocks: (...a: unknown[]) => mockUptime(...a),
  buildSubscribersBlocks: (...a: unknown[]) => mockSubs(...a),
  buildCacheFlushBlocks: (...a: unknown[]) => mockCache(...a),
}));

const mockOpsUsers = vi.fn();
vi.mock("@/lib/slack-ops-users", () => ({
  getSlackOpsUsers: (...a: unknown[]) => mockOpsUsers(...a),
}));

const mockFetch = vi
  .fn()
  .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/slack/commands/route";

function cmd(command: string, extra: Record<string, string> = {}): Request {
  const body = new URLSearchParams({
    command,
    user_id: "U1",
    user_name: "themis",
    text: "",
    channel_id: "C1",
    response_url: "https://hooks.slack.com/commands/resp",
    trigger_id: "trig.1",
    ...extra,
  }).toString();
  mockVerify.mockResolvedValue({ ok: true, body });
  return new Request("http://localhost/api/slack/commands", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

const responseUrlCalls = () =>
  mockFetch.mock.calls.filter((c) => String(c[0]).includes("hooks.slack.com/commands/resp"));

beforeEach(() => {
  vi.clearAllMocks();
  mockSlackConfig.mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-test" });
  mockOpsUsers.mockResolvedValue([]);
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  mockRateLimit.mockReturnValue(true);
  mockSessions.mockResolvedValue({ orders: [], hasMore: false });
});

const lastPosted = () => {
  const calls = responseUrlCalls();
  return JSON.parse(calls[calls.length - 1][1].body as string);
};

function rawRequest(body: string, headers: Record<string, string> = {}): Request {
  mockVerify.mockResolvedValue({ ok: true, body });
  return new Request("http://localhost/api/slack/commands", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

describe("request parsing fallbacks", () => {
  it("keys rate limits on 'unknown' IP and 'anon' user when Slack omits them", async () => {
    const res = await POST(rawRequest(""));
    expect(mockRateLimit).toHaveBeenCalledWith("ip:unknown");
    expect(mockRateLimit).toHaveBeenCalledWith("user:anon");
    expect((await res.json()).text).toBe(
      "Unknown command: ``. Try `/cloudless-help` to see what's available."
    );
  });

  it("uses x-forwarded-for and user_id when present", async () => {
    await POST(
      rawRequest("command=%2Fcloudless-help&user_id=U9", { "x-forwarded-for": "1.2.3.4" })
    );
    expect(mockRateLimit).toHaveBeenCalledWith("ip:1.2.3.4");
    expect(mockRateLimit).toHaveBeenCalledWith("user:U9");
  });
});

describe("/cloudless-status uptime label", () => {
  const uptimeField = async () => {
    const body = await (await POST(cmd("/cloudless-status"))).json();
    return body.blocks[1].fields[1].text as string;
  };

  it.each([
    [42, "*Uptime*\n42s"],
    [125, "*Uptime*\n2m"],
    [7_380, "*Uptime*\n2h 3m"],
  ])("uptime %ss → %j", async (seconds, expected) => {
    vi.spyOn(process, "uptime").mockReturnValue(seconds);
    expect(await uptimeField()).toBe(expected);
    vi.restoreAllMocks();
  });

  it("reports the APP_VERSION, defaulting to dev", async () => {
    vi.stubEnv("APP_VERSION", "1.2.3");
    let body = await (await POST(cmd("/cloudless-status"))).json();
    expect(body.blocks[1].fields[0].text).toBe("*Version*\n`1.2.3`");
    vi.unstubAllEnvs();
    delete process.env.APP_VERSION;
    body = await (await POST(cmd("/cloudless-status"))).json();
    expect(body.blocks[1].fields[0].text).toBe("*Version*\n`dev`");
  });
});

describe("/cloudless-orders rendering", () => {
  const order = (over: Record<string, unknown>) => ({
    paymentStatus: "paid",
    created: 1_760_000_000,
    amount: 1000,
    currency: "EUR",
    email: "a@b.c",
    mode: "payment",
    ...over,
  });

  it("marks paid / unpaid / other statuses, subscriptions and missing emails", async () => {
    mockSessions.mockResolvedValue({
      orders: [
        order({}),
        order({ paymentStatus: "unpaid", mode: "subscription" }),
        order({ paymentStatus: "no_payment_required", email: null }),
      ],
      hasMore: true,
    });
    const body = await (await POST(cmd("/cloudless-orders", { text: "3" }))).json();
    const text = JSON.stringify(body);
    expect(text).toContain(":white_check_mark:");
    expect(text).toContain(":hourglass:");
    expect(text).toContain(":x:");
    expect(text).toContain(":repeat:");
    expect(text).toContain("N/A");
    expect(text).toContain("3 orders (more available)");
    // only the paid order counts toward revenue
    expect(text).toContain("*Paid Revenue*\\n€10.00 EUR");
    expect(mockSessions).toHaveBeenCalledWith(3);
  });

  it("uses the singular for one order and defaults the count to 5", async () => {
    mockSessions.mockResolvedValue({ orders: [order({})], hasMore: false });
    const text = JSON.stringify(await (await POST(cmd("/cloudless-orders"))).json());
    expect(text).toContain("*Showing*\\n1 order");
    expect(text).not.toContain("1 orders");
    expect(text).not.toContain("more available");
    expect(mockSessions).toHaveBeenCalledWith(5);
  });

  it("clamps the requested count to 1..20", async () => {
    await POST(cmd("/cloudless-orders", { text: "500" }));
    expect(mockSessions).toHaveBeenLastCalledWith(20);
    await POST(cmd("/cloudless-orders", { text: "-4" }));
    expect(mockSessions).toHaveBeenLastCalledWith(1);
  });
});

describe("/cloudless-analytics revenue", () => {
  it("adds '+' to the paid count when Stripe has more sessions", async () => {
    mockSessions.mockResolvedValue({
      orders: [
        { paymentStatus: "paid", amount: 500, currency: "EUR", created: 1, mode: "payment" },
      ],
      hasMore: true,
    });
    const text = JSON.stringify(await (await POST(cmd("/cloudless-analytics"))).json());
    expect(text).toContain("*Paid Orders*\\n1+");
  });
});

describe("/cloudless-analytics ads list", () => {
  it("lists campaigns wired for only platforms or only channels with — placeholders", async () => {
    mockLiveCampaigns.mockReturnValue([
      { slug: "platforms-only", adPlatforms: [{ platform: "linkedin", campaignIds: ["1", "2"] }] },
      { slug: "channels-only", notifyChannels: [{ target: "#ads", level: "daily" }] },
      { slug: "unwired" },
    ]);
    const text = JSON.stringify(
      await (await POST(cmd("/cloudless-analytics", { text: "ads" }))).json()
    );
    expect(text).toContain("*platforms-only* — platforms: linkedin(2 ids) · channels: —");
    expect(text).toContain("*channels-only* — platforms: — · channels: #ads(daily)");
    expect(text).not.toContain("unwired");
  });

  it("does not run a snapshot when Slack sent no response_url", async () => {
    mockGetCampaign.mockReturnValue({
      slug: "boost",
      adPlatforms: [{ platform: "linkedin", campaignIds: ["1"] }],
    });
    await POST(cmd("/cloudless-analytics", { text: "ads boost", response_url: "" }));
    await flush();
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it("reports 'unknown' when the snapshot worker throws a non-Error", async () => {
    mockGetCampaign.mockReturnValue({
      slug: "boost",
      adPlatforms: [{ platform: "linkedin", campaignIds: ["1"] }],
    });
    mockSnapshot.mockRejectedValue(undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(cmd("/cloudless-analytics", { text: "ads boost" }));
    await flush();
    expect(lastPosted().text).toBe(":warning: Ad-analytics snapshot failed: `unknown`.");
    err.mockRestore();
  });
});

describe("async command errors without a message", () => {
  it("posts 'unknown' when a builder rejects with a non-Error", async () => {
    mockSeo.mockRejectedValue(undefined);
    await POST(cmd("/cloudless-seo"));
    await flush();
    expect(lastPosted().text).toBe(":warning: Command failed: `unknown`");
  });
});

describe("/cloudless-ads fallbacks", () => {
  beforeEach(() => {
    mockLiveCampaigns.mockReturnValue([
      { slug: "boost", adPlatforms: [{ platform: "linkedin", campaignIds: ["907100946"] }] },
    ]);
  });

  it("empty text shows help", async () => {
    const body = await (await POST(cmd("/cloudless-ads", { text: "   " }))).json();
    expect(body.blocks[0].text.text).toContain("LinkedIn Campaign Control");
  });

  it("budget without an amount shows usage", async () => {
    const body = await (await POST(cmd("/cloudless-ads", { text: "budget" }))).json();
    expect(body.text).toContain("Usage: `/cloudless-ads budget 20`");
    expect(mockLiBudget).not.toHaveBeenCalled();
  });

  it.each([
    ["PAUSED", ":double_vertical_bar: PAUSED"],
    ["DRAFT", ":white_circle: DRAFT"],
  ])("status %s renders its icon, '—' for zero metrics, since today", async (status, label) => {
    mockLiStatus.mockResolvedValue({ ok: true, name: "Boost", status, dailyBudget: "€25" });
    mockLiInsights.mockResolvedValue({
      impressions: 0,
      clicks: 0,
      costInLocalCurrency: "0",
      conversions: 0,
    });
    await POST(cmd("/cloudless-ads", { text: "status" }));
    await flush();
    const posted = lastPosted();
    const text = JSON.stringify(posted);
    expect(posted.blocks[1].fields[1].text).toBe(`*Status*\n${label}`);
    expect(text).toContain("*CTR*\\n—");
    expect(text).toContain("*CPC (lifetime)*\\n—");
    const today = new Date().toISOString().split("T")[0];
    // no campaign.startsAt → lifetime window starts today
    expect(mockLiInsights).toHaveBeenCalledWith(today, today);
    expect(mockLiInsights).toHaveBeenCalledTimes(2);
    expect(text).toContain(`*Lifetime* (since ${today})`);
  });

  it("status computes CTR and CPC when there are clicks", async () => {
    mockLiStatus.mockResolvedValue({
      ok: true,
      name: "Boost",
      status: "ACTIVE",
      dailyBudget: "€25",
    });
    mockLiInsights.mockResolvedValue({
      impressions: 200,
      clicks: 4,
      costInLocalCurrency: "10",
      conversions: 1,
    });
    await POST(cmd("/cloudless-ads", { text: "status" }));
    await flush();
    const text = JSON.stringify(lastPosted());
    expect(text).toContain(":large_green_circle: ACTIVE");
    expect(text).toContain("*CTR*\\n2.00%");
    expect(text).toContain("*CPC (lifetime)*\\n€2.50");
  });

  it("reports pause and budget failures in channel", async () => {
    mockLiPause.mockResolvedValue({ ok: false, error: "403" });
    await POST(cmd("/cloudless-ads", { text: "pause" }));
    await flush();
    expect(lastPosted()).toMatchObject({
      response_type: "in_channel",
      text: ":warning: Failed to pause: 403",
    });

    mockLiBudget.mockResolvedValue({ ok: false, error: "budget too low" });
    await POST(cmd("/cloudless-ads", { text: "budget 1" }));
    await flush();
    expect(lastPosted().text).toBe(":warning: Failed to update budget: budget too low");
  });

  it("reports a successful resume with the actor", async () => {
    mockLiResume.mockResolvedValue({ ok: true });
    await POST(cmd("/cloudless-ads", { text: "resume" }));
    await flush();
    expect(lastPosted().text).toBe(":arrow_forward: Campaign `907100946` resumed by <@U1>.");
  });
});

describe("/cloudless-newsletter send dispatch failure", () => {
  it("falls back to the post id in the re-run hint when the draft has no slug", async () => {
    mockOpsUsers.mockResolvedValue([]);
    mockFindPost.mockResolvedValue({ id: "row-42", slug: "", title: "T", status: "Draft" });
    mockSetStatus.mockResolvedValue(true);
    mockDispatch.mockResolvedValue({ ok: false, status: 500, error: "boom" });
    const body = await (await POST(cmd("/cloudless-newsletter", { text: "send row-42" }))).json();
    expect(body.text).toContain("(HTTP 500): `boom`");
    expect(body.text).toContain("`/cloudless-newsletter send row-42`");
  });
});
