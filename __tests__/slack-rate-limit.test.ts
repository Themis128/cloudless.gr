import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkSlackRateLimit, resetRateLimiter } from "@/lib/slack-rate-limit";

describe("slack-rate-limit", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("admits the first request for a fresh key", () => {
    expect(checkSlackRateLimit("team-A")).toBe(true);
  });

  it("isolates buckets per key", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkSlackRateLimit("team-A")).toBe(true);
    }
    // team-A is exhausted; team-B is independent.
    expect(checkSlackRateLimit("team-A")).toBe(false);
    expect(checkSlackRateLimit("team-B")).toBe(true);
  });

  it("rejects the 61st request inside the same 60s window", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkSlackRateLimit("team-A")).toBe(true);
    }
    expect(checkSlackRateLimit("team-A")).toBe(false);
  });

  it("re-admits once the window slides past", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkSlackRateLimit("team-A")).toBe(true);
    }
    expect(checkSlackRateLimit("team-A")).toBe(false);

    // Advance just past the 60s window.
    vi.advanceTimersByTime(60_001);
    expect(checkSlackRateLimit("team-A")).toBe(true);
  });

  it("resetRateLimiter wipes all state", () => {
    for (let i = 0; i < 60; i++) checkSlackRateLimit("team-A");
    expect(checkSlackRateLimit("team-A")).toBe(false);

    resetRateLimiter();
    expect(checkSlackRateLimit("team-A")).toBe(true);
  });

  it("evicts expired entries while still rejecting requests in a partial window", () => {
    // Fill the bucket halfway.
    for (let i = 0; i < 40; i++) {
      expect(checkSlackRateLimit("team-A")).toBe(true);
    }
    // Advance 30s. Those 40 timestamps are still inside the 60s window.
    vi.advanceTimersByTime(30_000);
    // Add another 20 — bucket now has 60 valid timestamps.
    for (let i = 0; i < 20; i++) {
      expect(checkSlackRateLimit("team-A")).toBe(true);
    }
    // 61st should be rejected.
    expect(checkSlackRateLimit("team-A")).toBe(false);

    // Advance past the first batch's window (totals: 60s+1ms after first
    // batch); the first 40 timestamps drop out and we can admit again.
    vi.advanceTimersByTime(30_001);
    expect(checkSlackRateLimit("team-A")).toBe(true);
  });
});
