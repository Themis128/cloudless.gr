import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_FLAGS, assignVariant, getABFlags } from "@/lib/ab-flags";
import type { ABFlag } from "@/lib/ab-flags";
import { resetJsonConfigMemory, writeJsonConfig } from "@/lib/app-config-json";

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

  it("flag IDs are unique", () => {
    const ids = DEFAULT_FLAGS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("assignVariant()", () => {
  const enabledFlag: ABFlag = {
    id: "test",
    name: "Test Flag",
    description: "test",
    enabled: true,
    trafficSplit: 50,
    variants: { a: "Control", b: "Variant" },
  };

  const disabledFlag: ABFlag = { ...enabledFlag, enabled: false };

  it("always returns 'a' when flag is disabled", () => {
    for (let i = 0; i < 10; i++) {
      expect(assignVariant(disabledFlag)).toBe("a");
    }
  });

  it("returns stable 'a' when cookieValue is 'a'", () => {
    expect(assignVariant(enabledFlag, "a")).toBe("a");
  });

  it("returns stable 'b' when cookieValue is 'b'", () => {
    expect(assignVariant(enabledFlag, "b")).toBe("b");
  });

  it("ignores invalid cookie values and picks randomly", () => {
    const result = assignVariant(enabledFlag, "invalid");
    expect(["a", "b"]).toContain(result);
  });

  it("returns 'a' or 'b' for an enabled flag with no cookie", () => {
    const result = assignVariant(enabledFlag);
    expect(["a", "b"]).toContain(result);
  });

  it("100% traffic split always assigns 'b'", () => {
    const allB: ABFlag = { ...enabledFlag, trafficSplit: 100 };
    for (let i = 0; i < 20; i++) {
      expect(assignVariant(allB)).toBe("b");
    }
  });

  it("0% traffic split always assigns 'a'", () => {
    const allA: ABFlag = { ...enabledFlag, trafficSplit: 0 };
    for (let i = 0; i < 20; i++) {
      expect(assignVariant(allA)).toBe("a");
    }
  });
});

describe("getABFlags()", () => {
  beforeEach(() => {
    resetJsonConfigMemory();
  });

  it("returns DEFAULT_FLAGS when D1 app_config has no AB_FLAGS_JSON", async () => {
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });

  it("returns flags stored in D1 app_config", async () => {
    const customFlags: ABFlag[] = [
      {
        id: "custom",
        name: "Custom",
        description: "custom flag",
        enabled: true,
        trafficSplit: 30,
        variants: { a: "A", b: "B" },
      },
    ];
    await writeJsonConfig("AB_FLAGS_JSON", customFlags);
    const result = await getABFlags();
    expect(result).toEqual(customFlags);
  });

  it("falls back to DEFAULT_FLAGS when stored value is not an array", async () => {
    await writeJsonConfig("AB_FLAGS_JSON", { key: "value" });
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });

  it("falls back to DEFAULT_FLAGS when stored array is empty", async () => {
    await writeJsonConfig("AB_FLAGS_JSON", []);
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });
});