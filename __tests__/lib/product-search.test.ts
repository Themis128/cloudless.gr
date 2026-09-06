import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/store-products", () => ({
  getProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/workers-ai-client", () => ({
  embedTextWithWorkersAi: vi.fn(),
  WORKERS_AI_EMBED_DIMENSIONS: 1024,
}));
vi.mock("@/lib/meilisearch", () => ({
  isMeilisearchConfigured: vi.fn().mockReturnValue(false),
  meiliRequest: vi.fn(),
  getMeiliAdminKey: vi.fn().mockReturnValue(""),
  PRODUCT_EMBEDDER: "productEmbedder",
  PRODUCTS_INDEX: "products",
}));

import { productToSearchText, productToSearchDocument } from "@/lib/product-search";

const sampleProduct = {
  id: "srv-cloud",
  name: "Cloud Audit",
  description: "Full cloud audit",
  price: 200000,
  currency: "eur",
  category: "service" as const,
  image: "/store/cloud.svg",
  features: ["Cost savings", "Security review"],
};

describe("productToSearchText", () => {
  it("concatenates name, category, description, and features", () => {
    const text = productToSearchText(sampleProduct);
    expect(text).toContain("Cloud Audit");
    expect(text).toContain("service");
    expect(text).toContain("Full cloud audit");
    expect(text).toContain("Cost savings");
    expect(text).toContain("Security review");
  });

  it("handles missing features", () => {
    const text = productToSearchText({ ...sampleProduct, features: undefined });
    expect(text).toContain("Cloud Audit");
    expect(text).not.toContain("undefined");
  });

  it("handles empty strings gracefully", () => {
    const text = productToSearchText({ ...sampleProduct, name: "", description: "" });
    expect(typeof text).toBe("string");
  });
});

describe("productToSearchDocument", () => {
  it("maps a product to a search document", () => {
    const doc = productToSearchDocument(sampleProduct);
    expect(doc.id).toBe("srv-cloud");
    expect(doc.name).toBe("Cloud Audit");
    expect(doc.category).toBe("service");
    expect(doc.description).toBe("Full cloud audit");
    expect(doc.href).toBe("/store/srv-cloud");
    expect(typeof doc.text).toBe("string");
    expect(doc.text.length).toBeGreaterThan(0);
  });

  it("omits price field when product has no price string", () => {
    const product = { ...sampleProduct, price: 0 };
    const doc = productToSearchDocument(product as typeof sampleProduct & { price: number });
    expect(doc.price).toBeUndefined();
  });
});
