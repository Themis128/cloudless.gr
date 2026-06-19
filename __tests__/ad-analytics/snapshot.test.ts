// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runAdHocSnapshot, _setRegistries } from "@/lib/ad-analytics/runtime";
import type { AdMetrics } from "@/lib/ad-analytics/types";
import type { AdPlatformAdapter } from "@/lib/ad-analytics/adapters/ad-platform";

let restore: (() => void) | null = null;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (restore) restore();
  restore = null;
});

function fakeAdapter(rows: AdMetrics[]): AdPlatformAdapter {
  return {
    id: "linkedin",
    isConfigured: vi.fn().mockResolvedValue(true),
    pullMetrics: vi.fn().mockResolvedValue(rows),
    pushConversion: vi.fn().mockResolvedValue({ accepted: true, status: 200 }),
  };
}

describe("runAdHocSnapshot", () => {
  it("returns null when the campaign slug is unknown", async () => {
    restore = _setRegistries({
      adapters: { linkedin: fakeAdapter([]) },
      channels: {},
    });
    const out = await runAdHocSnapshot({ campaignSlug: "no-such-campaign" });
    expect(out).toBeNull();
  });

  it("returns the platform's metrics rows for shop-online", async () => {
    const rows: AdMetrics[] = [
      {
        platform: "linkedin",
        campaignId: "692134846",
        windowStart: "2026-06-19T08:00:00.000Z",
        windowEnd: "2026-06-19T09:00:00.000Z",
        impressions: 386,
        clicks: 2,
        conversions: 0,
        spendEur: 15.57,
        ctr: 0.0052,
        cpcEur: 7.785,
      },
    ];
    const adapter = fakeAdapter(rows);
    restore = _setRegistries({ adapters: { linkedin: adapter }, channels: {} });

    const out = await runAdHocSnapshot({ campaignSlug: "shop-online" });

    expect(out).not.toBeNull();
    expect(out?.campaign).toBe("shop-online");
    expect(out?.metrics).toHaveLength(1);
    expect(out?.metrics[0].impressions).toBe(386);
    // adapter was called with the configured account + campaign IDs
    const calledWith = (adapter.pullMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledWith.accountId).toBe("512642510");
    expect(calledWith.campaignIds).toEqual(["857622786"]);
    expect(calledWith.pivots).toContain("MEMBER_INDUSTRY");
  });

  it("does NOT advance any bookmark or post any Slack message", async () => {
    const adapter = fakeAdapter([
      {
        platform: "linkedin",
        campaignId: "692134846",
        windowStart: "",
        windowEnd: "",
        impressions: 100,
        clicks: 1,
        conversions: 0,
        spendEur: 5,
      },
    ]);
    const channel = {
      id: "slack" as const,
      isConfigured: vi.fn().mockResolvedValue(true),
      sendBlock: vi.fn().mockResolvedValue({ messageId: "slack:#ads-realtime:1" }),
      reply: vi.fn().mockResolvedValue(undefined),
    };
    restore = _setRegistries({
      adapters: { linkedin: adapter },
      channels: { slack: channel },
    });

    await runAdHocSnapshot({ campaignSlug: "shop-online" });

    // The on-demand snapshot is read-only — neither the bookmark nor any
    // notification channel should be touched.
    expect(channel.sendBlock).not.toHaveBeenCalled();
  });
});
