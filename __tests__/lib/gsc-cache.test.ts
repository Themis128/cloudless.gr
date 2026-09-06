import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import { paramsHash, getCached, setCached, readThrough } from "@/lib/gsc-cache";

describe("paramsHash", () => {
  it("returns 'default' for empty params", () => {
    expect(paramsHash({})).toBe("default");
    expect(paramsHash()).toBe("default");
  });

  it("returns a hex string for non-empty params", () => {
    const hash = paramsHash({ site: "cloudless.gr" });
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    expect(paramsHash({ a: 1, b: 2 })).toBe(paramsHash({ b: 2, a: 1 }));
  });

  it("differs for different params", () => {
    expect(paramsHash({ x: 1 })).not.toBe(paramsHash({ x: 2 }));
  });
});

describe("getCached (no D1)", () => {
  it("returns null when AUTH_DB is not configured", async () => {
    expect(await getCached("gsc", {})).toBeNull();
  });
});

describe("setCached (no D1)", () => {
  it("resolves without error", async () => {
    await expect(setCached("gsc", {}, { data: "value" })).resolves.toBeUndefined();
  });
});

describe("readThrough (no D1)", () => {
  it("calls the fetcher and returns its value", async () => {
    const fetcher = vi.fn().mockResolvedValue({ clicks: 42 });
    const result = await readThrough("gsc", {}, fetcher);
    expect(result.value).toEqual({ clicks: 42 });
    expect(result.source).toBe("live");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
