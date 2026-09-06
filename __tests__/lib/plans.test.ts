import { describe, it, expect } from "vitest";
import { PLAN_LABELS, PLAN_KEYS, isValidPlan } from "@/lib/plans";

describe("PLAN_LABELS", () => {
  it("includes expected plan keys", () => {
    expect(PLAN_LABELS.cloud).toBeDefined();
    expect(PLAN_LABELS.serverless).toBeDefined();
    expect(PLAN_LABELS.analytics).toBeDefined();
    expect(PLAN_LABELS.marketing).toBeDefined();
    expect(PLAN_LABELS.web).toBeDefined();
    expect(PLAN_LABELS.hosting).toBeDefined();
    expect(PLAN_LABELS.bundle).toBeDefined();
  });

  it("has non-empty string values", () => {
    for (const val of Object.values(PLAN_LABELS)) {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

describe("PLAN_KEYS", () => {
  it("is a Set containing the same keys as PLAN_LABELS", () => {
    for (const key of Object.keys(PLAN_LABELS)) {
      expect(PLAN_KEYS.has(key)).toBe(true);
    }
  });
});

describe("isValidPlan", () => {
  it("returns true for known plan keys", () => {
    expect(isValidPlan("cloud")).toBe(true);
    expect(isValidPlan("bundle")).toBe(true);
    expect(isValidPlan("web")).toBe(true);
  });

  it("returns false for unknown strings", () => {
    expect(isValidPlan("unknown")).toBe(false);
    expect(isValidPlan("")).toBe(false);
    expect(isValidPlan("Cloud")).toBe(false); // case-sensitive
  });

  it("returns false for non-string values", () => {
    expect(isValidPlan(42)).toBe(false);
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan(undefined)).toBe(false);
    expect(isValidPlan(["cloud"])).toBe(false);
  });
});
