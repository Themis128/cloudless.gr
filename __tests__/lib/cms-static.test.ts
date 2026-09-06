import { describe, it, expect } from "vitest";
import { staticFaqs, staticTestimonials } from "@/lib/cms-static";

describe("staticFaqs", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(staticFaqs)).toBe(true);
    expect(staticFaqs.length).toBeGreaterThan(0);
  });

  it("each FAQ has required fields", () => {
    for (const faq of staticFaqs) {
      expect(typeof faq.id).toBe("string");
      expect(typeof faq.question).toBe("string");
      expect(typeof faq.answer).toBe("string");
      expect(["general", "pricing", "technical", "process"]).toContain(faq.category);
      expect(Array.isArray(faq.locales)).toBe(true);
    }
  });

  it("has at least one FAQ per category", () => {
    const categories = new Set(staticFaqs.map((f) => f.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});

describe("staticTestimonials", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(staticTestimonials)).toBe(true);
    expect(staticTestimonials.length).toBeGreaterThan(0);
  });

  it("each testimonial has required fields", () => {
    for (const t of staticTestimonials) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.quote).toBe("string");
      expect(typeof t.featured).toBe("boolean");
    }
  });

  it("has at least one featured testimonial", () => {
    expect(staticTestimonials.some((t) => t.featured)).toBe(true);
  });
});
