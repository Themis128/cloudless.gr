// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  dispatchConversion,
  _setRegistries,
  aggregateCampaignMetrics,
} from "@/lib/ad-analytics/runtime";
import type { AdPlatformAdapter } from "@/lib/ad-analytics/adapters/ad-platform";
import type { NotificationChannel } from "@/lib/ad-analytics/channels/notification";

// `getCampaign` reads from `src/data/campaigns.ts` — the runtime resolves
// real campaign config (including the live `shop-online`). We don't mock it;
// instead we drive behaviour via the adapter + channel registries and assert
// what the orchestrator forwards to each.

let restore: (() => void) | null = null;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (restore) restore();
  restore = null;
});

function fakeAdapter(overrides: Partial<AdPlatformAdapter> = {}): AdPlatformAdapter {
  return {
    id: "linkedin",
    isConfigured: vi.fn().mockResolvedValue(true),
    pullMetrics: vi.fn().mockResolvedValue([]),
    pushConversion: vi.fn().mockResolvedValue({ accepted: true, status: 200 }),
    ...overrides,
  };
}

function fakeChannel(overrides: Partial<NotificationChannel> = {}): NotificationChannel {
  return {
    id: "slack",
    isConfigured: vi.fn().mockResolvedValue(true),
    sendBlock: vi.fn().mockResolvedValue({ messageId: "slack:#ads-realtime:1" }),
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("dispatchConversion", () => {
  it("returns noop for an unknown campaign slug", async () => {
    const adapter = fakeAdapter();
    const channel = fakeChannel();
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: { slack: channel } });

    const outcome = await dispatchConversion({
      campaign: "definitely-not-a-real-slug",
      tier: null,
      orderId: null,
      conversionId: null,
    });

    expect(outcome.noop).toBe(true);
    expect(adapter.pushConversion).not.toHaveBeenCalled();
    expect(channel.sendBlock).not.toHaveBeenCalled();
  });

  it("fires the event-level Slack ping for shop-online", async () => {
    const adapter = fakeAdapter();
    const channel = fakeChannel();
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: { slack: channel } });

    const outcome = await dispatchConversion({
      campaign: "shop-online",
      tier: "starter",
      orderId: "cs_test_xyz",
      conversionId: 26846068,
      url: "https://cloudless.gr/en/campaigns/shop-online/thanks?tier=starter&order=cs_test_xyz",
      utm: { source: "linkedin", medium: "cpc", campaign: "shop_online_founding", content: "A_EN" },
      country: "GR",
    });

    expect(channel.sendBlock).toHaveBeenCalledTimes(1);
    const args = (channel.sendBlock as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.target).toBe("#ads-realtime");
    expect(args.blocks.length).toBeGreaterThan(0);
    // The header block should name the campaign so the operator sees it
    // immediately on a phone notification.
    const header = args.blocks.find((b: { type: string }) => b.type === "header");
    expect(header?.text).toContain("shop-online");
    // The metadata section should surface the order id + tier + creative.
    const sectionText = args.blocks
      .filter((b: { type: string; text?: string }) => b.type === "section")
      .map((b: { text?: string }) => b.text ?? "")
      .join("\n");
    expect(sectionText).toContain("starter");
    expect(sectionText).toContain("cs_test_xyz");
    expect(sectionText).toContain("A_EN");

    expect(outcome.notifications).toEqual([
      {
        channel: "slack",
        target: "#ads-realtime",
        messageId: "slack:#ads-realtime:1",
        ok: true,
      },
    ]);
    expect(outcome.noop).toBe(false);
  });

  it("fires the CAPI mirror now that capiConversionId is wired", async () => {
    // shop-online ships with capiConversionId: 26846116 (CONVERSIONS_API-typed).
    // The runtime MUST call pushConversion for it.
    const adapter = fakeAdapter();
    const channel = fakeChannel();
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: { slack: channel } });

    const outcome = await dispatchConversion({
      campaign: "shop-online",
      tier: "starter",
      orderId: "cs_test_xyz",
      conversionId: 26846068,
    });

    expect(adapter.pushConversion).toHaveBeenCalledTimes(1);
    const args = (adapter.pushConversion as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.conversionId).toBe(26846116);
    expect(outcome.capi).toEqual([
      { platform: "linkedin", accepted: true, status: 200, message: undefined },
    ]);
  });

  it("fires CAPI when an adPlatform with capiConversionId set is registered", async () => {
    // Simulate a future state where the operator has wired CAPI by
    // monkey-patching the registry with an adapter we control. We can't
    // mutate `src/data/campaigns.ts` from a test, so we drive this through
    // a synthetic campaign by intercepting `getCampaign`.
    const adapter = fakeAdapter({
      pushConversion: vi
        .fn()
        .mockResolvedValue({ accepted: true, status: 200, message: undefined }),
    });
    const channel = fakeChannel();
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: { slack: channel } });

    vi.doMock("@/data/campaigns", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/data/campaigns")>();
      return {
        ...actual,
        getCampaign: (slug: string) => {
          if (slug !== "test-capi") return undefined;
          return {
            slug: "test-capi",
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
            linkedinConversionId: 26846068,
            adPlatforms: [
              {
                platform: "linkedin",
                accountId: "511588554",
                campaignIds: ["692134846"],
                insightTagConversionId: 26846068,
                capiConversionId: 99999999, // operator-wired CONVERSIONS_API-typed
              },
            ],
            notifyChannels: [{ channel: "slack", target: "#ads-realtime", level: "event" }],
          };
        },
      };
    });
    vi.resetModules();
    const fresh = await import("@/lib/ad-analytics/runtime");
    const innerRestore = fresh._setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: channel },
    });

    const outcome = await fresh.dispatchConversion({
      campaign: "test-capi",
      tier: "starter",
      orderId: "cs_capi_test",
      conversionId: 26846068,
    });

    expect(adapter.pushConversion).toHaveBeenCalledTimes(1);
    const args = (adapter.pushConversion as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.conversionId).toBe(99999999);
    expect(args.eventId).toBe("cs_capi_test");
    expect(outcome.capi).toEqual([
      { platform: "linkedin", accepted: true, status: 200, message: undefined },
    ]);

    innerRestore();
    vi.doUnmock("@/data/campaigns");
  });
});

