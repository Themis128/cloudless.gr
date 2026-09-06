import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, getClientIp, resetRateLimitStore } from "@/lib/rate-limit";

// NODE_ENV is "test" during vitest runs → DEV_MULTIPLIER is 1 (no override needed)

beforeEach(() => {
  resetRateLimitStore();
});

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const result = rateLimit("ip-1", 3, 60_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remaining).toBe(2);
  });

  it("tracks remaining count as requests accumulate", () => {
    rateLimit("ip-2", 5, 60_000);
    rateLimit("ip-2", 5, 60_000);
    const r = rateLimit("ip-2", 5, 60_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(2);
  });

  it("returns ok:false and 429 response when limit is exceeded", async () => {
    for (let i = 0; i < 2; i++) rateLimit("ip-3", 2, 60_000);
    const r = rateLimit("ip-3", 2, 60_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(429);
      const body = await r.response.json();
      expect(body.error).toMatch(/too many/i);
    }
  });

  it("includes Retry-After header", async () => {
    for (let i = 0; i < 3; i++) rateLimit("ip-4", 3, 60_000);
    const r = rateLimit("ip-4", 3, 60_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.headers.get("Retry-After")).toBe("60");
      expect(r.response.headers.get("X-RateLimit-Remaining")).toBe("0");
    }
  });

  it("uses separate buckets for different keys", () => {
    for (let i = 0; i < 2; i++) rateLimit("ip-a", 2, 60_000);
    // ip-a is now at limit; ip-b should still be ok
    const rA = rateLimit("ip-a", 2, 60_000);
    const rB = rateLimit("ip-b", 2, 60_000);
    expect(rA.ok).toBe(false);
    expect(rB.ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("returns first IP from X-Forwarded-For header", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when X-Forwarded-For is absent", () => {
    const req = new Request("http://localhost/api");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("resetRateLimitStore", () => {
  it("clears all tracked keys", () => {
    for (let i = 0; i < 3; i++) rateLimit("reset-key", 3, 60_000);
    const before = rateLimit("reset-key", 3, 60_000);
    expect(before.ok).toBe(false);
    resetRateLimitStore();
    const after = rateLimit("reset-key", 3, 60_000);
    expect(after.ok).toBe(true);
  });
});
