import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_FLAGS, assignVariant, getABFlags } from "@/lib/ab-flags";
import type { ABFlag } from "@/lib/ab-flags";

// Mock the entire module at the top level
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(),
  resetSsmCache: vi.fn(),
}));

import { getConfig } from "@/lib/ssm-config";
const mockGetConfig = vi.mocked(getConfig);

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
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("returns DEFAULT_FLAGS when SSM returns no AB_FLAGS_JSON", async () => {
    vi.mocked(mockGetConfig).mockResolvedValue({});
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });

  it("returns parsed flags from SSM when AB_FLAGS_JSON is set", async () => {
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
    vi.mocked(mockGetConfig).mockResolvedValue({
      AB_FLAGS_JSON: JSON.stringify(customFlags),
    });
    const result = await getABFlags();
    expect(result).toEqual(customFlags);
  });

  it("falls back to DEFAULT_FLAGS when AB_FLAGS_JSON is invalid JSON", async () => {
    vi.mocked(mockGetConfig).mockResolvedValue({ AB_FLAGS_JSON: "not-json{" });
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });

  it("falls back to DEFAULT_FLAGS when AB_FLAGS_JSON is not an array", async () => {
    vi.mocked(mockGetConfig).mockResolvedValue({ AB_FLAGS_JSON: '{"key": "value"}' });
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });

  it("falls back to DEFAULT_FLAGS when getConfig throws", async () => {
    vi.mocked(mockGetConfig).mockRejectedValue(new Error("SSM unavailable"));
    const result = await getABFlags();
    expect(result).toEqual(DEFAULT_FLAGS);
  });
});