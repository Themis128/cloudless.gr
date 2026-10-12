// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { AdPlatformAdapter } from "@/lib/ad-analytics/adapters/ad-platform";
import type { NotificationChannel } from "@/lib/ad-analytics/channels/notification";
import type { AdMetrics } from "@/lib/ad-analytics/types";

beforeEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
});
afterEach(() => {
  vi.doUnmock("@/data/campaigns");
  vi.restoreAllMocks();
});

const mkAdapter = (over: Partial<AdPlatformAdapter> = {}): AdPlatformAdapter => ({
  id: "linkedin",
  isConfigured: vi.fn().mockResolvedValue(true),
  pullMetrics: vi.fn().mockResolvedValue([]),
  pushConversion: vi.fn().mockResolvedValue({ accepted: true, status: 201 }),
  ...over,
});
const mkChannel = (id = "slack", mid = "slack:#t:1"): NotificationChannel => ({
  id: id as NotificationChannel["id"],
  isConfigured: vi.fn().mockResolvedValue(true),
  sendBlock: vi.fn().mockResolvedValue({ messageId: mid }),
  reply: vi.fn().mockResolvedValue(undefined),
});

const baseCampaign = {
  slug: "tail-c",
  status: "live",
  startsAt: "",
  endsAt: "",
  tagline: { el: "", en: "" },
  headline: { el: "", en: "" },
  headlineAccent: { el: "", en: "" },
  subhead: { el: "", en: "" },
  heroImage: "",
  ogImage: "",
  tiers: [],
  faq: [],
  utmCampaign: "",
  linkedinConversionId: null,
};

async function freshRuntime(campaigns: unknown[]) {
  vi.doMock("@/data/campaigns", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/data/campaigns")>();
    return {
      ...actual,
      campaigns,
      getCampaign: (slug: string) =>
        (campaigns as Array<{ slug: string }>).find((c) => c.slug === slug),
    };
  });
  vi.resetModules();
  const mod = await import("@/lib/ad-analytics/runtime");
  const { _resetBookmarkStore } = await import("@/lib/ad-analytics/bookmarks");
  _resetBookmarkStore();
  return mod;
}

describe("dispatchConversion tail", () => {
  it("skips platforms with null capiConversionId / no adapter; catches channel errors; hashes customer email", async () => {
    const runtime = await freshRuntime([
      {
        ...baseCampaign,
        adPlatforms: [
          { platform: "linkedin", accountId: "a", campaignIds: [], capiConversionId: null },
          { platform: "meta", accountId: "a", campaignIds: [], capiConversionId: 7 },
          { platform: "linkedin", accountId: "a2", campaignIds: [], capiConversionId: 42 },
        ],
        notifyChannels: [
          { channel: "email", target: "e@x.gr", level: "event" },
          { channel: "slack", target: "#t", level: "event" },
        ],
      },
    ]);
    const pushConversion = vi.fn().mockResolvedValue({ accepted: true, status: 201 });
    const adapter = mkAdapter({ pushConversion });
    const failing = mkChannel("slack");
    failing.sendBlock = vi.fn().mockRejectedValue(new Error("slack down"));
    const restore = runtime._setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: failing }, // email unregistered → skipped
    });

    const outcome = await runtime.dispatchConversion({
      campaign: "tail-c",
      tier: "x",
      orderId: "o1",
      conversionId: null,
      customer: { email: "  User@X.gr " },
    });
    restore();

    // only the linkedin config with capiConversionId=42 pushed
    expect(pushConversion).toHaveBeenCalledTimes(1);
    expect(pushConversion.mock.calls[0][0].conversionId).toBe(42);
    // sha256 of normalized email
    const { createHash } = await import("crypto");
    const want = createHash("sha256").update("user@x.gr").digest("hex");
    expect(pushConversion.mock.calls[0][0].user.emailSha256).toBe(want);

    expect(outcome.capi).toEqual([
      { platform: "linkedin", accepted: true, status: 201, message: undefined },
    ]);
    expect(outcome.notifications).toEqual([
      { channel: "slack", target: "#t", ok: false },
    ]);
    expect(outcome.noop).toBe(false);
  });

  it("noop when campaign has no adPlatforms and no event channels", async () => {
    const runtime = await freshRuntime([{ ...baseCampaign }]);
    const outcome = await runtime.dispatchConversion({
      campaign: "tail-c",
      tier: null,
      orderId: null,
      conversionId: null,
    });
    expect(outcome).toEqual({ capi: [], notifications: [], noop: true });
  });
});

