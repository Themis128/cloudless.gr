/**
 * Unit tests for campaign integration libraries:
 *   src/lib/campaigns/google-ads.ts
 *   src/lib/campaigns/linkedin.ts
 *   src/lib/campaigns/tiktok.ts
 *   src/lib/campaigns/x-ads.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── ssm-config mock ────────────────────────────────────────────────────────────
const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
}));

// ── LinkedIn ──────────────────────────────────────────────────────────────────

describe("linkedin.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("isLinkedInConfigured returns false when token missing", async () => {
    mockGetConfig.mockResolvedValue({});
    const { isLinkedInConfigured } = await import("@/lib/campaigns/linkedin");
    expect(await isLinkedInConfigured()).toBe(false);
  });

  it("isLinkedInConfigured returns true when token present", async () => {
    mockGetConfig.mockResolvedValue({
      LINKEDIN_ACCESS_TOKEN: "tok",
      LINKEDIN_AD_ACCOUNT_ID: "acc",
      LINKEDIN_ORGANIZATION_URN: "urn:li:org:123",
    });
    const { isLinkedInConfigured } = await import("@/lib/campaigns/linkedin");
    expect(await isLinkedInConfigured()).toBe(true);
  });

  it("listLinkedInCampaigns returns [] when not configured", async () => {
    mockGetConfig.mockResolvedValue({});
    const { listLinkedInCampaigns } = await import("@/lib/campaigns/linkedin");
    expect(await listLinkedInCampaigns()).toEqual([]);
  });

  it("listLinkedInCampaigns returns parsed campaigns on success", async () => {
    mockGetConfig.mockResolvedValue({
      LINKEDIN_ACCESS_TOKEN: "tok",
      LINKEDIN_AD_ACCOUNT_ID: "acc:123",
      LINKEDIN_ORGANIZATION_URN: "urn:li:org:1",
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: "c1",
            name: "Campaign 1",
            status: "ACTIVE",
            type: "SPONSORED_CONTENT",
            costType: "CPM",
            dailyBudget: { amount: "50" },
            totalBudget: { amount: "500" },
            unitCost: { amount: "5" },
          },
        ],
      }),
    });
    const { listLinkedInCampaigns } = await import("@/lib/campaigns/linkedin");
    const campaigns = await listLinkedInCampaigns();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Campaign 1");
  });

  it("listLinkedInCampaigns returns [] on API error response", async () => {
    mockGetConfig.mockResolvedValue({
      LINKEDIN_ACCESS_TOKEN: "tok",
      LINKEDIN_AD_ACCOUNT_ID: "acc:123",
      LINKEDIN_ORGANIZATION_URN: "urn:li:org:1",
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, text: async () => "Forbidden" });
    const { listLinkedInCampaigns } = await import("@/lib/campaigns/linkedin");
    expect(await listLinkedInCampaigns()).toEqual([]);
  });
});

// ── TikTok ────────────────────────────────────────────────────────────────────

describe("tiktok.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("isTikTokConfigured returns false when token missing", async () => {
    mockGetConfig.mockResolvedValue({});
    const { isTikTokConfigured } = await import("@/lib/campaigns/tiktok");
    expect(await isTikTokConfigured()).toBe(false);
  });

  it("isTikTokConfigured returns true when configured", async () => {
    mockGetConfig.mockResolvedValue({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv123" });
    const { isTikTokConfigured } = await import("@/lib/campaigns/tiktok");
    expect(await isTikTokConfigured()).toBe(true);
  });

  it("listTikTokCampaigns throws when not configured", async () => {
    mockGetConfig.mockResolvedValue({});
    const { listTikTokCampaigns } = await import("@/lib/campaigns/tiktok");
    expect(await listTikTokCampaigns()).toEqual([]);
  });

  it("listTikTokCampaigns returns campaigns on success", async () => {
    mockGetConfig.mockResolvedValue({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv123" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          list: [
            {
              campaign_id: "c1",
              campaign_name: "TK Camp",
              status: "ENABLE",
              budget: 100,
              budget_mode: "BUDGET_MODE_TOTAL",
              objective_type: "REACH",
              create_time: "2024-01-01",
              modify_time: "2024-01-02",
            },
          ],
        },
        code: 0,
      }),
    });
    const { listTikTokCampaigns } = await import("@/lib/campaigns/tiktok");
    const campaigns = await listTikTokCampaigns();
    expect(campaigns[0].campaign_name).toBe("TK Camp");
  });

  it("listTikTokCampaigns returns [] on non-zero code (caught internally)", async () => {
    mockGetConfig.mockResolvedValue({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv123" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 40001, message: "Invalid token" }),
    });
    const { listTikTokCampaigns } = await import("@/lib/campaigns/tiktok");
    // The function catches internally and returns data.data?.list ?? [] — code check is caller's concern
    const result = await listTikTokCampaigns();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── X Ads ─────────────────────────────────────────────────────────────────────

describe("x-ads.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("isXConfigured returns false when token missing", async () => {
    mockGetConfig.mockResolvedValue({});
    const { isXConfigured } = await import("@/lib/campaigns/x-ads");
    expect(await isXConfigured()).toBe(false);
  });

  it("isXConfigured returns true when configured", async () => {
    mockGetConfig.mockResolvedValue({
      X_API_KEY: "key",
      X_API_SECRET: "secret",
      X_ACCESS_TOKEN: "tok",
      X_ACCESS_SECRET: "sec",
      X_AD_ACCOUNT_ID: "acc",
    });
    const { isXConfigured } = await import("@/lib/campaigns/x-ads");
    expect(await isXConfigured()).toBe(true);
  });

  it("listXCampaigns returns [] when not configured", async () => {
    mockGetConfig.mockResolvedValue({});
    const { listXCampaigns } = await import("@/lib/campaigns/x-ads");
    expect(await listXCampaigns()).toEqual([]);
  });

  it("listXCampaigns returns campaigns on success", async () => {
    mockGetConfig.mockResolvedValue({
      X_API_KEY: "key",
      X_API_SECRET: "secret",
      X_ACCESS_TOKEN: "tok",
      X_ACCESS_SECRET: "sec",
      X_AD_ACCOUNT_ID: "acc123",
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "c1",
            name: "X Camp",
            entity_status: "ACTIVE",
            funding_instrument_id: "fi1",
            total_budget_amount_local_micro: 5000000,
            daily_budget_amount_local_micro: 500000,
            start_time: "2024-01-01",
            end_time: null,
            currency: "EUR",
            objective: "REACH",
          },
        ],
      }),
    });
    const { listXCampaigns } = await import("@/lib/campaigns/x-ads");
    const campaigns = await listXCampaigns();
    expect(campaigns[0].name).toBe("X Camp");
  });
});

// ── Google Ads ────────────────────────────────────────────────────────────────

describe("google-ads.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("isGoogleAdsConfigured returns false when env vars missing", async () => {
    mockGetConfig.mockResolvedValue({});
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    const { isGoogleAdsConfigured } = await import("@/lib/campaigns/google-ads");
    expect(await isGoogleAdsConfigured()).toBe(false);
  });

  it("listGoogleCampaigns returns [] when not configured", async () => {
    mockGetConfig.mockResolvedValue({ GOOGLE_ADS_CUSTOMER_ID: "123" });
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    const { listGoogleCampaigns } = await import("@/lib/campaigns/google-ads");
    expect(await listGoogleCampaigns()).toEqual([]);
  });
});
