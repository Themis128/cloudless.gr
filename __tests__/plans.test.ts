import { describe, expect, it } from "vitest";
import { PLAN_LABELS, PLAN_KEYS, isValidPlan } from "@/lib/plans";

describe("plans module", () => {
  it("exposes the canonical 7 plan keys", () => {
    expect(Object.keys(PLAN_LABELS).sort()).toEqual(
      ["analytics", "bundle", "cloud", "hosting", "marketing", "serverless", "web"].sort()
    );
  });

  it("every plan has a non-empty label", () => {
    for (const [key, label] of Object.entries(PLAN_LABELS)) {
      expect(label, `label for plan "${key}" must be non-empty`).toBeTruthy();
      expect(typeof label).toBe("string");
    }
  });

  it("PLAN_KEYS set matches PLAN_LABELS keys", () => {
    expect([...PLAN_KEYS].sort()).toEqual(Object.keys(PLAN_LABELS).sort());
  });

  describe("isValidPlan", () => {
    it.each([
      ["cloud", true],
      ["serverless", true],
      ["analytics", true],
      ["marketing", true],
      ["web", true],
      ["hosting", true],
      ["bundle", true],
    ])("accepts the canonical key %s", (key, expected) => {
      expect(isValidPlan(key)).toBe(expected);
    });

    it.each([
      ["", false],
      ["CLOUD", false], // case-sensitive
      ["unknown-plan", false],
      ["<script>alert(1)</script>", false],
      ["cloud serverless", false],
      [" cloud", false], // no trim
      ["cloud ", false],
    ])("rejects %s", (input, expected) => {
      expect(isValidPlan(input)).toBe(expected);
    });

    it("rejects non-string types", () => {
      expect(isValidPlan(null)).toBe(false);
      expect(isValidPlan(undefined)).toBe(false);
      expect(isValidPlan(42)).toBe(false);
      expect(isValidPlan({})).toBe(false);
      expect(isValidPlan(["cloud"])).toBe(false);
      expect(isValidPlan(true)).toBe(false);
    });
  });

  it("pending-clients re-exports the same PLAN_LABELS reference", async () => {
    // Single source of truth: importing PLAN_LABELS from the server-side
    // pending-clients module must yield the same object identity, so a
    // future drift (someone adding a plan in only one place) is impossible.
    const pending = await import("@/lib/pending-clients");
    expect(pending.PLAN_LABELS).toBe(PLAN_LABELS);
  });
});
