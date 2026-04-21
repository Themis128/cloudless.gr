import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, getClientIp, resetRateLimitStore } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const result = rateLimit("test-key", 3, 60_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remaining).toBe(2);
  });

  it("tracks remaining count correctly", () => {
    rateLimit("key", 5, 60_000);
    rateLimit("key", 5, 60_000);
    const result = rateLimit("key", 5, 60_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remaining).toBe(2);
  });

  it("blocks requests at the limit", () => {
    rateLimit("block-key", 2, 60_000);
    rateLimit("block-key", 2, 60_000);
    const result = rateLimit("block-key", 2, 60_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  it("429 response has Retry-After header", async () => {
    rateLimit("hdr-key", 1, 60_000);
    rateLimit("hdr-key", 1, 60_000);
    const result = rateLimit("hdr-key", 1, 60_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.headers.get("Retry-After")).toBe("60");
      expect(result.response.headers.get("X-RateLimit-Limit")).toBe("1");
      expect(result.response.headers.get("X-RateLimit-Remaining")).toBe("0");
    }
  });

  it("uses separate counters per key", () => {
    rateLimit("key-a", 1, 60_000);
    rateLimit("key-a", 1, 60_000); // over limit for a
    const resultB = rateLimit("key-b", 1, 60_000); // b is fresh
    expect(resultB.ok).toBe(true);
  });

  it("resets cleanly via resetRateLimitStore", () => {
    rateLimit("reset-key", 1, 60_000);
    rateLimit("reset-key", 1, 60_000); // over limit
    resetRateLimitStore();
    const result = rateLimit("reset-key", 1, 60_000); // should be allowed again
    expect(result.ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("extracts first IP from X-Forwarded-For", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-Forwarded-For": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to 'unknown' when header is absent", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe("unknown");
  });
});
