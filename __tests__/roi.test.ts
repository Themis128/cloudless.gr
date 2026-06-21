import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGoogleConfigured,
  mockGoogleMetrics,
  mockLinkedInConfigured,
  mockLinkedInInsights,
  mockTikTokConfigured,
  mockTikTokInsights,
  mockXConfigured,
  mockXStats,
  mockMetaConfigured,
  mockMetaInsights,
  mockListContacts,
  mockIsConfiguredAsync,
  mockStripeSnapshot,
} = vi.hoisted(() => ({
  mockGoogleConfigured: vi.fn(),
  mockGoogleMetrics: vi.fn(),
  mockLinkedInConfigured: vi.fn(),
  mockLinkedInInsights: vi.fn(),
  mockTikTokConfigured: vi.fn(),
  mockTikTokInsights: vi.fn(),
  mockXConfigured: vi.fn(),
  mockXStats: vi.fn(),
  mockMetaConfigured: vi.fn(),
  mockMetaInsights: vi.fn(),
  mockListContacts: vi.fn(),
  mockIsConfiguredAsync: vi.fn(),
  mockStripeSnapshot: vi.fn(),
}));

vi.mock("@/lib/campaigns/google-ads", () => ({
  isGoogleAdsConfigured: mockGoogleConfigured,
  getGoogleMetrics: mockGoogleMetrics,
}));
vi.mock("@/lib/campaigns/linkedin", () => ({
  isLinkedInConfigured: mockLinkedInConfigured,
  getLinkedInInsights: mockLinkedInInsights,
}));
vi.mock("@/lib/campaigns/tiktok", () => ({
  isTikTokConfigured: mockTikTokConfigured,
  getTikTokInsights: mockTikTokInsights,
}));
vi.mock("@/lib/campaigns/x-ads", () => ({
  isXConfigured: mockXConfigured,
  getXStats: mockXStats,
}));
vi.mock("@/lib/campaigns/meta-ads", () => ({
  isMetaAdsConfigured: mockMetaConfigured,
  getMetaInsights: mockMetaInsights,
}));
vi.mock("@/lib/espocrm", () => ({ listContacts: mockListContacts }));
vi.mock("@/lib/integrations", () => ({ isConfiguredAsync: mockIsConfiguredAsync }));
vi.mock("@/lib/stripe-analytics-read", () => ({
  getStripeAnalyticsSnapshot: mockStripeSnapshot,
}));

import {
  microsToCents,
  currencyStringToCents,
  unitsToCents,
  computeCostPerLeadCents,
  computeRoas,
  buildRoiSummary,
} from "@/lib/roi";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: nothing configured.
  mockGoogleConfigured.mockResolvedValue(false);
  mockLinkedInConfigured.mockResolvedValue(false);
  mockTikTokConfigured.mockResolvedValue(false);
  mockXConfigured.mockResolvedValue(false);
  mockMetaConfigured.mockResolvedValue(false);
  mockIsConfiguredAsync.mockResolvedValue(false);
  mockStripeSnapshot.mockRejectedValue(new Error("no dynamo"));
});

describe("normalizers", () => {
  it("converts micros to cents", () => {
    expect(microsToCents(12_340_000)).toBe(1234); // 12.34 units
    expect(microsToCents(0)).toBe(0);
    expect(microsToCents(Number.NaN)).toBe(0);
  });

  it("converts currency strings to cents", () => {
    expect(currencyStringToCents("12.34")).toBe(1234);
    expect(currencyStringToCents("0")).toBe(0);
    expect(currencyStringToCents("nope")).toBe(0);
    expect(currencyStringToCents(undefined)).toBe(0);
  });

  it("converts numeric units to cents", () => {
    expect(unitsToCents(90.12)).toBe(9012);
    expect(unitsToCents(-1)).toBe(0);
  });

  it("computes cost per lead only with both sides present", () => {
    expect(computeCostPerLeadCents(10_000, 4)).toBe(2500);
    expect(computeCostPerLeadCents(10_000, 0)).toBeNull();
    expect(computeCostPerLeadCents(10_000, null)).toBeNull();
    expect(computeCostPerLeadCents(0, 5)).toBeNull();
  });

  it("computes ROAS rounded to 2 decimals", () => {
    expect(computeRoas(10_000, 35_000)).toBe(3.5);
    expect(computeRoas(0, 35_000)).toBeNull();
    expect(computeRoas(10_000, null)).toBeNull();
  });
});

