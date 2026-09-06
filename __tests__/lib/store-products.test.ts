import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stripe", () => ({
  listStripeProducts: vi.fn().mockResolvedValue(null),
}));

import {
  mapStripeProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  defaultProducts,
  type StoreProduct,
} from "@/lib/store-products";
import type { StripeProduct } from "@/lib/stripe";

const mockStripeProduct: StripeProduct = {
  id: "prod_abc123",
  name: "Cloud Service",
  description: "Test description",
  images: [],
  metadata: {
    category: "service",
    image: "/store/cloud.svg",
    features: "Feature A, Feature B",
  },
  defaultPrice: {
    unitAmount: 50000,
    currency: "eur",
    recurring: null,
  },
};

describe("mapStripeProduct", () => {
  it("maps a Stripe product to StoreProduct format", () => {
    const product = mapStripeProduct(mockStripeProduct);
    expect(product.id).toBe("prod_abc123");
    expect(product.name).toBe("Cloud Service");
    expect(product.price).toBe(50000);
    expect(product.currency).toBe("eur");
    expect(product.category).toBe("service");
    expect(product.image).toBe("/store/cloud.svg");
  });

  it("splits features from comma-separated metadata", () => {
    const product = mapStripeProduct(mockStripeProduct);
    expect(product.features).toEqual(["Feature A", "Feature B"]);
  });

  it("sets recurring from defaultPrice.recurring", () => {
    const product = mapStripeProduct({ ...mockStripeProduct, defaultPrice: { ...mockStripeProduct.defaultPrice!, recurring: { interval: "month" } } });
    expect(product.recurring).toBe(true);
    expect(product.interval).toBe("month");
  });

  it("falls back to /store/default.svg when no image", () => {
    const product = mapStripeProduct({ ...mockStripeProduct, metadata: {}, images: [] });
    expect(product.image).toBe("/store/default.svg");
  });
});

describe("defaultProducts", () => {
  it("is a non-empty array", () => {
    expect(defaultProducts.length).toBeGreaterThan(0);
  });

  it("each product has required fields", () => {
    for (const p of defaultProducts) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.price).toBe("number");
    }
  });
});

describe("getProducts (no Stripe)", () => {
  beforeEach(() => {
    // Reset cache by importing the module fresh isn't possible, but
    // since listStripeProducts returns null, it falls back to defaultProducts
  });

  it("returns defaultProducts when Stripe returns null", async () => {
    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products).toEqual(expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]));
  });
});

describe("getProductById", () => {
  it("returns a product for a known default product id", () => {
    const id = defaultProducts[0].id;
    const product = getProductById(id);
    expect(product?.id).toBe(id);
  });

  it("returns undefined for unknown id", () => {
    expect(getProductById("nonexistent-id-xyz")).toBeUndefined();
  });
});

describe("getProductsByCategory", () => {
  it("returns service products", () => {
    const products = getProductsByCategory("service");
    expect(products.every((p) => p.category === "service")).toBe(true);
  });
});
