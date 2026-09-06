import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import { paramsHash, getCached, setCached } from "@/lib/espocrm-cache";

describe("paramsHash", () => {
  it("returns 'default' for empty params", () => {
    expect(paramsHash({})).toBe("default");
    expect(paramsHash()).toBe("default");
  });

  it("returns a hex string for non-empty params", () => {
    const hash = paramsHash({ foo: "bar" });
    expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true);
  });

  it("is deterministic for the same params", () => {
    const a = paramsHash({ a: 1, b: 2 });
    const b = paramsHash({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("produces different hashes for different params", () => {
    const a = paramsHash({ key: "val1" });
    const b = paramsHash({ key: "val2" });
    expect(a).not.toBe(b);
  });

  it("ignores null and undefined values", () => {
    const a = paramsHash({ a: 1 });
    const b = paramsHash({ a: 1, b: null, c: undefined });
    expect(a).toBe(b);
  });
});

describe("getCached (no D1)", () => {
  it("returns null when AUTH_DB is not configured", async () => {
    const result = await getCached("pipeline", {});
    expect(result).toBeNull();
  });
});

describe("setCached (no D1)", () => {
  it("resolves without error when AUTH_DB is not configured", async () => {
    await expect(setCached("pipeline", {}, { total: 5 })).resolves.toBeUndefined();
  });
});