describe("buildRoiSummary", () => {
  it("returns a zeroed summary when nothing is configured", async () => {
    const summary = await buildRoiSummary(30);
    expect(summary.windowDays).toBe(30);
    expect(summary.channels).toHaveLength(5);
    expect(summary.channels.every((c) => !c.configured)).toBe(true);
    expect(summary.totals).toMatchObject({
      spendCents: 0,
      newLeads: null,
      revenueCents: null,
      costPerLeadCents: null,
      roas: null,
    });
  });

  it("aggregates spend across configured channels with correct unit conversion", async () => {
    mockGoogleConfigured.mockResolvedValue(true);
    mockGoogleMetrics.mockResolvedValue({ impressions: 100, clicks: 10, costMicros: 50_000_000 }); // €50
    mockMetaConfigured.mockResolvedValue(true);
    mockMetaInsights.mockResolvedValue({
      impressions: 200,
      clicks: 20,
      spend: 25.5, // €25.50
      leads: 3,
      ctr: 1,
    });
    const summary = await buildRoiSummary(30);
    expect(summary.totals.spendCents).toBe(5000 + 2550);
    expect(summary.totals.impressions).toBe(300);
    expect(summary.totals.clicks).toBe(30);
    expect(summary.totals.platformLeads).toBe(3);
  });

  it("counts HubSpot leads inside the window and computes cost per lead", async () => {
    mockGoogleConfigured.mockResolvedValue(true);
    mockGoogleMetrics.mockResolvedValue({ impressions: 0, clicks: 0, costMicros: 100_000_000 }); // €100
    mockIsConfiguredAsync.mockResolvedValue(true);
    const recent = new Date(Date.now() - 86_400_000).toISOString();
    const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
    mockListContacts.mockResolvedValue([
      { properties: { createdate: recent } },
      { properties: { createdate: recent } },
      { properties: { createdate: old } },
      { properties: {} },
    ]);
    const summary = await buildRoiSummary(30);
    expect(summary.totals.newLeads).toBe(2);
    expect(summary.totals.costPerLeadCents).toBe(5000); // €100 / 2
  });

  it("includes Stripe revenue and ROAS when available", async () => {
    mockGoogleConfigured.mockResolvedValue(true);
    mockGoogleMetrics.mockResolvedValue({ impressions: 0, clicks: 0, costMicros: 100_000_000 });
    mockStripeSnapshot.mockResolvedValue({ totals: { revenueMinor: 40_000 } });
    const summary = await buildRoiSummary(30);
    expect(summary.totals.revenueCents).toBe(40_000);
    expect(summary.totals.roas).toBe(4);
  });

  it("survives a single channel collector throwing", async () => {
    mockGoogleConfigured.mockResolvedValue(true);
    mockGoogleMetrics.mockRejectedValue(new Error("google down"));
    mockMetaConfigured.mockResolvedValue(true);
    mockMetaInsights.mockResolvedValue({ impressions: 1, clicks: 1, spend: 1, leads: 0, ctr: 0 });
    const summary = await buildRoiSummary(30);
    const google = summary.channels.find((c) => c.channel === "google");
    expect(google?.spendCents).toBe(0);
    expect(summary.totals.spendCents).toBe(100);
  });

  it("clamps the window to 1–365 days", async () => {
    expect((await buildRoiSummary(0)).windowDays).toBe(30);
    expect((await buildRoiSummary(9999)).windowDays).toBe(365);
    expect((await buildRoiSummary(-5)).windowDays).toBe(1);
  });
});
