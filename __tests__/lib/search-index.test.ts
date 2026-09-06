/**
 * Tests for src/lib/search-index.ts
 *
 * Covers:
 *  - CATEGORY_LABELS constant
 *  - toProductDocument() — pure mapping function
 *  - syncAllProducts() — empty catalog, full sync
 *  - syncProductsByIds() — subset, empty subset
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetProducts, mockIndexProducts, mockResetIndex } = vi.hoisted(() => ({
  mockGetProducts: vi.fn(),
  mockIndexProducts: vi.fn(),
  mockResetIndex: vi.fn(),
}));

vi.mock("@/lib/store-products", () => ({ getProducts: mockGetProducts }));
vi.mock("@/lib/meilisearch", () => ({
  indexProducts: mockIndexProducts,
  resetIndex: mockResetIndex,
  // re-export types as values so the import doesn't crash
}));

import {
  CATEGORY_LABELS,
  toProductDocument,
  syncAllProducts,
  syncProductsByIds,
} from "@/lib/search-index";
import type { StoreProduct } from "@/lib/store-products";

// ---------------------------------------------------------------------------
const BASE_PRODUCT: StoreProduct = {
  id: "prod-1",
  name: "Cloud Hosting",
  description: "Fast Pi-hosted cloud",
  price: 2900,
  currency: "EUR",
  category: "service",
  image: "/img/hosting.png",
  features: ["SSL", "backups"],
  stripeProductId: "stripe-prod-1",
  stripePriceId: "stripe-price-1",
};

beforeEach(() => {
  mockGetProducts.mockReset();
  mockIndexProducts.mockReset();
  mockResetIndex.mockReset();
});

// ---------------------------------------------------------------------------
describe("CATEGORY_LABELS", () => {
  it("maps service → Services", () => {
    expect(CATEGORY_LABELS["service"]).toBe("Services");
  });

  it("maps digital → Digital Products", () => {
    expect(CATEGORY_LABELS["digital"]).toBe("Digital Products");
  });

  it("maps physical → Merch & Physical", () => {
    expect(CATEGORY_LABELS["physical"]).toBe("Merch & Physical");
  });
});

// ---------------------------------------------------------------------------
describe("toProductDocument", () => {
  it("maps all fields from StoreProduct", () => {
    const doc = toProductDocument(BASE_PRODUCT);
    expect(doc.id).toBe("prod-1");
    expect(doc.name).toBe("Cloud Hosting");
    expect(doc.description).toBe("Fast Pi-hosted cloud");
    expect(doc.price).toBe(2900);
    expect(doc.currency).toBe("EUR");
    expect(doc.category).toBe("service");
    expect(doc.image).toBe("/img/hosting.png");
    expect(doc.features).toEqual(["SSL", "backups"]);
  });

  it("sets featuresText as comma-joined features", () => {
    const doc = toProductDocument(BASE_PRODUCT);
    expect(doc.featuresText).toBe("SSL, backups");
  });

  it("resolves categoryLabel from CATEGORY_LABELS", () => {
    const doc = toProductDocument(BASE_PRODUCT);
    expect(doc.categoryLabel).toBe("Services");
  });

  it("falls back to raw category when label not in map", () => {
    const doc = toProductDocument({ ...BASE_PRODUCT, category: "unknown-cat" });
    expect(doc.categoryLabel).toBe("unknown-cat");
  });

  it("sets updatedAt as ISO date string", () => {
    const doc = toProductDocument(BASE_PRODUCT);
    expect(() => new Date(doc.updatedAt)).not.toThrow();
    expect(doc.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles undefined features", () => {
    const doc = toProductDocument({ ...BASE_PRODUCT, features: undefined });
    expect(doc.featuresText).toBe("");
    expect(doc.features).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("syncAllProducts", () => {
  it("returns indexed:0, configured:false when no products", async () => {
    mockGetProducts.mockResolvedValue([]);
    const result = await syncAllProducts();
    expect(result).toEqual({ indexed: 0, configured: false });
    expect(mockResetIndex).not.toHaveBeenCalled();
  });

  it("resets index and returns count when products exist", async () => {
    mockGetProducts.mockResolvedValue([BASE_PRODUCT]);
    mockResetIndex.mockResolvedValue(undefined);
    const result = await syncAllProducts();
    expect(result).toEqual({ indexed: 1, configured: true });
    const [docs] = mockResetIndex.mock.calls[0] as [ReturnType<typeof toProductDocument>[]];
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("prod-1");
    expect(docs[0].name).toBe("Cloud Hosting");
    expect(docs[0].categoryLabel).toBe("Services");
  });

  it("syncs multiple products", async () => {
    const p2 = { ...BASE_PRODUCT, id: "prod-2", name: "VPS" };
    mockGetProducts.mockResolvedValue([BASE_PRODUCT, p2]);
    mockResetIndex.mockResolvedValue(undefined);
    const result = await syncAllProducts();
    expect(result.indexed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe("syncProductsByIds", () => {
  it("returns 0 when no products match the ids", async () => {
    mockGetProducts.mockResolvedValue([BASE_PRODUCT]);
    const result = await syncProductsByIds(["prod-999"]);
    expect(result).toBe(0);
    expect(mockIndexProducts).not.toHaveBeenCalled();
  });

  it("indexes only the matching products", async () => {
    const p2 = { ...BASE_PRODUCT, id: "prod-2" };
    mockGetProducts.mockResolvedValue([BASE_PRODUCT, p2]);
    mockIndexProducts.mockResolvedValue(undefined);
    const result = await syncProductsByIds(["prod-2"]);
    expect(result).toBe(1);
    const [docs] = mockIndexProducts.mock.calls[0] as [ReturnType<typeof toProductDocument>[]];
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("prod-2");
  });

  it("indexes multiple matched products", async () => {
    const p2 = { ...BASE_PRODUCT, id: "prod-2" };
    mockGetProducts.mockResolvedValue([BASE_PRODUCT, p2]);
    mockIndexProducts.mockResolvedValue(undefined);
    const result = await syncProductsByIds(["prod-1", "prod-2"]);
    expect(result).toBe(2);
  });
});
