import { describe, it, expect } from "vitest";
import {
  categoryLabels,
  categoryColors,
  defaultProducts,
  type StoreProduct,
  type ProductCategory,
} from "@/lib/store-products-client";

const CATEGORIES: ProductCategory[] = ["service", "digital", "physical"];

describe("categoryLabels", () => {
  it("has a label for every category", () => {
    for (const cat of CATEGORIES) {
      expect(typeof categoryLabels[cat]).toBe("string");
      expect(categoryLabels[cat].length).toBeGreaterThan(0);
    }
  });
});

describe("categoryColors", () => {
  it("has a color string for every category", () => {
    for (const cat of CATEGORIES) {
      expect(typeof categoryColors[cat]).toBe("string");
      expect(categoryColors[cat].length).toBeGreaterThan(0);
    }
  });
});

describe("defaultProducts", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(defaultProducts)).toBe(true);
    expect(defaultProducts.length).toBeGreaterThan(0);
  });

  it("each product has required fields", () => {
    for (const product of defaultProducts) {
      expect(typeof product.id).toBe("string");
      expect(product.id.length).toBeGreaterThan(0);
      expect(typeof product.name).toBe("string");
      expect(typeof product.price).toBe("number");
      expect(product.price).toBeGreaterThan(0);
      expect(typeof product.currency).toBe("string");
      expect(CATEGORIES).toContain(product.category);
    }
  });

  it("product ids are unique", () => {
    const ids = defaultProducts.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("prices are positive integers (cents)", () => {
    for (const product of defaultProducts) {
      expect(Number.isInteger(product.price)).toBe(true);
      expect(product.price).toBeGreaterThan(0);
    }
  });

  it("recurring products have interval set", () => {
    for (const product of defaultProducts) {
      if (product.recurring) {
        expect(["month", "year"]).toContain(product.interval);
      }
    }
  });
});
