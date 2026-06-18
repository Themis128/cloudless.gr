// @vitest-environment node
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

// ---------------------------------------------------------------------------
// GET /api/checkout — campaign tier flow (paid + fit-call)
// ---------------------------------------------------------------------------

describe("GET /api/checkout (campaign tier)", () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ url: "https://checkout.stripe.com/campaign-session" });
    const mod = await import("@/app/api/checkout/route");
    GET = mod.GET;
  });

  it("redirects fit-call to /contact with topic + campaign + UTM forwarded", async () => {
    const url =
      "http://localhost/api/checkout?campaign=shop-online&tier=fit-call" +
      "&utm_source=linkedin&utm_medium=cpc&utm_campaign=shop_online_founding&utm_content=A_EN";
    const request = new NextRequest(url, {
      method: "GET",
      headers: { "x-pathname": "/en/campaigns/shop-online" },
    });

    const response = await GET(request);
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/en/contact");
    expect(location).toContain("topic=fit-call");
    expect(location).toContain("campaign=shop-online");
    expect(location).toContain("utm_source=linkedin");
    expect(location).toContain("utm_content=A_EN");
    // Stripe is not involved on the fit-call path.
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stamps UTM into Stripe metadata when present on a paid tier", async () => {
    const url =
      "http://localhost/api/checkout?campaign=shop-online&tier=starter" +
      "&utm_source=linkedin&utm_medium=cpc&utm_campaign=shop_online_founding&utm_content=A_EN";
    const request = new NextRequest(url, {
      method: "GET",
      headers: { "x-pathname": "/en/campaigns/shop-online" },
    });

    const response = await GET(request);
    expect(response.status).toBe(303);
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.metadata).toMatchObject({
      source: "cloudless.gr",
      campaign: "shop-online",
      tier: "starter",
      utm_source: "linkedin",
      utm_medium: "cpc",
      utm_campaign: "shop_online_founding",
      utm_content: "A_EN",
    });
  });

  it("omits UTM keys from metadata when not present (no empty values)", async () => {
    const request = new NextRequest(
      "http://localhost/api/checkout?campaign=shop-online&tier=starter",
      { method: "GET", headers: { "x-pathname": "/en/campaigns/shop-online" } }
    );

    const response = await GET(request);
    expect(response.status).toBe(303);
    const md = mockCreate.mock.calls[0][0].metadata as Record<string, string>;
    expect(md.source).toBe("cloudless.gr");
    expect(md.campaign).toBe("shop-online");
    expect(md.tier).toBe("starter");
    // Empty UTM values do not waste Stripe's 50-key metadata budget.
    expect(md.utm_source).toBeUndefined();
    expect(md.utm_content).toBeUndefined();
  });

  it("returns 400 when campaign or tier query param is missing", async () => {
    const noCampaign = new NextRequest("http://localhost/api/checkout?tier=starter", {
      method: "GET",
    });
    expect((await GET(noCampaign)).status).toBe(400);

    const noTier = new NextRequest("http://localhost/api/checkout?campaign=shop-online", {
      method: "GET",
    });
    expect((await GET(noTier)).status).toBe(400);
  });
});


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

  it("returns 400 for unknown product IDs", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "fake-product", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
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

  it("passes Stripe idempotency options when Idempotency-Key header is valid", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "checkout_2025_abc12345",
      },
      body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createOptions = mockCreate.mock.calls[0][1];
    expect(createOptions).toEqual({ idempotencyKey: "checkout_2025_abc12345" });
  });

  it("ignores invalid Idempotency-Key header format", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "not valid!",
      },
      body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createOptions = mockCreate.mock.calls[0][1];
    expect(createOptions).toBeUndefined();
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
