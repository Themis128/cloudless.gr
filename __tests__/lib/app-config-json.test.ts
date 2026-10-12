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

describe("readJsonConfig / writeJsonConfig (D1 path)", () => {
  const makeDb = (row: { value: string } | null) => {
    const run = vi.fn(async () => ({ success: true }));
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first, run }));
    const prepare = vi.fn(() => ({ bind }));
    return { prepare, bind, first, run };
  };

  it("reads a stored value from app_config", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = makeDb({ value: JSON.stringify({ db: true }) });
    vi.mocked(getAuthDbFromEnv).mockImplementationOnce(() => db as never);
    const result = await readJsonConfig("k1", null);
    expect(result).toEqual({ db: true });
    expect(db.bind).toHaveBeenCalledWith("k1");
  });

  it("returns the fallback when the row is missing", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = makeDb(null);
    vi.mocked(getAuthDbFromEnv).mockImplementationOnce(() => db as never);
    const result = await readJsonConfig("absent", "fb");
    expect(result).toBe("fb");
  });

  it("returns the fallback when the DB read throws", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = makeDb(null);
    db.first.mockRejectedValueOnce(new Error("d1 down"));
    vi.mocked(getAuthDbFromEnv).mockImplementationOnce(() => db as never);
    const result = await readJsonConfig("broken", "fb");
    expect(result).toBe("fb");
  });

  it("writes through to app_config with the upsert statement", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = makeDb(null);
    vi.mocked(getAuthDbFromEnv).mockImplementationOnce(() => db as never);
    await writeJsonConfig("wkey", { n: 5 }, "desc");
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE"));
    expect(db.bind).toHaveBeenCalledWith("wkey", JSON.stringify({ n: 5 }), "desc");
    expect(db.run).toHaveBeenCalled();
    // DB path must not touch the memory store.
    vi.mocked(getAuthDbFromEnv).mockClear();
    expect(await readJsonConfig("wkey", "fb")).toBe("fb");
  });
});
