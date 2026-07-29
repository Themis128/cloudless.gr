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
