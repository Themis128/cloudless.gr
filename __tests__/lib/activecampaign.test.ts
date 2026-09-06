import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ ACTIVECAMPAIGN_BASE_URL: "", ACTIVECAMPAIGN_API_KEY: "" });

import { isActiveCampaignConfigured } from "@/lib/activecampaign";

describe("isActiveCampaignConfigured", () => {
  it("returns false when ACTIVECAMPAIGN credentials are not configured", async () => {
    expect(await isActiveCampaignConfigured()).toBe(false);
  });
});
