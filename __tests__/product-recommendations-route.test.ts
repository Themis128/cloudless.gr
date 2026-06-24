import { beforeEach, describe, expect, it, vi } from "vitest";

const recommendProductsForProduct = vi.fn();

vi.mock("@/lib/product-recommendations", () => ({
  recommendProductsForProduct,
}));

async function callRecommendations(url: string) {
  const { GET } = await import("@/app/api/products/recommendations/route");

  const response = await GET(new Request(url));

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("/api/products/recommendations route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    recommendProductsForProduct.mockResolvedValue([
      {
        id: "analytics-growth",
        name: "Analytics Growth",
        category: "analytics",
        description: "Advanced dashboards and growth reporting.",
        price: 790,
        currency: "EUR",
        features: ["Athena dashboards", "growth reporting"],
      },
    ]);
  });

  it("returns 400 when productId is missing", async () => {
    const result = await callRecommendations(
      "https://cloudless.gr/api/products/recommendations",
    );

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: "Missing productId",
    });
    expect(recommendProductsForProduct).not.toHaveBeenCalled();
  });

  it("returns recommendations for a product", async () => {
    const result = await callRecommendations(
      "https://cloudless.gr/api/products/recommendations?productId=analytics-starter&limit=3",
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      productId: "analytics-starter",
      count: 1,
      recommendations: [
        {
          id: "analytics-growth",
          name: "Analytics Growth",
          category: "analytics",
          description: "Advanced dashboards and growth reporting.",
          price: 790,
          currency: "EUR",
          features: ["Athena dashboards", "growth reporting"],
        },
      ],
    });
    expect(recommendProductsForProduct).toHaveBeenCalledWith("analytics-starter", 3);
  });

  it("clamps limit to 8", async () => {
    await callRecommendations(
      "https://cloudless.gr/api/products/recommendations?productId=analytics-starter&limit=999",
    );

    expect(recommendProductsForProduct).toHaveBeenCalledWith("analytics-starter", 8);
  });

  it("uses default limit 3", async () => {
    await callRecommendations(
      "https://cloudless.gr/api/products/recommendations?productId=analytics-starter",
    );

    expect(recommendProductsForProduct).toHaveBeenCalledWith("analytics-starter", 3);
  });
});
