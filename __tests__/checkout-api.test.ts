// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockGetStripe = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: (...a: unknown[]) => mockGetStripe(...a),
}));

vi.mock("@/lib/api-auth", () => ({
  getTokenFromHeader: vi.fn(() => null),
  verifyToken: vi.fn(() => Promise.resolve(null)),
  requireAuth: vi.fn(async () => ({
    ok: true,
    user: { sub: "test-user", email: "test@cloudless.gr", groups: [], roles: [] },
  })),
}));

describe("GET /api/checkout (campaign tier)", () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetStripe.mockResolvedValue({
      checkout: { sessions: { create: mockCreate } },
    });
    mockCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_abc",
      id: "cs_test_abc",
    });
    vi.resetModules();
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

  it("creates Stripe session and redirects for paid campaign tier", async () => {
    const url =
      "http://localhost/api/checkout?campaign=shop-online&tier=starter" +
      "&utm_source=linkedin&utm_medium=cpc";
    const request = new NextRequest(url, {
      method: "GET",
      headers: { "x-pathname": "/en/campaigns/shop-online" },
    });

    const response = await GET(request);
    expect(response.status).toBe(303);
    expect(mockCreate).toHaveBeenCalled();
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("checkout.stripe.com");
  });

  it("returns 503 when Stripe is not configured for paid tier", async () => {
    mockGetStripe.mockResolvedValueOnce(null);
    const url = "http://localhost/api/checkout?campaign=shop-online&tier=starter";
    const request = new NextRequest(url, {
      method: "GET",
      headers: { "x-pathname": "/en/campaigns/shop-online" },
    });
    expect((await GET(request)).status).toBe(503);
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
    mockGetStripe.mockResolvedValue({
      checkout: { sessions: { create: mockCreate } },
    });
    mockCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_cart",
      id: "cs_test_cart",
    });
    vi.resetModules();
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

  it("returns Stripe Checkout URL for valid cart items", async () => {
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://cloudless.gr",
        "x-pathname": "/en/store",
      },
      body: JSON.stringify({
        items: [{ id: "srv-cloud", quantity: 1 }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toContain("checkout.stripe.com");
    expect(mockCreate).toHaveBeenCalled();
    const args = mockCreate.mock.calls[0][0] as {
      success_url: string;
      cancel_url: string;
    };
    expect(args.success_url).toContain("/en/store/success");
    expect(args.cancel_url).toContain("/en/store");
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockGetStripe.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://cloudless.gr" },
      body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
    });
    expect((await POST(request)).status).toBe(503);
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

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (s: { setTag: (k: string, v: string) => void }) => void) =>
    cb({ setTag: vi.fn() })
  ),
}));

import { getTokenFromHeader, verifyToken } from "@/lib/api-auth";

describe("checkout — tail branches", () => {
  let GET2: (request: NextRequest) => Promise<Response>;
  let POST2: (request: NextRequest) => Promise<Response>;
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetStripe.mockResolvedValue({
      checkout: { sessions: { create: mockCreate } },
    });
    mockCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_abc",
      id: "cs_test_abc",
    });
    const mod = await import("@/app/api/checkout/route");
    GET2 = mod.GET;
    POST2 = mod.POST;
  });

  it("GET 400 on unknown campaign", async () => {
    const res = await GET2(
      new NextRequest("http://localhost/api/checkout?campaign=nope&tier=x")
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown campaign");
  });

  it("GET 400 on unknown tier", async () => {
    const res = await GET2(
      new NextRequest("http://localhost/api/checkout?campaign=shop-online&tier=nope")
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Unknown tier");
  });

  it("POST authenticates via Bearer token when present", async () => {
    vi.mocked(getTokenFromHeader).mockReturnValueOnce("tok-1");
    vi.mocked(verifyToken).mockResolvedValueOnce({ sub: "u9", email: "u9@x.dev" } as never);
    const res = await POST2(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://cloudless.gr",
        },
        body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("POST rejects malformed idempotency keys silently", async () => {
    const res = await POST2(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://cloudless.gr",
          "idempotency-key": "bad key with spaces!",
        },
        body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("POST 400 on unknown product + sentry on stripe failure", async () => {
    const res = await POST2(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://cloudless.gr",
        },
        body: JSON.stringify({ items: [{ id: "nope-nothing", quantity: 1 }] }),
      })
    );
    expect(res.status).toBe(400);

    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn";
    mockCreate.mockRejectedValueOnce(new Error("stripe exploded"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res2 = await POST2(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://cloudless.gr",
        },
        body: JSON.stringify({ items: [{ id: "srv-cloud", quantity: 1 }] }),
      })
    );
    expect(res2.status).toBe(500);
    const sentry = await import("@sentry/nextjs");
    expect(vi.mocked(sentry.captureException)).toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    spy.mockRestore();
  });
});
