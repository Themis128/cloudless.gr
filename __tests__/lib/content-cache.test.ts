import { describe, it, expect, vi, beforeEach } from "vitest";
import { cached, invalidateCache } from "@/lib/content-cache";

beforeEach(() => {
  invalidateCache(); // clear all between tests
  vi.clearAllMocks();
});

describe("cached", () => {
  it("calls fetcher on first access", async () => {
    const fetcher = vi.fn().mockResolvedValue("data-1");
    const result = await cached("key-1", fetcher);
    expect(result).toBe("data-1");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("returns cached value on second access", async () => {
    const fetcher = vi.fn().mockResolvedValue("data-2");
    await cached("key-2", fetcher);
    const result = await cached("key-2", fetcher);
    expect(result).toBe("data-2");
    expect(fetcher).toHaveBeenCalledOnce(); // not called again
  });

  it("returns fresh value after TTL expires", async () => {
    const fetcher = vi.fn().mockResolvedValue("data-3");
    await cached("key-3", fetcher, 0); // 0ms TTL expires immediately
    const result = await cached("key-3", fetcher, 0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe("data-3");
  });

  it("deduplicates concurrent calls with the same key", async () => {
    let resolveCount = 0;
    const fetcher = vi.fn(async () => {
      resolveCount++;
      return "concurrent-data";
    });
    const [a, b] = await Promise.all([
      cached("key-concurrent", fetcher, 60_000),
      cached("key-concurrent", fetcher, 60_000),
    ]);
    expect(a).toBe("concurrent-data");
    expect(b).toBe("concurrent-data");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("propagates fetcher errors", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("fetch failed"));
    await expect(cached("key-err", fetcher)).rejects.toThrow("fetch failed");
  });
});

describe("invalidateCache", () => {
  it("invalidates a specific key", async () => {
    const fetcher = vi.fn().mockResolvedValue("val");
    await cached("inv-key", fetcher);
    invalidateCache("inv-key");
    await cached("inv-key", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidates all keys sharing a prefix", async () => {
    const fetcher = vi.fn().mockResolvedValue("val");
    await cached("blog:posts", fetcher);
    await cached("blog:post:slug-1", fetcher);
    await cached("docs:all", fetcher);
    invalidateCache("blog");
    await cached("blog:posts", fetcher);
    await cached("blog:post:slug-1", fetcher);
    await cached("docs:all", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(5); // docs:all not re-fetched
  });

  it("clears all keys when called without argument", async () => {
    const fetcher = vi.fn().mockResolvedValue("val");
    await cached("key-a", fetcher);
    await cached("key-b", fetcher);
    invalidateCache();
    await cached("key-a", fetcher);
    await cached("key-b", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
