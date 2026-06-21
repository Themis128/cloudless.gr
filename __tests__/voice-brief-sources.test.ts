/**
 * Unit tests for src/lib/voice-brief-sources.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSeoSnapshot = vi.fn();
const mockIsHubSpotConfigured = vi.fn();
const mockGetPipelineStats = vi.fn();
const mockListNewsletterSubscribers = vi.fn();
const mockGetStripe = vi.fn();

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: (...a: unknown[]) => mockGetSeoSnapshot(...a),
}));
vi.mock("@/lib/espocrm", async (orig) => ({
  ...(await orig<typeof import("@/lib/espocrm")>()),
  isHubSpotConfigured: (...a: unknown[]) => mockIsHubSpotConfigured(...a),
  getPipelineStats: (...a: unknown[]) => mockGetPipelineStats(...a),
  listNewsletterSubscribers: (...a: unknown[]) => mockListNewsletterSubscribers(...a),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: (...a: unknown[]) => mockGetStripe(...a),
}));

describe("voice-brief-sources.ts", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  describe("fetchSeoMetrics", () => {
    it("returns null when getSeoSnapshot returns null", async () => {
      mockGetSeoSnapshot.mockResolvedValue(null);
      const { fetchSeoMetrics } = await import("@/lib/voice-brief-sources");
      expect(await fetchSeoMetrics()).toBeNull();
    });

    it("maps snapshot fields correctly", async () => {
      mockGetSeoSnapshot.mockResolvedValue({ clicks: 100, impressions: 2000, ctr: 5, position: 3.5 });
      const { fetchSeoMetrics } = await import("@/lib/voice-brief-sources");
      const result = await fetchSeoMetrics();
      expect(result).toEqual({ clicks: 100, impressions: 2000, ctr: 5 });
    });
  });

  describe("fetchPipelineMetrics", () => {
    it("returns null when HubSpot not configured", async () => {
      mockIsHubSpotConfigured.mockResolvedValue(false);
      const { fetchPipelineMetrics } = await import("@/lib/voice-brief-sources");
      expect(await fetchPipelineMetrics()).toBeNull();
    });

    it("converts totalValue from cents to euros", async () => {
      mockIsHubSpotConfigured.mockResolvedValue(true);
      mockGetPipelineStats.mockResolvedValue({ totalDeals: 5, totalValue: 10000 });
      const { fetchPipelineMetrics } = await import("@/lib/voice-brief-sources");
      const result = await fetchPipelineMetrics();
      expect(result?.totalValueEuros).toBe(100);
      expect(result?.totalDeals).toBe(5);

    });
  });

  describe("fetchEmailMetrics", () => {
    it("returns null when HubSpot not configured", async () => {
      mockIsHubSpotConfigured.mockResolvedValue(false);
      const { fetchEmailMetrics } = await import("@/lib/voice-brief-sources");
      expect(await fetchEmailMetrics()).toBeNull();
    });

    it("returns subscriber count", async () => {
      mockIsHubSpotConfigured.mockResolvedValue(true);
      mockListNewsletterSubscribers.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
      const { fetchEmailMetrics } = await import("@/lib/voice-brief-sources");
      const result = await fetchEmailMetrics();
      expect(result?.totalContacts).toBe(3);
    });
  });

  describe("fetchStripeMetrics", () => {
    it("throws when getStripe throws", async () => {
      mockGetStripe.mockRejectedValue(new Error("STRIPE_SECRET_KEY is not set"));
      const { fetchStripeMetrics } = await import("@/lib/voice-brief-sources");
      await expect(fetchStripeMetrics()).rejects.toThrow("STRIPE_SECRET_KEY is not set");
    });

    it("returns metrics from paid sessions", async () => {
      const mockStripe = {
        checkout: {
          sessions: {
            list: vi.fn().mockResolvedValue({
              data: [
                { payment_status: "paid", amount_total: 5000, currency: "eur", line_items: null },
                { payment_status: "unpaid", amount_total: 1000, currency: "eur", line_items: null },
                { payment_status: "paid", amount_total: 3000, currency: "eur", line_items: null },
              ],
            }),
          },
        },
      };
      mockGetStripe.mockResolvedValue(mockStripe);
      const { fetchStripeMetrics } = await import("@/lib/voice-brief-sources");
      const result = await fetchStripeMetrics();
      expect(result?.orders).toBe(2);
      expect(result?.revenueEuros).toBeCloseTo(80, 1);
    });
  });
});
