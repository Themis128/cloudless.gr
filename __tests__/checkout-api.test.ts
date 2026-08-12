// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock store-products so product lookup works
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/api-auth", () => ({
  getTokenFromHeader: vi.fn(() => null),
  verifyToken: vi.fn(() => Promise.resolve(null)),
  requireAuth: vi.fn(async () => ({
    ok: true,
    user: { sub: "test-user", email: "test@cloudless.gr", groups: [], roles: [] },
  })),
}));

// ---------------------------------------------------------------------------
// GET /api/checkout — campaign tier flow (redirects to contact page)
// ---------------------------------------------------------------------------

describe("GET /api/checkout (campaign tier)", () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
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
  });

  it("redirects paid tier to campaign thanks (Stripe checkout path)", async () => {
    const url =
      "http://localhost/api/checkout?campaign=shop-online&tier=starter" +
      "&utm_source=linkedin&utm_medium=cpc";
    const request = new NextRequest(url, {
      method: "GET",
      headers: { "x-pathname": "/en/campaigns/shop-online" },
    });

    const response = await GET(request);
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/en/campaigns/shop-online/thanks");
    expect(location).toContain("tier=starter");
    expect(location).toContain("utm_source=linkedin");
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

// ---------------------------------------------------------------------------
// POST /api/checkout — store cart flow (redirects to contact page)
// ---------------------------------------------------------------------------

describe("POST /api/checkout", () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
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

  it("returns contact page URL with product names for valid items", async () => {
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
    expect(data.url).toContain("/contact");
    expect(data.url).toContain("topic=purchase");
    expect(data.url).toContain("Cloud+Architecture+Audit");
  });

  it("clamps quantity and shows (xN) in product names", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "phy-tshirt", quantity: 500 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.url).toContain("x99");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
