/**
 * Unit tests for src/lib/stripe.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
  resetSsmCache: vi.fn(),
}));

// Mock Stripe constructor — must be a real class so `new Stripe()` works
const mockCheckoutSessionsList = vi.fn();
const mockCustomersList = vi.fn();
const mockSubscriptionsList = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    checkout = { sessions: { list: mockCheckoutSessionsList } };
    customers = { list: mockCustomersList };
    subscriptions = { list: mockSubscriptionsList };
  }
  return { default: MockStripe };
});

describe("stripe.ts", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  describe("getStripe", () => {
    it("throws when STRIPE_SECRET_KEY is not set", async () => {
      mockGetConfig.mockResolvedValue({});
      const { getStripe } = await import("@/lib/stripe");
      await expect(getStripe()).rejects.toThrow(/STRIPE_SECRET_KEY is not set/);
    });

    it("returns Stripe instance when key is present", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      const { getStripe } = await import("@/lib/stripe");
      const stripe = await getStripe();
      expect(stripe).toBeDefined();
      expect(typeof stripe.checkout.sessions.list).toBe("function");
    });

    it("caches the instance (only calls constructor once)", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      const { getStripe } = await import("@/lib/stripe");
      const a = await getStripe();
      const b = await getStripe();
      expect(a).toBe(b);
    });
  });

  describe("listRecentCheckoutSessions", () => {
    it("returns mapped orders and hasMore from Stripe", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_123" });
      mockCheckoutSessionsList.mockResolvedValue({
        data: [{
          id: "cs_1",
          payment_status: "paid",
          amount_total: 4900,
          currency: "eur",
          customer_email: "a@test.com",
          customer_details: null,
          created: 1700000000,
          status: "complete",
          mode: "payment",
          line_items: { data: [{ description: "Product A", quantity: 1, amount_total: 4900 }] },
        }],
        has_more: false,
      });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const result = await listRecentCheckoutSessions(10);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe("cs_1");
      expect(result.hasMore).toBe(false);
    });

    it("throws when getStripe throws (not configured)", async () => {
      mockGetConfig.mockResolvedValue({});
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      await expect(listRecentCheckoutSessions()).rejects.toThrow(/STRIPE_SECRET_KEY/);
    });
  });

  describe("listStripeProducts", () => {
    it("returns null when not configured", async () => {
      mockGetConfig.mockResolvedValue({});
      const { listStripeProducts } = await import("@/lib/stripe");
      const products = await listStripeProducts();
      expect(products).toBeNull();
    });
  });
});
