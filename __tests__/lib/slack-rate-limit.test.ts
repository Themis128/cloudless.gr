import { describe, it, expect, beforeEach } from "vitest";
import { checkSlackRateLimit, resetRateLimiter } from "@/lib/slack-rate-limit";

beforeEach(() => {
  resetRateLimiter();
});

describe("checkSlackRateLimit", () => {
  it("allows the first request for a key", () => {
    expect(checkSlackRateLimit("team-1")).toBe(true);
  });

  it("allows multiple requests up to the limit", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkSlackRateLimit("team-2")).toBe(true);
    }
  });

  it("blocks the 61st request within the window", () => {
    for (let i = 0; i < 60; i++) {
      checkSlackRateLimit("team-3");
    }
    expect(checkSlackRateLimit("team-3")).toBe(false);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 60; i++) checkSlackRateLimit("team-a");
    expect(checkSlackRateLimit("team-a")).toBe(false);
    expect(checkSlackRateLimit("team-b")).toBe(true);
  });
});

describe("resetRateLimiter", () => {
  it("clears all stored keys", () => {
    for (let i = 0; i < 60; i++) checkSlackRateLimit("team-x");
    expect(checkSlackRateLimit("team-x")).toBe(false);
    resetRateLimiter();
    expect(checkSlackRateLimit("team-x")).toBe(true);
  });
});
