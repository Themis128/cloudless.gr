import { describe, it, expect, vi, beforeEach } from "vitest";
import { cached, invalidateCache } from "@/lib/notion-cache";

describe("notion-cache.ts", () => {
  beforeEach(() => {
    invalidateCache();
  });

  describe("cached()", () => {
    it("calls fetcher on first access and returns data", async () => {
      const fetcher = vi.fn().mockResolvedValue({ posts: [1, 2, 3] });
      const result = await cached("blog:posts", fetcher);
      expect(result).toEqual({ posts: [1, 2, 3] });
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it("returns cached data on second call without calling fetcher again", async () => {
      const fetcher = vi.fn().mockResolvedValue("cached-value");
      await cached("test-key", fetcher);
      const second = await cached("test-key", fetcher);
      expect(second).toBe("cached-value");
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it("re-fetches after TTL expires", async () => {
      vi.useFakeTimers();
      const fetcher = vi.fn().mockResolvedValue("fresh");
      await cached("ttl-key", fetcher, 100);
      vi.advanceTimersByTime(200);
      await cached("ttl-key", fetcher, 100);
      expect(fetcher).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("serves cache before TTL expires", async () => {
      vi.useFakeTimers();
      const fetcher = vi.fn().mockResolvedValue("v");
      await cached("ttl-key2", fetcher, 1000);
      vi.advanceTimersByTime(500);
      await cached("ttl-key2", fetcher, 1000);
      expect(fetcher).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });

    it("different keys are cached independently", async () => {
      const fa = vi.fn().mockResolvedValue("a");
      const fb = vi.fn().mockResolvedValue("b");
      const [a, b] = await Promise.all([cached("key-a", fa), cached("key-b", fb)]);
      expect(a).toBe("a");
      expect(b).toBe("b");
      await cached("key-a", fa);
      await cached("key-b", fb);
      expect(fa).toHaveBeenCalledOnce();
      expect(fb).toHaveBeenCalledOnce();
    });

    it("works with complex return types", async () => {
      const data = [{ id: 1, title: "Post" }];
      const fetcher = vi.fn().mockResolvedValue(data);
      const result = await cached("complex", fetcher);
      expect(result).toEqual(data);
    });
  });

  describe("invalidateCache()", () => {
    it("clears all keys when called with no argument", async () => {
      const fetcher = vi.fn().mockResolvedValue("v");
      await cached("k1", fetcher);
      await cached("k2", fetcher);
      invalidateCache();
      await cached("k1", fetcher);
      await cached("k2", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it("clears only the exact key when called with a specific key", async () => {
      const fetcher = vi.fn().mockResolvedValue("v");
      await cached("blog:posts", fetcher);
      await cached("blog:drafts", fetcher);
      invalidateCache("blog:posts");
      await cached("blog:posts", fetcher);
      await cached("blog:drafts", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("clears keys matching a prefix", async () => {
      const fetcher = vi.fn().mockResolvedValue("v");
      await cached("notion:blog:1", fetcher);
      await cached("notion:blog:2", fetcher);
      await cached("stripe:products", fetcher);
      invalidateCache("notion:blog");
      await cached("notion:blog:1", fetcher);
      await cached("notion:blog:2", fetcher);
      await cached("stripe:products", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(5);
    });

    it("does nothing when called with a key that does not exist", () => {
      expect(() => invalidateCache("nonexistent-key")).not.toThrow();
    });
  });
});
