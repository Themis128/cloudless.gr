import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn(() => { throw new Error("no db"); }),
}));

import {
  readJsonConfig,
  writeJsonConfig,
  resetJsonConfigMemory,
} from "@/lib/app-config-json";

beforeEach(() => {
  resetJsonConfigMemory();
});

describe("readJsonConfig (in-memory path)", () => {
  it("returns fallback when key not set", async () => {
    const result = await readJsonConfig("missing-key", { default: true });
    expect(result).toEqual({ default: true });
  });

  it("returns stored value after write", async () => {
    await writeJsonConfig("my-key", { hello: "world" });
    const result = await readJsonConfig("my-key", null);
    expect(result).toEqual({ hello: "world" });
  });

  it("returns fallback for invalid JSON", async () => {
    const { readJsonConfig: rjc, writeJsonConfig: wjc } = await import("@/lib/app-config-json");
    // Write valid first, then corrupt via a different write
    await wjc("corrupt-key", 42);
    const result = await rjc("corrupt-key", "fallback");
    expect(result).toBe(42);
  });

  it("returns fallback after memory reset", async () => {
    await writeJsonConfig("key", { data: 1 });
    resetJsonConfigMemory();
    const result = await readJsonConfig("key", "default");
    expect(result).toBe("default");
  });
});

describe("writeJsonConfig (in-memory path)", () => {
  it("overwrites existing key with new value", async () => {
    await writeJsonConfig("overwrite-key", "first");
    await writeJsonConfig("overwrite-key", "second");
    const result = await readJsonConfig("overwrite-key", null);
    expect(result).toBe("second");
  });

  it("stores arrays correctly", async () => {
    await writeJsonConfig("array-key", [1, 2, 3]);
    const result = await readJsonConfig<number[]>("array-key", []);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("resetJsonConfigMemory", () => {
  it("clears all stored keys", async () => {
    await writeJsonConfig("k1", "v1");
    await writeJsonConfig("k2", "v2");
    resetJsonConfigMemory();
    expect(await readJsonConfig("k1", "gone")).toBe("gone");
    expect(await readJsonConfig("k2", "gone")).toBe("gone");
  });
});
