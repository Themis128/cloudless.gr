import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

const mockGetProducts = vi.fn();
vi.mock("@/lib/store-products", () => ({
  getProducts: (...a: unknown[]) => mockGetProducts(...a),
}));

const mockCallGemini = vi.fn();
vi.mock("@/lib/gemini-admin", () => ({
  callGemini: (...a: unknown[]) => mockCallGemini(...a),
}));

const mockGetStripe = vi.fn();
const mockProductsUpdate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: (...a: unknown[]) => mockGetStripe(...a),
}));

function adminOk() {
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
}
function adminFail() {
  mockRequireAdmin.mockResolvedValue({
    ok: false,
    response: new Response(null, { status: 401 }),
  });
}

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/ai/product-descriptions", {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

const sampleProduct = {
  id: "srv-cloud",
  name: "Cloud Architecture Audit",
  description: "Old copy",
  category: "service" as const,
  price: 49900,
  currency: "eur",
  features: ["Audit report"],
};

describe("POST /api/admin/ai/product-descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete (process.env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY;
    delete (process.env as { AI?: unknown }).AI;
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(req("POST", { productIds: ["srv-cloud"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no matching products", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([sampleProduct]);
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(req("POST", { productIds: ["missing-id"] }));
    expect(res.status).toBe(400);
  });

  it("generates via Gemini when Workers AI unbound", async () => {
    adminOk();
    process.env.GEMINI_API_KEY = "test-key";
    mockGetProducts.mockResolvedValue([sampleProduct]);
    mockCallGemini.mockResolvedValue("Clear skies for your cloud bill.");
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(req("POST", { productIds: ["srv-cloud"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].description).toContain("Clear skies");
    expect(data.errors).toEqual([]);
    expect(mockCallGemini).toHaveBeenCalled();
  });
});

describe("PUT /api/admin/ai/product-descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      req("PUT", { descriptions: [{ id: "srv-cloud", description: "New" }] })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 without descriptions array", async () => {
    adminOk();
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(req("PUT", {}));
    expect(res.status).toBe(400);
  });

  it("applies approved descriptions to product cache", async () => {
    adminOk();
    const products = [{ ...sampleProduct }];
    mockGetProducts.mockResolvedValue(products);
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      req("PUT", {
        descriptions: [{ id: "srv-cloud", description: "Approved Cloudflare-first copy." }],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applied).toBe(1);
    expect(products[0].description).toBe("Approved Cloudflare-first copy.");
  });
});


describe("product-descriptions route tails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete (process.env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY;
    delete (process.env as { AI?: unknown }).AI;
  });

  it("generates for all products when the body is unparseable", async () => {
    adminOk();
    process.env.GEMINI_API_KEY = "k";
    mockGetProducts.mockResolvedValue([sampleProduct]);
    mockCallGemini.mockResolvedValue("desc");
    const { POST } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const bad = new NextRequest(
      "http://localhost/api/admin/ai/product-descriptions",
      { method: "POST", body: "not-json{{{" }
    );
    const res = await POST(bad);
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(1);
  });

  it("filters non-string productIds and returns 400 when none match", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([sampleProduct]);
    const { POST } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await POST(
      req("POST", { productIds: [42, null, "missing"] })
    );
    expect(res.status).toBe(400);
  });

  it("falls back to Gemini when the AI binding is unusable", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([sampleProduct]);
    process.env.GEMINI_API_KEY = "k";
    mockCallGemini.mockResolvedValue("gemini copy");
    // In Node, process.env coerces the binding to a string — ai.run throws,
    // exercising the same catch → fallback branch the Workers path uses.
    (process.env as { AI?: unknown }).AI = {
      run: vi.fn().mockResolvedValue({ response: "workers-ai copy" }),
    };
    const { POST } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await POST(req("POST", { productIds: ["srv-cloud"] }));
    const data = await res.json();
    expect(data.results[0].description).toBe("gemini copy");
    expect(mockCallGemini).toHaveBeenCalled();
  });

  it("falls back to Gemini when Workers AI throws, and records per-product errors", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([
      sampleProduct,
      { ...sampleProduct, id: "srv-fail", name: "Failing" },
    ]);
    // Workers AI throws → falls through to Gemini; no GEMINI key for srv-fail ordering:
    // set key so first succeeds, then remove — simpler: both go through Gemini.
    (process.env as { AI?: unknown }).AI = {
      run: vi.fn().mockRejectedValue(new Error("ai down")),
    };
    process.env.GEMINI_API_KEY = "k";
    mockCallGemini
      .mockResolvedValueOnce("ok copy")
      .mockRejectedValueOnce(new Error("quota"));
    const { POST } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await POST(req("POST", {}));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].id).toBe("srv-fail");
  });

  it("PUT filters malformed entries and applies only valid ones", async () => {
    adminOk();
    const products = [{ ...sampleProduct }];
    mockGetProducts.mockResolvedValue(products);
    const { PUT } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await PUT(
      req("PUT", {
        descriptions: [
          { id: "srv-cloud", description: "valid" },
          { id: 42, description: "bad id" },
          { description: "no id" },
          { id: "ghost", description: "no product" },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).applied).toBe(1);
  });

  it("PUT 400 on unparseable JSON body", async () => {
    adminOk();
    const { PUT } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ai/product-descriptions", {
        method: "PUT",
        body: "{{{",
      })
    );
    expect(res.status).toBe(400);
  });

  it("PUT fires Stripe metadata updates when Stripe is configured", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([{ ...sampleProduct }]);
    mockGetStripe.mockResolvedValue({
      products: { update: mockProductsUpdate },
    });
    mockProductsUpdate.mockResolvedValue({});
    const { PUT } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await PUT(
      req("PUT", {
        descriptions: [{ id: "srv-cloud", description: "new copy" }],
      })
    );
    expect((await res.json()).applied).toBe(1);
    // Fire-and-forget — let the dynamic import + update settle.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockProductsUpdate).toHaveBeenCalledWith("srv-cloud", {
      description: "new copy",
    });
  });

  it("PUT tolerates Stripe update failures and an unconfigured Stripe", async () => {
    adminOk();
    mockGetProducts.mockResolvedValue([{ ...sampleProduct }]);
    mockGetStripe.mockResolvedValue({
      products: { update: mockProductsUpdate },
    });
    mockProductsUpdate.mockRejectedValue(new Error("stripe 500"));
    const { PUT } = await import(
      "@/app/api/admin/ai/product-descriptions/route"
    );
    const res = await PUT(
      req("PUT", {
        descriptions: [{ id: "srv-cloud", description: "new copy" }],
      })
    );
    // Per-product update failure is swallowed (Promise.allSettled).
    expect((await res.json()).applied).toBe(1);

    // Stripe unconfigured — getStripe() returns null → update skipped.
    mockGetStripe.mockResolvedValue(null);
    const res2 = await PUT(
      req("PUT", {
        descriptions: [{ id: "srv-cloud", description: "newer copy" }],
      })
    );
    expect((await res2.json()).applied).toBe(1);
  });
});