describe("runScheduledPoll tail", () => {
  const metrics: AdMetrics = {
    platform: "linkedin",
    campaignId: "c1",
    windowStart: "t0",
    windowEnd: "t1",
    impressions: 300,
    clicks: 3,
    conversions: 0,
    spendEur: 9,
    cpcEur: 3,
    ctr: 0.01,
  };

  function digestCampaign(over: Record<string, unknown> = {}) {
    return {
      ...baseCampaign,
      adPlatforms: [
        {
          platform: "linkedin",
          accountId: "a",
          campaignIds: ["c1"],
          ...((over.platformConfig as object) ?? {}),
        },
      ],
      notifyChannels: [
        { channel: "slack", target: "#d", level: "digest" },
        ...((over.extraChannels as object[]) ?? []),
      ],
      ...over.campaign,
    };
  }

  it("skips: non-live status, no digest channel, empty adPlatforms", async () => {
    const runtime = await freshRuntime([
      { ...baseCampaign, slug: "tail-c", status: "draft", notifyChannels: [{ channel: "slack", target: "#d", level: "digest" }], adPlatforms: [{ platform: "linkedin", accountId: "a", campaignIds: ["c"] }] },
      { ...baseCampaign, slug: "tail-c2", adPlatforms: [{ platform: "linkedin", accountId: "a", campaignIds: ["c"] }], notifyChannels: [{ channel: "slack", target: "#r", level: "event" }] },
      { ...baseCampaign, slug: "tail-c3", adPlatforms: [], notifyChannels: [{ channel: "slack", target: "#d", level: "digest" }] },
    ]);
    const out = await runtime.runScheduledPoll();
    expect(out.noop).toBe(true);
    expect(out.digests).toEqual([]);
  });

  it("reports skipped for unregistered platform + pullMetrics throw", async () => {
    const runtime = await freshRuntime([
      digestCampaign({ platformConfig: { platform: "meta" } }),
      {
        ...digestCampaign(),
        slug: "tail-c4",
      },
    ]);
    // second campaign (tail-c4) uses linkedin adapter that throws
    const adapter = mkAdapter({ pullMetrics: vi.fn().mockRejectedValue(new Error("api down")) });
    const restore = runtime._setRegistries({ adapters: { linkedin: adapter }, channels: { slack: mkChannel() } });
    const out = await runtime.runScheduledPoll();
    restore();

    expect(out.digests[0].skipped).toBe("no adapter registered for meta");
    expect(out.digests[1].skipped).toBe("pullMetrics threw");
  });

  it("pacing: account-spend path, fallback path, throw tolerated", async () => {
    const pacing = {
      creditEur: 100,
      lifetimeBudgetEur: 50,
      adsStartAt: new Date(Date.now() - 86400000).toISOString(),
      adsEndAt: "2030-01-01",
    };
    const runtime = await freshRuntime([
      digestCampaign({
        platformConfig: {
          platform: "linkedin",
          accountId: "a",
          campaignIds: ["c1"],
          pacing,
        },
      }),
    ]);
    const adapter = mkAdapter({
      pullMetrics: vi.fn().mockResolvedValue([{ ...metrics }]),
      pullAccountSpendEur: vi.fn().mockResolvedValue(33.33),
    });
    const ch = mkChannel();
    const restore = runtime._setRegistries({ adapters: { linkedin: adapter }, channels: { slack: ch } });
    await runtime.runScheduledPoll();
    restore();
    expect(adapter.pullAccountSpendEur).toHaveBeenCalled();
    const sent = ch.sendBlock.mock.calls[0][0].blocks;
    expect(JSON.stringify(sent)).toContain("33.33");

    // fallback: pullAccountSpendEur → null → lifetime pullMetrics sum
    const bm = await import("@/lib/ad-analytics/bookmarks");
    bm._resetBookmarkStore();
    const adapter2 = mkAdapter({
      pullMetrics: vi.fn().mockResolvedValue([{ ...metrics, spendEur: 7 }]),
      pullAccountSpendEur: vi.fn().mockResolvedValue(null),
    });
    const restore2 = runtime._setRegistries({ adapters: { linkedin: adapter2 }, channels: { slack: mkChannel() } });
    await runtime.runScheduledPoll();
    restore2();
    // second call = lifetime fallback query (pivots [])
    const calls = adapter2.pullMetrics.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][0].pivots).toEqual([]);

    // throw inside pacing → tolerated
    bm._resetBookmarkStore();
    const adapter3 = mkAdapter({
      pullMetrics: vi.fn().mockResolvedValue([{ ...metrics }]),
      pullAccountSpendEur: vi.fn().mockRejectedValue(new Error("nope")),
    });
    const restore3 = runtime._setRegistries({ adapters: { linkedin: adapter3 }, channels: { slack: mkChannel() } });
    const out3 = await runtime.runScheduledPoll();
    restore3();
    expect(out3.digests[0].metrics).toHaveLength(1);
  });

  it("anomaly channel: fires DM, dedups second run, tolerates send failures", async () => {
    const runtime = await freshRuntime([
      digestCampaign({
        campaign: { anomalyRules: { maxCpcEur: 1 } },
        extraChannels: [{ channel: "slack", target: "#dm", level: "anomaly" }],
      }),
    ]);
    const adapter = mkAdapter({
      pullMetrics: vi.fn().mockResolvedValue([{ ...metrics, cpcEur: 5 }]),
    });
    const ch = mkChannel();
    const restore = runtime._setRegistries({ adapters: { linkedin: adapter }, channels: { slack: ch } });

    const out1 = await runtime.runScheduledPoll({ now: new Date("2026-06-01T12:00:00Z") });
    // digest send + anomaly send
    expect(ch.sendBlock).toHaveBeenCalledTimes(2);
    expect(out1.digests[0].posted).toEqual([
      { channel: "slack", target: "#d", ok: true },
      { channel: "slack", target: "#dm", ok: true },
    ]);

    // same windowEnd → dedup filters the finding → only digest send
    ch.sendBlock.mockClear();
    await runtime.runScheduledPoll({ now: new Date("2026-06-01T12:00:00Z") });
    expect(ch.sendBlock).toHaveBeenCalledTimes(1);

    // sendBlock throw → posted ok:false
    ch.sendBlock.mockRejectedValueOnce(new Error("x"));
    const bm = await import("@/lib/ad-analytics/bookmarks");
    bm._resetBookmarkStore();
    const out3 = await runtime.runScheduledPoll({ now: new Date("2026-06-02T12:00:00Z") });
    expect(out3.digests[0].posted.some((p) => !p.ok)).toBe(true);
    restore();

    // anomaly-channel sendBlock throw → catch path records ok:false
    const bm2 = await import("@/lib/ad-analytics/bookmarks");
    bm2._resetBookmarkStore();
    const ch2 = mkChannel();
    // digest send ok, anomaly send throws
    ch2.sendBlock = vi
      .fn()
      .mockResolvedValueOnce({ messageId: "slack:#d:1" })
      .mockRejectedValueOnce(new Error("dm down"))
      .mockResolvedValue({ messageId: "slack:#d:1" });
    const restore2 = runtime._setRegistries({ adapters: { linkedin: adapter }, channels: { slack: ch2 } });
    const out4 = await runtime.runScheduledPoll({ now: new Date("2026-06-03T12:00:00Z") });
    restore2();
    expect(out4.digests[0].posted).toContainEqual({ channel: "slack", target: "#dm", ok: false });
  });
});

