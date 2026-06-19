// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { dispatchConversion, _setRegistries } from "@/lib/ad-analytics/runtime";
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
    pushConversion: vi
      .fn()
      .mockResolvedValue({ accepted: true, status: 200 }),
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

  it("skips the CAPI mirror when capiConversionId is null (degrades cleanly)", async () => {
    // shop-online currently ships with capiConversionId: null because the
    // operator hasn't yet minted the CONVERSIONS_API-typed conversion. The
    // runtime must NOT call pushConversion in that case — otherwise we'd
    // generate a 403 on every conversion. This test is the regression guard.
    const adapter = fakeAdapter();
    const channel = fakeChannel();
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: { slack: channel } });

    const outcome = await dispatchConversion({
      campaign: "shop-online",
      tier: "starter",
      orderId: "cs_test_xyz",
      conversionId: 26846068,
    });

    expect(adapter.pushConversion).not.toHaveBeenCalled();
    expect(outcome.capi).toEqual([]);
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
    expect(outcome.capi).toEqual([{ platform: "linkedin", accepted: true, status: 200, message: undefined }]);

    innerRestore();
    vi.doUnmock("@/data/campaigns");
  });
});
