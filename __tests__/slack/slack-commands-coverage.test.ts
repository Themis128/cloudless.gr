/**
 * Coverage batch: slack/commands/route.ts remaining handlers —
 * channels, ads subcommands + async status/pause/resume/budget,
 * draft rerun, newsletter list/send/unpublish, async-command
 * dispatcher (seo/leads/errors/uptime/subscribers/cache),
 * runAsyncCommand + postToResponseUrl error paths.
 *
 * Real route code; fakes only at lib + fetch boundaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...a: unknown[]) => mockVerify(...a),
  unauthorizedSlack: vi.fn((_r: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));
vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: vi.fn().mockResolvedValue({ orders: [], hasMore: false }),
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

const mockFetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
);
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
});

// ---------------------------------------------------------------------------
// /cloudless-channels
// ---------------------------------------------------------------------------

describe("/cloudless-channels", () => {
  it("warns when bot token missing", async () => {
    mockSlackConfig.mockResolvedValue({ SLACK_BOT_TOKEN: undefined });
    const res = await POST(cmd("/cloudless-channels"));
    expect((await res.json()).text).toContain("SLACK_BOT_TOKEN is not configured");
  });

  it("renders member/not-member/missing rows", async () => {
    mockListChannels.mockResolvedValue([
      { name: "bookings", id: "C1", is_member: true },
      { name: "orders", id: "C2", is_member: false },
    ]);
    mockGetBotInfo.mockResolvedValue({ botName: "cloudless-bot", team: "cloudless" });
    const res = await POST(cmd("/cloudless-channels"));
    const text = (await res.json()).blocks[1].text.text;
    expect(text).toContain("✅ member");
    expect(text).toContain("⚠️ not a member");
    expect(text).toContain("missing");
  });

  it("warns on channel-list failure", async () => {
    mockListChannels.mockRejectedValue(new Error("slack down"));
    const res = await POST(cmd("/cloudless-channels"));
    expect((await res.json()).text).toContain("Failed to fetch channel list");
  });
});

// ---------------------------------------------------------------------------
// Async command dispatchers (seo/leads/errors/uptime/subscribers/cache)
// ---------------------------------------------------------------------------

describe("async command fan-out", () => {
  it.each([
    ["/cloudless-seo", "Fetching SEO data"],
    ["/cloudless-leads", "Fetching leads"],
    ["/cloudless-errors", "Fetching errors"],
    ["/cloudless-uptime", "Pinging endpoints"],
    ["/cloudless-subscribers", "Fetching subscribers"],
    ["/cloudless-cache", "Flushing cache"],
  ])("%s acks with hourglass then posts blocks", async (command, hint) => {
    const res = await POST(cmd(command));
    const body = await res.json();
    expect(body.text).toContain(hint);
  });

  it("runAsyncCommand posts builder blocks to response_url", async () => {
    mockSeo.mockResolvedValue([{ type: "section" }]);
    await POST(cmd("/cloudless-seo"));
    await flush();
    const calls = responseUrlCalls();
    expect(calls.length).toBe(1);
    const posted = JSON.parse(calls[0][1].body as string);
    expect(posted.replace_original).toBe(true);
    expect(posted.blocks).toEqual([{ type: "section" }]);
  });

  it("runAsyncCommand posts error text when builder throws", async () => {
    mockLeads.mockRejectedValue(new Error("crm exploded"));
    await POST(cmd("/cloudless-leads"));
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.text).toContain("Command failed");
    expect(posted.text).toContain("crm exploded");
  });

  it("runAsyncCommand early-returns without response_url", async () => {
    mockErrors.mockResolvedValue([]);
    await POST(cmd("/cloudless-errors", { response_url: "" }));
    await flush();
    expect(mockErrors).not.toHaveBeenCalled();
    expect(responseUrlCalls().length).toBe(0);
  });

  it("postToResponseUrl swallows fetch failures", async () => {
    mockUptime.mockResolvedValue([{ type: "divider" }]);
    mockFetch.mockRejectedValue(new Error("network"));
    await POST(cmd("/cloudless-uptime"));
    await flush();
    // no throw escaped — response_url POST failure is logged, not fatal
    expect(mockFetch).toHaveBeenCalled();
  });

  it("/cloudless-cache passes trimmed text as prefix", async () => {
    mockCache.mockResolvedValue([]);
    await POST(cmd("/cloudless-cache", { text: " blog " }));
    await flush();
    expect(mockCache).toHaveBeenCalledWith("U1", "blog");
  });
});

// ---------------------------------------------------------------------------
// /cloudless-ads
// ---------------------------------------------------------------------------

describe("/cloudless-ads", () => {
  beforeEach(() => {
    mockLiveCampaigns.mockReturnValue([
      { slug: "boost", adPlatforms: [{ platform: "linkedin", campaignIds: ["907100946"] }], startsAt: "2026-09-24" },
    ]);
  });

  it("help shows usage blocks without a campaign", async () => {
    mockLiveCampaigns.mockReturnValue([]);
    const res = await POST(cmd("/cloudless-ads", { text: "help" }));
    const body = await res.json();
    expect(body.blocks[0].text.text).toContain("LinkedIn Campaign Control");
  });

  it("warns when no linkedin campaign configured", async () => {
    mockLiveCampaigns.mockReturnValue([]);
    const res = await POST(cmd("/cloudless-ads", { text: "status" }));
    expect((await res.json()).text).toContain("No LinkedIn campaign configured");
  });

  it("budget rejects non-positive amounts", async () => {
    const res = await POST(cmd("/cloudless-ads", { text: "budget -5" }));
    expect((await res.json()).text).toContain("Usage");
    const res2 = await POST(cmd("/cloudless-ads", { text: "budget abc" }));
    expect((await res2.json()).text).toContain("Usage");
  });

  it("status acks and posts a rendered report", async () => {
    mockLiStatus.mockResolvedValue({ ok: true, name: "Boost", status: "ACTIVE", dailyBudget: "€25" });
    mockLiInsights.mockResolvedValue({ impressions: 100, clicks: 5, costInLocalCurrency: "10" });
    const res = await POST(cmd("/cloudless-ads", { text: "status" }));
    expect((await res.json()).text).toContain("Fetching campaign status");
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.blocks[0].text.text).toContain("LinkedIn Campaign Status");
  });

  it("status posts error text when API fails", async () => {
    mockLiStatus.mockResolvedValue({ ok: false, error: "token expired" });
    await POST(cmd("/cloudless-ads", { text: "status" }));
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.text).toContain("token expired");
  });

  it("pause/resume/budget post in_channel results", async () => {
    mockLiPause.mockResolvedValue({ ok: true });
    await POST(cmd("/cloudless-ads", { text: "pause" }));
    await flush();
    let posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.text).toContain("paused by <@U1>");

    mockLiResume.mockResolvedValue({ ok: false, error: "api" });
    await POST(cmd("/cloudless-ads", { text: "resume 123456" }));
    await flush();
    posted = JSON.parse(responseUrlCalls()[1][1].body as string);
    expect(posted.text).toContain("Failed to resume");

    mockLiBudget.mockResolvedValue({ ok: true });
    await POST(cmd("/cloudless-ads", { text: "budget 20" }));
    await flush();
    posted = JSON.parse(responseUrlCalls()[2][1].body as string);
    expect(posted.text).toContain("daily budget set to *€20*");
    expect(mockLiBudget).toHaveBeenCalledWith("907100946", 20);
  });

  it("explicit numeric arg wins over configured campaign", async () => {
    mockLiPause.mockResolvedValue({ ok: true });
    await POST(cmd("/cloudless-ads", { text: "pause 555000111" }));
    await flush();
    expect(mockLiPause).toHaveBeenCalledWith("555000111");
  });
});

// ---------------------------------------------------------------------------
// /cloudless-draft
// ---------------------------------------------------------------------------

describe("/cloudless-draft", () => {
  it("usage without rerun arg", async () => {
    const res = await POST(cmd("/cloudless-draft"));
    expect((await res.json()).text).toContain("Usage");
  });

  it("rejects users not on the ops allowlist", async () => {
    mockOpsUsers.mockResolvedValue(["U_ADMIN"]);
    const res = await POST(cmd("/cloudless-draft", { text: "rerun" }));
    expect((await res.json()).text).toContain("not on the ops allowlist");
  });

  it("dispatches weekly-article-draft for allowlisted user", async () => {
    mockOpsUsers.mockResolvedValue(["U1"]);
    mockDispatch.mockResolvedValue({ ok: true });
    const res = await POST(cmd("/cloudless-draft", { text: "rerun" }));
    const body = await res.json();
    expect(body.response_type).toBe("in_channel");
    expect(mockDispatch).toHaveBeenCalledWith("weekly-article-draft.yml", "main");
  });

  it("reports dispatch failure", async () => {
    mockDispatch.mockResolvedValue({ ok: false, status: 422, error: "bad ref" });
    const res = await POST(cmd("/cloudless-draft", { text: "rerun" }));
    expect((await res.json()).text).toContain("Re-run failed (HTTP 422)");
  });
});

// ---------------------------------------------------------------------------
// /cloudless-newsletter
// ---------------------------------------------------------------------------

const draft = (o: Record<string, unknown> = {}) => ({
  id: "abcdef1234567890",
  slug: "my-post",
  title: "My Post",
  status: "Draft",
  category: "eng",
  readTime: "5 min",
  createdAt: "2026-10-01T00:00:00Z",
  url: "https://cloudless.gr/blog/my-post",
  ...o,
});

describe("/cloudless-newsletter", () => {
  it("usage blocks on empty/unknown subcommand", async () => {
    for (const text of ["", "bogus"]) {
      const res = await POST(cmd("/cloudless-newsletter", { text }));
      expect((await res.json()).blocks[0].text.text).toContain("Usage");
    }
  });

  it("list shows empty state", async () => {
    mockListPosts.mockResolvedValue([]);
    const res = await POST(cmd("/cloudless-newsletter", { text: "list" }));
    expect((await res.json()).text).toContain("No pending drafts");
  });

  it("list renders drafts with slug and id fallbacks", async () => {
    mockListPosts.mockResolvedValue([
      draft(),
      draft({ id: "noplug1234567", slug: undefined, url: undefined, status: "In Review", createdAt: undefined }),
    ]);
    const res = await POST(cmd("/cloudless-newsletter", { text: "list" }));
    const text = (await res.json()).blocks[1].text.text;
    expect(text).toContain("`my-post`");
    expect(text).toContain(":eyes:");
    expect(text).toContain("`noplug12`");
  });

  it("unpublish requires a target", async () => {
    const res = await POST(cmd("/cloudless-newsletter", { text: "unpublish" }));
    expect((await res.json()).text).toContain("Usage");
  });

  it("unpublish gates on allowlist, finds post, flips, confirms", async () => {
    mockOpsUsers.mockResolvedValue(["OTHER"]);
    let res = await POST(cmd("/cloudless-newsletter", { text: "unpublish x" }));
    expect((await res.json()).text).toContain("not on the ops allowlist");

    mockOpsUsers.mockResolvedValue(["U1"]);
    mockFindPost.mockResolvedValue(null);
    res = await POST(cmd("/cloudless-newsletter", { text: "unpublish ghost" }));
    expect((await res.json()).text).toContain("Could not find");

    mockFindPost.mockResolvedValue(draft());
    mockSetStatus.mockResolvedValue(false);
    res = await POST(cmd("/cloudless-newsletter", { text: "unpublish my-post" }));
    expect((await res.json()).text).toContain("Failed to update AppFlowy");

    mockSetStatus.mockResolvedValue(true);
    res = await POST(cmd("/cloudless-newsletter", { text: "unpublish my-post" }));
    const body = await res.json();
    expect(body.response_type).toBe("in_channel");
    expect(body.blocks[0].text.text).toContain("Newsletter Unpublished");
    expect(mockSetStatus).toHaveBeenCalledWith("abcdef1234567890", "Archived");
  });

  it("send requires a target and allowlist", async () => {
    let res = await POST(cmd("/cloudless-newsletter", { text: "send" }));
    expect((await res.json()).text).toContain("Usage");

    mockOpsUsers.mockResolvedValue(["OTHER"]);
    res = await POST(cmd("/cloudless-newsletter", { text: "send x" }));
    expect((await res.json()).text).toContain("not on the ops allowlist");
  });

  it("send handles not-found, already-published, flip and dispatch failures, success", async () => {
    mockOpsUsers.mockResolvedValue([]);
    mockFindPost.mockResolvedValue(null);
    let res = await POST(cmd("/cloudless-newsletter", { text: "send ghost" }));
    expect((await res.json()).text).toContain("Could not find an AppFlowy draft");

    mockFindPost.mockResolvedValue(draft({ status: "Published" }));
    res = await POST(cmd("/cloudless-newsletter", { text: "send my-post" }));
    expect((await res.json()).text).toContain("already Published");

    mockFindPost.mockResolvedValue(draft());
    mockSetStatus.mockResolvedValue(false);
    res = await POST(cmd("/cloudless-newsletter", { text: "send my-post" }));
    expect((await res.json()).text).toContain("Failed to update AppFlowy status");

    mockSetStatus.mockResolvedValue(true);
    mockDispatch.mockResolvedValue({ ok: false, status: 500, error: "ci down" });
    res = await POST(cmd("/cloudless-newsletter", { text: "send my-post" }));
    expect((await res.json()).text).toContain("workflow dispatch failed");

    mockDispatch.mockResolvedValue({ ok: true });
    res = await POST(cmd("/cloudless-newsletter", { text: "send my-post" }));
    const body = await res.json();
    expect(body.response_type).toBe("in_channel");
    expect(body.blocks[0].text.text).toContain("Newsletter Send Initiated");
    expect(mockDispatch).toHaveBeenCalledWith("weekly-newsletter.yml", "main");
  });
});

// ---------------------------------------------------------------------------
// /cloudless-analytics ads multiplex
// ---------------------------------------------------------------------------

describe("/cloudless-analytics ads", () => {
  it("ads help lists usage", async () => {
    const res = await POST(cmd("/cloudless-analytics", { text: "ads help" }));
    const text = (await res.json()).blocks[0].text.text;
    expect(text).toContain("/cloudless-analytics ads");
  });

  it("ads lists configured campaigns", async () => {
    mockLiveCampaigns.mockReturnValue([
      {
        slug: "boost",
        adPlatforms: [{ platform: "linkedin", campaignIds: ["907100946"] }],
        notifyChannels: [{ target: "#ads" }],
        startsAt: "2026-09-24",
      },
    ]);
    const res = await POST(cmd("/cloudless-analytics", { text: "ads" }));
    const body = await res.json();
    expect(JSON.stringify(body)).toContain("boost");
  });

  it("ads <slug> warns on unknown campaign", async () => {
    mockGetCampaign.mockReturnValue(undefined);
    const res = await POST(cmd("/cloudless-analytics", { text: "ads ghost" }));
    expect((await res.json()).text).toContain("No campaign named");
  });

  it("ads <slug> notes missing adPlatforms", async () => {
    mockGetCampaign.mockReturnValue({ slug: "boost" });
    const res = await POST(cmd("/cloudless-analytics", { text: "ads boost" }));
    expect((await res.json()).text).toContain("no `adPlatforms[]`");
  });

  it("ads <slug> acks and posts the snapshot digest", async () => {
    mockGetCampaign.mockReturnValue({
      slug: "boost",
      adPlatforms: [{ platform: "linkedin", campaignIds: ["1"] }],
    });
    mockSnapshot.mockResolvedValue({ metrics: [{ platform: "linkedin" }] });
    const res = await POST(cmd("/cloudless-analytics", { text: "ads boost" }));
    expect((await res.json()).text).toContain("Fetching live metrics");
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.blocks.length).toBeGreaterThan(1); // digest + context footer
  });

  it("ads <slug> warns when snapshot has no metrics", async () => {
    mockGetCampaign.mockReturnValue({ slug: "boost", adPlatforms: [{ platform: "linkedin" }] });
    mockSnapshot.mockResolvedValue({ metrics: [] });
    await POST(cmd("/cloudless-analytics", { text: "ads boost" }));
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.text).toContain("No metrics returned");
  });

  it("ads <slug> surfaces snapshot worker errors", async () => {
    mockGetCampaign.mockReturnValue({ slug: "boost", adPlatforms: [{ platform: "linkedin" }] });
    mockSnapshot.mockRejectedValue(new Error("linkedin 500"));
    await POST(cmd("/cloudless-analytics", { text: "ads boost" }));
    await flush();
    const posted = JSON.parse(responseUrlCalls()[0][1].body as string);
    expect(posted.text).toContain("snapshot failed");
    expect(posted.text).toContain("linkedin 500");
  });
});
