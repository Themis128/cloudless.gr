import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getConfig: vi.fn(),
  isGoogleAdsConfigured: vi.fn(),
  getGoogleMetrics: vi.fn(),
  isLinkedInConfigured: vi.fn(),
  getLinkedInInsights: vi.fn(),
  isTikTokConfigured: vi.fn(),
  getTikTokInsights: vi.fn(),
  isXConfigured: vi.fn(),
  getXStats: vi.fn(),
  isMetaAdsConfigured: vi.fn(),
  getMetaInsights: vi.fn(),
  listContacts: vi.fn(),
  isConfiguredAsync: vi.fn(),
  getStripeAnalyticsSnapshot: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/lib/campaigns/google-ads", () => ({
  isGoogleAdsConfigured: m.isGoogleAdsConfigured,
  getGoogleMetrics: m.getGoogleMetrics,
}));
vi.mock("@/lib/campaigns/linkedin", () => ({
  isLinkedInConfigured: m.isLinkedInConfigured,
  getLinkedInInsights: m.getLinkedInInsights,
}));
vi.mock("@/lib/campaigns/tiktok", () => ({
  isTikTokConfigured: m.isTikTokConfigured,
  getTikTokInsights: m.getTikTokInsights,
}));
vi.mock("@/lib/campaigns/x-ads", () => ({
  isXConfigured: m.isXConfigured,
  getXStats: m.getXStats,
}));
vi.mock("@/lib/campaigns/meta-ads", () => ({
  isMetaAdsConfigured: m.isMetaAdsConfigured,
  getMetaInsights: m.getMetaInsights,
}));
vi.mock("@/lib/espocrm", () => ({ listContacts: m.listContacts }));
vi.mock("@/lib/integrations", () => ({ isConfiguredAsync: m.isConfiguredAsync }));
vi.mock("@/lib/stripe-analytics-read", () => ({
  getStripeAnalyticsSnapshot: m.getStripeAnalyticsSnapshot,
}));

import { getGeminiApiKey, isGeminiConfigured, verifyGeminiKey, callGemini } from "@/lib/gemini-admin";
import { buildRoiSummary } from "@/lib/roi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  m.getConfig.mockResolvedValue({});
});

describe("gemini-admin", () => {
  it("loads the key from config", async () => {
    expect(await getGeminiApiKey()).toBeNull();
    expect(await isGeminiConfigured()).toBe(false);
    m.getConfig.mockResolvedValue({ GEMINI_API_KEY: "gkey" });
    expect(await getGeminiApiKey()).toBe("gkey");
    expect(await isGeminiConfigured()).toBe(true);
  });

  it("verifyGeminiKey reports all four statuses", async () => {
    expect(await verifyGeminiKey()).toEqual({ status: "not_configured" });
    m.getConfig.mockResolvedValue({ GEMINI_API_KEY: "gkey" });

    mockFetch.mockResolvedValueOnce(new Response("x", { status: 200 }));
    expect(await verifyGeminiKey()).toEqual({ status: "valid" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("gemini-2.5-flash:generateContent?key=gkey");
    expect(JSON.parse(init.body).generationConfig.maxOutputTokens).toBe(1);

    for (const status of [401, 403]) {
      mockFetch.mockResolvedValueOnce(new Response("x", { status }));
      expect((await verifyGeminiKey()).status).toBe("rejected");
    }
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await verifyGeminiKey()).toEqual({ status: "error", message: "API returned 500" });
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await verifyGeminiKey()).toEqual({ status: "error", message: "Connection failed." });
  });

  it("callGemini posts the prompt and unwraps the candidate text", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "answer" }] } }] }))
    );
    expect(await callGemini("hello", "k", 500)).toBe("answer");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toBe("hello");
    expect(body.generationConfig.maxOutputTokens).toBe(500);

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({})));
    expect(await callGemini("q", "k")).toBe("");

    mockFetch.mockResolvedValueOnce(new Response("bad", { status: 429 }));
    await expect(callGemini("q", "k")).rejects.toThrow("Gemini API error 429");
  });
});