describe("aggregateCampaignMetrics multi-row", () => {
  it("sums counts, derives rates, merges demographics + leaderboards, preserves breakdown", async () => {
    const { aggregateCampaignMetrics } = await import("@/lib/ad-analytics/runtime");
    const a: AdMetrics = {
      platform: "linkedin",
      campaignId: "c1",
      windowStart: "t0",
      windowEnd: "t2",
      impressions: 100,
      clicks: 10,
      conversions: 2,
      spendEur: 20,
      lifetimeSpendEur: 50,
      demographics: { MEMBER_INDUSTRY: [{ label: "Tech", clicks: 3 }] },
      creativeLeaderboard: [{ creativeId: "k1", label: "A", impressions: 1, clicks: 5 }],
    };
    const b: AdMetrics = {
      platform: "linkedin",
      campaignId: "c2",
      windowStart: "t1",
      windowEnd: "t3",
      impressions: 300,
      clicks: 30,
      conversions: 4,
      spendEur: 30,
      demographics: {
        MEMBER_INDUSTRY: [
          { label: "Tech", clicks: 1 },
          { label: "Retail", clicks: 9 },
        ],
      },
      creativeLeaderboard: [{ creativeId: "k2", label: "B", impressions: 2, clicks: 25 }],
    };
    const agg = aggregateCampaignMetrics([a, b]);
    expect(agg.impressions).toBe(400);
    expect(agg.ctr).toBeCloseTo(0.1);
    expect(agg.cpcEur).toBeCloseTo(50 / 40);
    expect(agg.cpaEur).toBeCloseTo(50 / 6);
    expect(agg.lifetimeSpendEur).toBe(50);
    expect(agg.demographics!.MEMBER_INDUSTRY![0]).toEqual({ label: "Retail", clicks: 9 });
    expect(agg.demographics!.MEMBER_INDUSTRY![1]).toEqual({ label: "Tech", clicks: 4 });
    expect(agg.creativeLeaderboard![0].creativeId).toBe("k2");
    expect(agg.campaignBreakdown).toHaveLength(2);
    expect(agg.campaignId).toBe("c1,c2");
    expect(agg.windowStart).toBe("t0");
    expect(agg.windowEnd).toBe("t3");
  });
});

