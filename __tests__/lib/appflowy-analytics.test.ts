import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  getWorkspaceFolder: vi.fn().mockResolvedValue(null),
  createPage: vi.fn().mockResolvedValue(null),
  appendBlockToPage: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { trackEvent, getAnalyticsSummary, createWeeklyRollup } from "@/lib/appflowy-analytics";

describe("appflowy-analytics (not configured)", () => {
  it("trackEvent returns true (no-op) when AppFlowy is not configured", async () => {
    expect(
      await trackEvent({ type: "page_view", userId: "u1", properties: {} })
    ).toBe(true);
  });

  it("getAnalyticsSummary returns zeroed summary", async () => {
    const result = await getAnalyticsSummary();
    expect(typeof result.totalEvents).toBe("number");
    expect(result.totalEvents).toBe(0);
  });

  it("createWeeklyRollup returns true (no-op) when not configured", async () => {
    expect(await createWeeklyRollup()).toBe(true);
  });
});