describe("aggregateCampaignMetrics", () => {
  const row = (over: Partial<import("@/lib/ad-analytics/types").AdMetrics> = {}) => ({
    platform: "linkedin" as const,
    campaignId: "1",
    windowStart: "2026-09-27T18:00:00Z",
    windowEnd: "2026-09-27T19:00:00Z",
    impressions: 100,
    clicks: 10,
    conversions: 1,
    spendEur: 5,
    ...over,
  });

  it("returns the single row unchanged", () => {
    const r = row({ campaignId: "907100946" });
    expect(aggregateCampaignMetrics([r])).toBe(r);
  });

  it("sums counts, derives rates, and keeps per-campaign breakdown", () => {
    const out = aggregateCampaignMetrics([
      row({ campaignId: "907100946", impressions: 661, clicks: 28, spendEur: 18.8 }),
      row({ campaignId: "857622786", impressions: 0, clicks: 0, conversions: 0, spendEur: 0 }),
    ]);
    expect(out.impressions).toBe(661);
    expect(out.clicks).toBe(28);
    expect(out.spendEur).toBeCloseTo(18.8);
    expect(out.ctr).toBeCloseTo(28 / 661);
    expect(out.campaignBreakdown).toHaveLength(2);
    expect(out.campaignBreakdown?.[0].campaignId).toBe("907100946");
  });

  it("merges demographics by label and concats creative leaderboards", () => {
    const out = aggregateCampaignMetrics([
      row({
        demographics: { MEMBER_JOB_TITLE: [{ label: "Founder", clicks: 3 }] },
        creativeLeaderboard: [{ creativeId: "a", label: "A", impressions: 10, clicks: 2 }],
      }),
      row({
        campaignId: "2",
        demographics: { MEMBER_JOB_TITLE: [{ label: "Founder", clicks: 1 }] },
        creativeLeaderboard: [{ creativeId: "b", label: "B", impressions: 5, clicks: 9 }],
      }),
    ]);
    expect(out.demographics?.MEMBER_JOB_TITLE).toEqual([{ label: "Founder", clicks: 4 }]);
    // Sorted by clicks desc — B outranks A.
    expect(out.creativeLeaderboard?.[0].creativeId).toBe("b");
  });
});