describe("runAdHocSnapshot", () => {
  it("null for unknown slug; skips unregistered adapter; tolerates pull throw", async () => {
    const runtime = await freshRuntime([
      {
        ...baseCampaign,
        adPlatforms: [
          { platform: "linkedin", accountId: "a", campaignIds: ["c1"] },
          { platform: "meta", accountId: "a", campaignIds: ["c2"] },
        ],
      },
    ]);
    expect(await runtime.runAdHocSnapshot({ campaignSlug: "nope" })).toBeNull();

    const adapter = mkAdapter({
      pullMetrics: vi
        .fn()
        .mockResolvedValueOnce([
          {
            platform: "linkedin",
            campaignId: "c1",
            windowStart: "a",
            windowEnd: "b",
            impressions: 1,
            clicks: 0,
            conversions: 0,
            spendEur: 0,
          },
        ])
        .mockRejectedValueOnce(new Error("boom")),
    });
    // two linkedin configs? No — one linkedin + one meta (unregistered → skip).
    const restore = runtime._setRegistries({ adapters: { linkedin: adapter } });
    const snap = await runtime.runAdHocSnapshot({ campaignSlug: "tail-c" });
    restore();
    expect(snap!.metrics).toHaveLength(1);

    // pullMetrics throw → tolerated, empty metrics
    const throwAdapter = mkAdapter({
      pullMetrics: vi.fn().mockRejectedValue(new Error("adhoc boom")),
    });
    const restore3 = runtime._setRegistries({ adapters: { linkedin: throwAdapter } });
    const snap2 = await runtime.runAdHocSnapshot({ campaignSlug: "tail-c" });
    restore3();
    expect(snap2).toEqual({ campaign: "tail-c", metrics: [] });
  });
});
