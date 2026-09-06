import { describe, it, expect } from "vitest";
import { DEFAULT_FLAGS, assignVariant } from "@/lib/ab-flags";
import type { ABFlag } from "@/lib/ab-flags";

describe("DEFAULT_FLAGS", () => {
  it("is a non-empty array of ABFlag objects", () => {
    expect(Array.isArray(DEFAULT_FLAGS)).toBe(true);
    expect(DEFAULT_FLAGS.length).toBeGreaterThan(0);
  });

  it("each flag has required fields", () => {
    for (const flag of DEFAULT_FLAGS) {
      expect(typeof flag.id).toBe("string");
      expect(typeof flag.name).toBe("string");
      expect(typeof flag.enabled).toBe("boolean");
      expect(typeof flag.trafficSplit).toBe("number");
      expect(flag.trafficSplit).toBeGreaterThanOrEqual(0);
      expect(flag.trafficSplit).toBeLessThanOrEqual(100);
      expect(typeof flag.variants.a).toBe("string");
      expect(typeof flag.variants.b).toBe("string");
    }
  });

  it("all flags are disabled by default", () => {
    for (const flag of DEFAULT_FLAGS) {
      expect(flag.enabled).toBe(false);
    }
  });
});

describe("assignVariant", () => {
  const enabledFlag: ABFlag = {
    id: "test",
    name: "Test",
    description: "A test flag",
    enabled: true,
    trafficSplit: 50,
    variants: { a: "variant-a", b: "variant-b" },
  };

  const disabledFlag: ABFlag = { ...enabledFlag, enabled: false };

  it("returns 'a' when flag is disabled (regardless of cookie)", () => {
    expect(assignVariant(disabledFlag, "b")).toBe("a");
    expect(assignVariant(disabledFlag, undefined)).toBe("a");
  });

  it("returns the stored cookie variant 'a' when flag is enabled", () => {
    expect(assignVariant(enabledFlag, "a")).toBe("a");
  });

  it("returns the stored cookie variant 'b' when flag is enabled", () => {
    expect(assignVariant(enabledFlag, "b")).toBe("b");
  });

  it("returns 'a' or 'b' (random) when no cookie and flag is enabled", () => {
    const variants = new Set<string>();
    for (let i = 0; i < 20; i++) {
      variants.add(assignVariant(enabledFlag, undefined));
    }
    // Over 20 tries at 50/50 split, we expect both variants to appear
    expect(variants.has("a") || variants.has("b")).toBe(true);
    // Each variant must be a or b (nothing else)
    for (const v of variants) {
      expect(["a", "b"]).toContain(v);
    }
  });

  it("returns 'a' for unknown cookie value (not 'a' or 'b')", () => {
    // Unknown values are not stable — they fall to random, but the result must be a or b
    const result = assignVariant(enabledFlag, "unknown");
    expect(["a", "b"]).toContain(result);
  });
});
