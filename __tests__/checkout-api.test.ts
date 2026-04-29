import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn().mockResolvedValue({
  url: "https://checkout.stripe.com/test-session",
});

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    checkout: { sessions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }),
}));

// Mock api-auth so we can test both authenticated and anonymous checkouts
vi.mock("@/lib/api-auth", () => ({
  getTokenFromHeader: vi.fn(() => null),
  verifyToken: vi.fn(() => Promise.resolve(null)),
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

    // Verify server-side price was used (Cloud Architecture Audit = 200000 cents)
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.line_items[0].price_data.unit_amount).toBe(200000);
    expect(createCall.line_items[0].price_data.product_data.name).toBe(
      "Cloud Architecture Audit"
    );
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
    expect(createCall.line_items[0].price_data.product_data.name).toBe(
      "Cloud Architecture Audit"
    );
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
    expect(createCall.mode).toBe("subscription");
  });

  it("requests shipping for physical products", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "phy-tshirt", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.shipping_address_collection).toBeDefined();
    expect(createCall.shipping_address_collection.allowed_countries).toContain("GR");
  });

  it("skips shipping for digital products", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "dig-cloud-playbook", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.shipping_address_collection).toBeUndefined();
  });

  it("always includes source metadata", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.metadata?.source).toBe("cloudless.gr");
  });

  it("pre-fills customer_email and includes userId in metadata when user is authenticated", async () => {
    const { getTokenFromHeader, verifyToken } = await import("@/lib/api-auth");
    vi.mocked(getTokenFromHeader).mockReturnValueOnce("fake-token");
    vi.mocked(verifyToken).mockResolvedValueOnce({
      sub: "user-123",
      email: "auth@cloudless.gr",
      aud: "test-client",
      iss: "https://cognito.example.com",
      iat: 0,
      exp: 9999999999,
      token_use: "id",
    });

    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.customer_email).toBe("auth@cloudless.gr");
    expect(createCall.metadata?.userId).toBe("user-123");
    expect(createCall.metadata?.source).toBe("cloudless.gr");
  });
});
