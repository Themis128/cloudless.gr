import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn().mockResolvedValue(null),
  getTopKeywords: vi.fn().mockResolvedValue([]),
  getTopPages: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/espocrm", () => ({
  isEspoCRMConfigured: vi.fn().mockResolvedValue(false),
  getPipelineStats: vi.fn().mockResolvedValue({ totalDeals: 0, totalValue: 0, byStage: {} }),
  listDeals: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: vi.fn().mockReturnValue(false),
  getTopErrors: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockReturnValue(null),
  listRecentCheckoutSessions: vi.fn().mockResolvedValue({ hasMore: false, orders: [] }),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: vi.fn().mockReturnValue(null) }));

import { buildSeoBlocks, buildLeadsBlocks, buildErrorsBlocks } from "@/lib/slack-commands-extra";

describe("buildSeoBlocks (GSC not configured)", () => {
  it("returns a warning block array", async () => {
    const blocks = await buildSeoBlocks("user1");
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe("buildLeadsBlocks (EspoCRM not configured)", () => {
  it("returns an array of blocks", async () => {
    const blocks = await buildLeadsBlocks("user1");
    expect(Array.isArray(blocks)).toBe(true);
  });
});

describe("buildErrorsBlocks (Sentry not configured)", () => {
  it("returns an array of blocks", async () => {
    const blocks = await buildErrorsBlocks("user1");
    expect(Array.isArray(blocks)).toBe(true);
  });
});
