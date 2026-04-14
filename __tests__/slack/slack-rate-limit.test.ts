import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkSlackRateLimit, resetRateLimiter } from "@/lib/slack-rate-limit";

describe("checkSlackRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the 60-request limit", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkSlackRateLimit("T_WITHIN")).toBe(true);
    }
  });

  it("rejects the 61st request within the same 60-second window", () => {
    for (let i = 0; i < 60; i++) {
      checkSlackRateLimit("T_EXCEED");
    }
    expect(checkSlackRateLimit("T_EXCEED")).toBe(false);
  });

  it("different keys are tracked independently", () => {
    // Exhaust team1
    for (let i = 0; i < 60; i++) {
      checkSlackRateLimit("T_TEAM1");
    }
    expect(checkSlackRateLimit("T_TEAM1")).toBe(false);

    // team2 is unaffected
    expect(checkSlackRateLimit("T_TEAM2")).toBe(true);
  });

  it("resetRateLimiter clears all state so limits reset", () => {
    for (let i = 0; i < 60; i++) {
      checkSlackRateLimit("T_RESET");
    }
    expect(checkSlackRateLimit("T_RESET")).toBe(false);

    resetRateLimiter();

    expect(checkSlackRateLimit("T_RESET")).toBe(true);
  });

  it("old requests expire and free up capacity (sliding window)", () => {
    // Fill the window
    for (let i = 0; i < 60; i++) {
      checkSlackRateLimit("T_SLIDE");
    }
    expect(checkSlackRateLimit("T_SLIDE")).toBe(false);

    // Advance past the 60-second window so all old timestamps expire
    vi.advanceTimersByTime(61 * 1000);

    // Now the bucket should be empty and new requests are allowed
    expect(checkSlackRateLimit("T_SLIDE")).toBe(true);
  });

  it("only requests within the window count toward the limit", () => {
    // Make 30 requests, then advance 30 seconds
    for (let i = 0; i < 30; i++) {
      checkSlackRateLimit("T_PARTIAL");
    }
    vi.advanceTimersByTime(30 * 1000);

    // Another 30 requests — total 60 in the last 60s, still at limit
    for (let i = 0; i < 30; i++) {
      checkSlackRateLimit("T_PARTIAL");
    }
    // The 61st should be rejected
    expect(checkSlackRateLimit("T_PARTIAL")).toBe(false);

    // Advance another 31 seconds — first batch of 30 is now outside the window
    vi.advanceTimersByTime(31 * 1000);

    // Only 30 requests remain in the window, so 30 more are allowed
    expect(checkSlackRateLimit("T_PARTIAL")).toBe(true);
  });
});
