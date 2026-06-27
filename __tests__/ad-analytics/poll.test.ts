// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runScheduledPoll as _runScheduledPoll, _setRegistries } from "@/lib/ad-analytics/runtime";
import { _resetBookmarkStore } from "@/lib/ad-analytics/bookmarks";
import type { AdMetrics } from "@/lib/ad-analytics/types";
import type { AdPlatformAdapter } from "@/lib/ad-analytics/adapters/ad-platform";
import type { NotificationChannel } from "@/lib/ad-analytics/channels/notification";

let restoreRegistries: (() => void) | null = null;

beforeEach(() => {
  delete process.env.AD_ANALYTICS_BOOKMARKS_TABLE;
  _resetBookmarkStore();
});

afterEach(() => {
  if (restoreRegistries) restoreRegistries();
  restoreRegistries = null;
  _resetBookmarkStore();
  vi.restoreAllMocks();
});

function fakeAdapter(metrics: AdMetrics): AdPlatformAdapter {
  return {
    id: "linkedin",
    isConfigured: vi.fn().mockResolvedValue(true),
    pullMetrics: vi.fn().mockResolvedValue([metrics]),
    pushConversion: vi.fn().mockResolvedValue({ accepted: true, status: 200 }),
  };
}

function fakeChannel(messageId: string): NotificationChannel {
  return {
    id: "slack",
    isConfigured: vi.fn().mockResolvedValue(true),
    sendBlock: vi.fn().mockResolvedValue({ messageId }),
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe("runScheduledPoll", () => {
  it("returns noop when no campaign has a digest channel", async () => {
    // Use a mocked campaigns module so this assertion stays meaningful even
    // after the live `shop-online` config opts INTO #ads-digest.
    vi.doMock("@/data/campaigns", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/data/campaigns")>();
      return {
        ...actual,
        campaigns: [
          {
            slug: "test-no-digest",
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
                capiConversionId: null,
              },
            ],
            // Only an event-level channel — no digest target. The poll must
            // skip this campaign entirely instead of spamming a digest
            // message to the realtime channel.
            notifyChannels: [{ channel: "slack", target: "#ads-realtime", level: "event" }],
          },
        ],
      };
    });
    vi.resetModules();
    const fresh = await import("@/lib/ad-analytics/runtime");

    const adapter = fakeAdapter({
      platform: "linkedin",
      campaignId: "692134846",
      windowStart: "",
      windowEnd: "",
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spendEur: 0,
    });
    const channel = fakeChannel("slack:#ads-realtime:1");
    const restore = fresh._setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: channel },
    });

    const outcome = await fresh.runScheduledPoll();
    expect(outcome.noop).toBe(true);
    expect(adapter.pullMetrics).not.toHaveBeenCalled();
    expect(channel.sendBlock).not.toHaveBeenCalled();

    restore();
    vi.doUnmock("@/data/campaigns");
  });

  it("posts a digest + advances bookmark when a digest channel is present", async () => {
    vi.doMock("@/data/campaigns", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/data/campaigns")>();
      return {
        ...actual,
        campaigns: [
          {
            slug: "test-digest",
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
                capiConversionId: null,
              },
            ],
            notifyChannels: [{ channel: "slack", target: "#ads-digest", level: "digest" }],
          },
        ],
      };
    });
    vi.resetModules();
    const fresh = await import("@/lib/ad-analytics/runtime");
    const bookmarks = await import("@/lib/ad-analytics/bookmarks");

    const metrics: AdMetrics = {
      platform: "linkedin",
      campaignId: "692134846",
      windowStart: "2026-06-19T08:00:00.000Z",
      windowEnd: "2026-06-19T09:00:00.000Z",
      impressions: 386,
      clicks: 2,
      conversions: 0,
      spendEur: 15.57,
    };
    const adapter = fakeAdapter(metrics);
    const channel = fakeChannel("slack:#ads-digest:1");
    const restore = fresh._setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: channel },
    });

    const outcome = await fresh.runScheduledPoll({
      now: new Date("2026-06-19T09:00:00.000Z"),
    });

    expect(adapter.pullMetrics).toHaveBeenCalledTimes(1);
    expect(channel.sendBlock).toHaveBeenCalledTimes(1);
    const sentArgs = (channel.sendBlock as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentArgs.target).toBe("#ads-digest");

    expect(outcome.digests).toHaveLength(1);
    expect(outcome.digests[0]).toMatchObject({
      campaign: "test-digest",
      platform: "linkedin",
    });
    expect(outcome.digests[0].posted[0].ok).toBe(true);

    // Bookmark advanced — second poll should diff against this snapshot.
    const key = bookmarks.bookmarkKeyOf({
      campaignSlug: "test-digest",
      platform: "linkedin",
      metric: "headline",
      window: "60m",
    });
    const stored = await bookmarks.getBookmarkStore().getBookmark(key);
    expect(stored?.snapshot.clicks).toBe(2);

    restore();
    vi.doUnmock("@/data/campaigns");
  });

  it("does NOT advance bookmark when every channel post failed", async () => {
    vi.doMock("@/data/campaigns", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/data/campaigns")>();
      return {
        ...actual,
        campaigns: [
          {
            slug: "test-broken-channel",
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
                capiConversionId: null,
              },
            ],
            notifyChannels: [{ channel: "slack", target: "#ads-digest", level: "digest" }],
          },
        ],
      };
    });
    vi.resetModules();
    const fresh = await import("@/lib/ad-analytics/runtime");
    const bookmarks = await import("@/lib/ad-analytics/bookmarks");

    const adapter = fakeAdapter({
      platform: "linkedin",
      campaignId: "692134846",
      windowStart: "",
      windowEnd: "",
      impressions: 100,
      clicks: 1,
      conversions: 0,
      spendEur: 5.0,
    });
    const channel = fakeChannel("slack:not-sent"); // simulated Slack outage
    const restore = fresh._setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: channel },
    });

    await fresh.runScheduledPoll();

    const key = bookmarks.bookmarkKeyOf({
      campaignSlug: "test-broken-channel",
      platform: "linkedin",
      metric: "headline",
      window: "60m",
    });
    const stored = await bookmarks.getBookmarkStore().getBookmark(key);
    // Bookmark must NOT have advanced — otherwise we'd silently drop the
    // window the next time Slack came back.
    expect(stored).toBeNull();

    restore();
    vi.doUnmock("@/data/campaigns");
  });
});
