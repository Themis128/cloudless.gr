import { describe, it, expect } from "vitest";
import { SECTION_ORDER, type DatalakeSectionName } from "@/lib/datalake-r2";

describe("SECTION_ORDER", () => {
  it("is a non-empty array of strings", () => {
    expect(Array.isArray(SECTION_ORDER)).toBe(true);
    expect(SECTION_ORDER.length).toBeGreaterThan(0);
    for (const s of SECTION_ORDER) {
      expect(typeof s).toBe("string");
    }
  });

  it("contains core sections", () => {
    expect(SECTION_ORDER).toContain("acquisition_funnel");
    expect(SECTION_ORDER).toContain("attribution");
    expect(SECTION_ORDER).toContain("stripe_revenue");
  });

  it("has unique values", () => {
    const unique = new Set(SECTION_ORDER);
    expect(unique.size).toBe(SECTION_ORDER.length);
  });
});