describe("buildRoiSummary", () => {
  function allConfigured() {
    m.isGoogleAdsConfigured.mockResolvedValue(true);
    m.isLinkedInConfigured.mockResolvedValue(true);
    m.isTikTokConfigured.mockResolvedValue(true);
    m.isXConfigured.mockResolvedValue(true);
    m.isMetaAdsConfigured.mockResolvedValue(true);
  }

  it("aggregates every channel + leads + revenue", async () => {
    allConfigured();
    m.getGoogleMetrics.mockResolvedValue({ costMicros: 1_000_000, impressions: 100, clicks: 5 });
    m.getLinkedInInsights.mockResolvedValue({
      costInLocalCurrency: "20.00",
      impressions: 50,
      clicks: 3,
      conversions: 2,
    });
    m.getTikTokInsights.mockResolvedValue({ spend: "10.50", impressions: "200", clicks: "7" });
    m.getXStats.mockResolvedValue({ spend_micro: 500_000, impressions: 10, clicks: 1 });
    m.getMetaInsights.mockResolvedValue({ spend: 30, impressions: 90, clicks: 4, leads: 1 });
    m.isConfiguredAsync.mockResolvedValue(true);
    const recent = new Date().toISOString();
    m.listContacts.mockResolvedValue([
      { properties: { createdate: recent } },
      { properties: { createdate: "2020-01-01" } },
      { properties: {} },
    ]);
    m.getStripeAnalyticsSnapshot.mockResolvedValue({ totals: { revenueMinor: 99_900 } });

    const out = await buildRoiSummary(30);
    expect(out.channels).toHaveLength(5);
    const g = out.channels.find((c) => c.channel === "google")!;
    expect(g.spendCents).toBe(100); // 1e6 micros → 100 cents
    const li = out.channels.find((c) => c.channel === "linkedin")!;
    expect(li.spendCents).toBe(2000);
    expect(li.platformLeads).toBe(2);
    const tt = out.channels.find((c) => c.channel === "tiktok")!;
    expect(tt).toMatchObject({ spendCents: 1050, impressions: 200, clicks: 7 });
    const x = out.channels.find((c) => c.channel === "x")!;
    expect(x.spendCents).toBe(50);
    const meta = out.channels.find((c) => c.channel === "meta")!;
    expect(meta).toMatchObject({ spendCents: 3000, platformLeads: 1 });

    expect(out.totals.spendCents).toBe(100 + 2000 + 1050 + 50 + 3000);
    expect(out.totals.newLeads).toBe(1);
    expect(out.totals.revenueCents).toBe(99_900);
    expect(out.totals.costPerLeadCents).toBe(6200);
    expect(out.totals.roas).toBeCloseTo(16.11, 2);
    expect(out.totals.platformLeads).toBe(3);
  });

  it("reports unconfigured channels as zeroed and null leads/revenue", async () => {
    m.isGoogleAdsConfigured.mockResolvedValue(false);
    m.isLinkedInConfigured.mockResolvedValue(false);
    m.isTikTokConfigured.mockResolvedValue(false);
    m.isXConfigured.mockResolvedValue(false);
    m.isMetaAdsConfigured.mockResolvedValue(false);
    m.isConfiguredAsync.mockResolvedValue(false);
    m.getStripeAnalyticsSnapshot.mockRejectedValue(new Error("stripe down"));

    const out = await buildRoiSummary(0); // falsy → default 30 days
    expect(out.windowDays).toBe(30);
    expect(out.totals).toMatchObject({
      spendCents: 0,
      newLeads: null,
      revenueCents: null,
      costPerLeadCents: null,
      roas: null,
    });
    expect(out.channels.every((c) => !c.configured)).toBe(true);
  });

  it("tolerates per-channel throws and listContacts failure", async () => {
    allConfigured();
    m.getGoogleMetrics.mockRejectedValue(new Error("google down"));
    m.getLinkedInInsights.mockResolvedValue({
      costInLocalCurrency: "5",
      impressions: 1,
      clicks: 1,
      conversions: 0,
    });
    m.getTikTokInsights.mockResolvedValue({ spend: "0", impressions: "x", clicks: "y" });
    m.getXStats.mockResolvedValue({ spend_micro: 0, impressions: 0, clicks: 0 });
    m.getMetaInsights.mockResolvedValue({ spend: 0, impressions: 0, clicks: 0, leads: 0 });
    m.isConfiguredAsync.mockResolvedValue(true);
    m.listContacts.mockRejectedValue(new Error("espo down"));
    m.getStripeAnalyticsSnapshot.mockResolvedValue({ totals: { revenueMinor: 0 } });

    const out = await buildRoiSummary(45);
    expect(out.channels.find((c) => c.channel === "google")!.configured).toBe(false);
    expect(out.totals.newLeads).toBeNull();
    const tt = out.channels.find((c) => c.channel === "tiktok")!;
    expect(tt.impressions).toBe(0); // "x" parses to NaN → 0
    expect(out.windowDays).toBe(45);
  });
});
