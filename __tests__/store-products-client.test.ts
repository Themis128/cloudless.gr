import { describe, it, expect } from "vitest";
import {
  getProductById,
  getProductsByCategory,
  demoProducts,
  categoryLabels,
  categoryColors,
} from "@/lib/store-products-client";

describe("store-products-client.ts", () => {
  describe("getProductById()", () => {
    it("returns a product when the id exists", () => {
      const p = getProductById("srv-cloud");
      expect(p).toBeDefined();
      expect(p!.id).toBe("srv-cloud");
      expect(p!.category).toBe("service");
    });

    it("returns a digital product", () => {
      const p = getProductById("dig-cloud-playbook");
      expect(p).toBeDefined();
      expect(p!.category).toBe("digital");
    });

    it("returns a physical product", () => {
      const p = getProductById("phy-tshirt");
      expect(p).toBeDefined();
      expect(p!.category).toBe("physical");
    });

    it("returns undefined for an unknown id", () => {
      expect(getProductById("does-not-exist")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(getProductById("")).toBeUndefined();
    });
  });

  describe("getProductsByCategory()", () => {
    it("returns only service products", () => {
      const products = getProductsByCategory("service");
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p) => p.category === "service")).toBe(true);
    });

    it("returns only digital products", () => {
      const products = getProductsByCategory("digital");
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p) => p.category === "digital")).toBe(true);
    });

    it("returns only physical products", () => {
      const products = getProductsByCategory("physical");
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p) => p.category === "physical")).toBe(true);
    });
  });

  describe("demoProducts", () => {
    it("contains products from all three categories", () => {
      const cats = new Set(demoProducts.map((p) => p.category));
      expect(cats.has("service")).toBe(true);
      expect(cats.has("digital")).toBe(true);
      expect(cats.has("physical")).toBe(true);
    });

    it("all products have required fields with valid values", () => {
      for (const p of demoProducts) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.description).toBeTruthy();
        expect(p.price).toBeGreaterThan(0);
        expect(p.currency).toBeTruthy();
        expect(p.image).toBeTruthy();
      }
    });
  });

  describe("categoryLabels", () => {
    it("has a label for each category", () => {
      expect(categoryLabels.service).toBe("Services");
      expect(categoryLabels.digital).toBe("Digital Products");
      expect(categoryLabels.physical).toBe("Merch & Physical");
    });
  });

  describe("categoryColors", () => {
    it("has a color entry for each category", () => {
      expect(typeof categoryColors.service).toBe("string");
      expect(typeof categoryColors.digital).toBe("string");
      expect(typeof categoryColors.physical).toBe("string");
    });
  });
});
