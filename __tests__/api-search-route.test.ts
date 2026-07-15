import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const searchProductsFallback = vi.fn();
const searchProductsWithMeili = vi.fn();
const isMeilisearchConfigured = vi.fn();

vi.mock("@/lib/meilisearch", () => ({
  isMeilisearchConfigured,
}));

vi.mock("@/lib/product-search", () => ({
  searchProductsFallback,
  searchProductsWithMeili,
}));

async function callSearch(url: string) {
  const { GET } = await import("@/app/api/search/route");

  const response = await GET(new Request(url));
  return response.json();
}

describe("/api/search route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    isMeilisearchConfigured.mockReturnValue(false);
    searchProductsFallback.mockResolvedValue([
      {
        id: "fallback-product",
        name: "Fallback Product",
        category: "analytics",
        description: "Fallback hit",
        href: "/store/fallback-product",
      },
    ]);
    searchProductsWithMeili.mockResolvedValue([
      {
        id: "meili-product",
        name: "Meili Product",
        category: "ai",
        description: "Meili hit",
        href: "/store/meili-product",
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty source for blank queries", async () => {
    const body = await callSearch("https://cloudless.gr/api/search?q=");

    expect(body).toEqual({
      query: "",
      source: "empty",
      hits: [],
    });

    expect(searchProductsFallback).not.toHaveBeenCalled();
    expect(searchProductsWithMeili).not.toHaveBeenCalled();
  });

  it("uses fallback search when Meilisearch is not configured", async () => {
    isMeilisearchConfigured.mockReturnValue(false);

    const body = await callSearch("https://cloudless.gr/api/search?q=analytics&limit=8");

    expect(body.source).toBe("fallback");
    expect(body.hits).toHaveLength(1);
    expect(searchProductsFallback).toHaveBeenCalledWith("analytics", 8);
    expect(searchProductsWithMeili).not.toHaveBeenCalled();
  });

  it("uses Meilisearch when configured", async () => {
    isMeilisearchConfigured.mockReturnValue(true);

    const body = await callSearch("https://cloudless.gr/api/search?q=semantic&limit=5");

    expect(body.source).toBe("meilisearch-bedrock");
    expect(body.hits).toHaveLength(1);
    expect(searchProductsWithMeili).toHaveBeenCalledWith("semantic", 5);
    expect(searchProductsFallback).not.toHaveBeenCalled();
  });

  it("falls back when Meilisearch search throws", async () => {
    isMeilisearchConfigured.mockReturnValue(true);
    searchProductsWithMeili.mockRejectedValueOnce(new Error("meili unavailable"));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const body = await callSearch("https://cloudless.gr/api/search?q=semantic&limit=5");

    expect(body.source).toBe("fallback");
    expect(searchProductsWithMeili).toHaveBeenCalledWith("semantic", 5);
    expect(searchProductsFallback).toHaveBeenCalledWith("semantic", 5);
    expect(warn).toHaveBeenCalled();
  });

  it("clamps limit to 20", async () => {
    isMeilisearchConfigured.mockReturnValue(false);

    await callSearch("https://cloudless.gr/api/search?q=analytics&limit=999");

    expect(searchProductsFallback).toHaveBeenCalledWith("analytics", 20);
  });
});
