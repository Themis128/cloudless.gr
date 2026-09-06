import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
}));

import { safeEqual, isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";

function makeReq(auth?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  mockGetConfig.mockReset();
  delete process.env.CRON_SECRET;
});

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeEqual("abc", "xyz")).toBe(false);
  });

  it("returns false for different lengths (early exit)", () => {
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("isCronAuthorized", () => {
  it("returns false when no secret configured", async () => {
    mockGetConfig.mockResolvedValue({});
    const req = makeReq("Bearer mysecret");
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("returns false when authorization header is missing", async () => {
    mockGetConfig.mockResolvedValue({ CRON_SECRET: "secret123" });
    expect(await isCronAuthorized(makeReq())).toBe(false);
  });

  it("returns false when header doesn't start with Bearer", async () => {
    mockGetConfig.mockResolvedValue({ CRON_SECRET: "secret123" });
    expect(await isCronAuthorized(makeReq("Basic secret123"))).toBe(false);
  });

  it("returns false when token doesn't match secret", async () => {
    mockGetConfig.mockResolvedValue({ CRON_SECRET: "correct" });
    expect(await isCronAuthorized(makeReq("Bearer wrong"))).toBe(false);
  });

  it("returns true when token matches SSM secret", async () => {
    mockGetConfig.mockResolvedValue({ CRON_SECRET: "mys3cret" });
    expect(await isCronAuthorized(makeReq("Bearer mys3cret"))).toBe(true);
  });

  it("falls back to process.env.CRON_SECRET when SSM returns nothing", async () => {
    mockGetConfig.mockResolvedValue({});
    process.env.CRON_SECRET = "env-secret";
    expect(await isCronAuthorized(makeReq("Bearer env-secret"))).toBe(true);
    delete process.env.CRON_SECRET;
  });
});

describe("cronUnauthorized", () => {
  it("returns 401 JSON response", async () => {
    const res = cronUnauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
