import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn().mockResolvedValue({
  url: "https://checkout.stripe.com/test-session",
});

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    checkout: { sessions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }),
  listStripeProducts: vi.fn().mockResolvedValue([
    {
      id: "srv-cloud",
      name: "Cloud Architecture Audit",
      description: "Test description",
      images: ["/store/cloud-audit.svg"],
      metadata: { category: "service" },
      defaultPrice: { id: "price_srv_cloud", unitAmount: 200000, currency: "eur" },
    },
    {
      id: "srv-growth",
      name: "AI Growth Engine",
      description: "Monthly subscription",
      images: ["/store/growth-engine.svg"],
      metadata: { category: "service" },
      defaultPrice: {
        id: "price_srv_growth",
        unitAmount: 80000,
        currency: "eur",
        recurring: { interval: "month", intervalCount: 1 },
      },
    },
    {
      id: "dig-cloud-playbook",
      name: "Cloud Migration Playbook",
      description: "Digital product",
      images: ["/store/migration-playbook.svg"],
      metadata: { category: "digital" },
      defaultPrice: { id: "price_dig_playbook", unitAmount: 4900, currency: "eur" },
    },
    {
      id: "phy-tshirt",
      name: "Cloudless T-Shirt",
      description: "Physical product",
      images: ["/store/tshirt.svg"],
      metadata: { category: "physical" },
      defaultPrice: { id: "price_phy_tshirt", unitAmount: 2500, currency: "eur" },
    },
  ]),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_test_123",
  }),
}));

describe("POST /api/checkout", () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ url: "https://checkout.stripe.com/test-session" });
    const mod = await import("@/app/api/checkout/route");
    POST = mod.POST;
  });

  it("returns 400 when no items are provided", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("No items in cart");
  });

  it("returns 500 for unknown product IDs", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "fake-product", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it("creates a session with valid product IDs using server-side prices", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "srv-cloud", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.url).toBe("https://checkout.stripe.com/test-session");

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.line_items[0].price_data.unit_amount).toBe(200000);
    expect(createCall.line_items[0].price_data.product_data.name).toBe("Cloud Architecture Audit");
  });

  it("ignores client-submitted price and uses catalog price", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "srv-cloud", quantity: 1, price: 1, name: "Hacked" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.line_items[0].price_data.unit_amount).toBe(200000);
    expect(createCall.line_items[0].price_data.product_data.name).toBe("Cloud Architecture Audit");
  });

  it("clamps quantity between 1 and 99", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "phy-tshirt", quantity: 500 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.line_items[0].quantity).toBe(99);
  });

  it("sets mode to subscription for recurring products", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "srv-growth", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.mode).toBe("subscription")