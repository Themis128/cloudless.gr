import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSessionsList, mockProductsList, mockGetConfig } = vi.hoisted(() => ({
  mockSessionsList: vi.fn(),
  mockProductsList: vi.fn(),
  mockGetConfig: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: { sessions: { list: mockSessionsList } },
      products: { list: mockProductsList },
    };
  }),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
}));

describe("stripe", () => {
  beforeEach(() => {
    mockSessionsList.mockReset();
    mockProductsList.mockReset();
    mockGetConfig.mockReset();
    vi.resetModules();
  });

  describe("getStripe", () => {
    it("returns null when STRIPE_SECRET_KEY is not configured", async () => {
      mockGetConfig.mockResolvedValueOnce({});
      const { getStripe } = await import("@/lib/stripe");
      expect(await getStripe()).toBeNull();
    });

    it("returns a Stripe instance when the key is configured", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_test_x" });
      const { getStripe } = await import("@/lib/stripe");
      const s = await getStripe();
      expect(s).not.toBeNull();
    });

    it("caches the instance across calls (singleton)", async () => {
      mockGetConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk_test_x" });
      const { getStripe } = await import("@/lib/stripe");
      const a = await getStripe();
      const b = await getStripe();
      expect(a).toBe(b);
      // getConfig only consulted once because of the cache.
      expect(mockGetConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe("listRecentCheckoutSessions", () => {
    it("returns empty list + hasMore=false when Stripe is not configured", async () => {
      mockGetConfig.mockResolvedValueOnce({});
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const r = await listRecentCheckoutSessions(5);
      expect(r).toEqual({ orders: [], hasMore: false });
    });

    it("maps Stripe sessions to the RecentOrder shape", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockSessionsList.mockResolvedValueOnce({
        data: [
          {
            id: "cs_1",
            customer_email: "alice@example.com",
            customer_details: { email: "alice@example.com" },
            amount_total: 12500,
            currency: "eur",
            status: "complete",
            created: 1_700_000_000,
            payment_status: "paid",
            mode: "payment",
          },
        ],
        has_more: false,
      });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const r = await listRecentCheckoutSessions(10);
      expect(r.orders).toHaveLength(1);
      expect(r.orders[0]).toMatchObject({
        id: "cs_1",
        email: "alice@example.com",
        amount: 12500,
        currency: "EUR",
        status: "complete",
        paymentStatus: "paid",
        mode: "payment",
      });
    });

    it("falls back to customer_details.email when customer_email is missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockSessionsList.mockResolvedValueOnce({
        data: [
          {
            id: "cs_2",
            customer_email: null,
            customer_details: { email: "bob@example.com" },
            amount_total: 100,
            currency: "usd",
            status: "complete",
            created: 1_700_000_000,
            payment_status: "paid",
            mode: "payment",
          },
        ],
        has_more: false,
      });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const r = await listRecentCheckoutSessions(10);
      expect(r.orders[0].email).toBe("bob@example.com");
      expect(r.orders[0].currency).toBe("USD");
    });

    it("returns null email when neither field is present", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockSessionsList.mockResolvedValueOnce({
        data: [
          {
            id: "cs_3",
            customer_email: null,
            customer_details: {},
            amount_total: 0,
            currency: null,
            status: null,
            created: 0,
            payment_status: "unpaid",
            mode: null,
          },
        ],
        has_more: true,
      });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      const r = await listRecentCheckoutSessions(10);
      expect(r.orders[0].email).toBeNull();
      expect(r.orders[0].currency).toBe("EUR");
      expect(r.orders[0].status).toBe("unknown");
      expect(r.orders[0].mode).toBe("payment");
      expect(r.hasMore).toBe(true);
    });

    it("passes through the requested limit", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockSessionsList.mockResolvedValueOnce({ data: [], has_more: false });
      const { listRecentCheckoutSessions } = await import("@/lib/stripe");
      await listRecentCheckoutSessions(7);
      expect(mockSessionsList).toHaveBeenCalledWith({
        limit: 7,
        expand: ["data.line_items"],
      });
    });
  });

  describe("listStripeProducts", () => {
    it("returns null when Stripe is not configured", async () => {
      mockGetConfig.mockResolvedValueOnce({});
      const { listStripeProducts } = await import("@/lib/stripe");
      expect(await listStripeProducts()).toBeNull();
    });

    it("maps products with default prices", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockProductsList.mockResolvedValueOnce({
        data: [
          {
            id: "prod_1",
            name: "Course",
            description: "Cloud course",
            active: true,
            images: ["https://x/img.png"],
            metadata: { tier: "pro" },
            default_price: {
              id: "price_1",
              unit_amount: 9900,
              currency: "eur",
              recurring: null,
            },
          },
        ],
      });
      const { listStripeProducts } = await import("@/lib/stripe");
      const r = await listStripeProducts();
      expect(r).toHaveLength(1);
      expect(r?.[0]).toMatchObject({
        id: "prod_1",
        name: "Course",
        defaultPrice: { id: "price_1", unitAmount: 9900, currency: "EUR", recurring: null },
      });
    });

    it("returns null when products API throws", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockProductsList.mockRejectedValueOnce(new Error("Stripe down"));
      const { listStripeProducts } = await import("@/lib/stripe");
      expect(await listStripeProducts()).toBeNull();
    });

    it("handles missing default_price", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockProductsList.mockResolvedValueOnce({
        data: [
          {
            id: "prod_2",
            name: "X",
            description: null,
            active: true,
            images: [],
            metadata: {},
            default_price: null,
          },
        ],
      });
      const { listStripeProducts } = await import("@/lib/stripe");
      const r = await listStripeProducts();
      expect(r?.[0].defaultPrice).toBeNull();
    });

    it("includes recurring metadata when present", async () => {
      mockGetConfig.mockResolvedValueOnce({ STRIPE_SECRET_KEY: "sk_x" });
      mockProductsList.mockResolvedValueOnce({
        data: [
          {
            id: "prod_sub",
            name: "Subscription",
            description: null,
            active: true,
            images: [],
            metadata: {},
            default_price: {
              id: "price_sub",
              unit_amount: 1000,
              currency: "eur",
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      });
      const { listStripeProducts } = await import("@/lib/stripe");
      const r = await listStripeProducts();
      expect(r?.[0].defaultPrice?.recurring).toEqual({
        interval: "month",
        intervalCount: 1,
      });
    });
  });

  describe("formatPrice re-export", () => {
    it("is re-exported from @/lib/stripe", async () => {
      const mod = await import("@/lib/stripe");
      expect(typeof mod.formatPrice).toBe("function");
    });
  });
});
