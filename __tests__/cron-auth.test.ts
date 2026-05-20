import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock getConfig before importing cron-auth so no AWS calls are made in CI
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ CRON_SECRET: "" }),
}));

import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { getConfig } from "@/lib/ssm-config";

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/test", { headers });
}

describe("isCronAuthorized()", () => {
  const secret = "super-secret-cron-token";

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
    vi.mocked(getConfig).mockResolvedValue({ CRON_SECRET: "" } as any);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  it("returns true when Bearer token matches CRON_SECRET", async () => {
    const req = makeRequest(`Bearer ${secret}`);
    expect(await isCronAuthorized(req)).toBe(true);
  });

  it("returns false when token does not match", async () => {
    const req = makeRequest("Bearer wrong-token");
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("returns false when authorization header is absent", async () => {
    const req = makeRequest();
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("returns false when header is present but missing Bearer prefix", async () => {
    const req = makeRequest(secret);
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("returns false when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const req = makeRequest(`Bearer ${secret}`);
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("is case-sensitive on the token value", async () => {
    const req = makeRequest(`Bearer ${secret.toUpperCase()}`);
    expect(await isCronAuthorized(req)).toBe(false);
  });

  it("uses SSM CRON_SECRET when available, ignoring env var", async () => {
    vi.mocked(getConfig).mockResolvedValue({ CRON_SECRET: secret } as any);
    delete process.env.CRON_SECRET;
    const req = makeRequest(`Bearer ${secret}`);
    expect(await isCronAuthorized(req)).toBe(true);
  });
});

describe("cronUnauthorized()", () => {
  it("returns a 401 response", () => {
    const res = cronUnauthorized();
    expect(res.status).toBe(401);
  });

  it("response body contains error field", async () => {
    const res = cronUnauthorized();
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
