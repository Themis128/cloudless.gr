import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/test", { headers });
}

describe("isCronAuthorized()", () => {
  const secret = "super-secret-cron-token";

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns true when Bearer token matches CRON_SECRET", () => {
    const req = makeRequest(`Bearer ${secret}`);
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("returns false when token does not match", () => {
    const req = makeRequest("Bearer wrong-token");
    expect(isCronAuthorized(req)).toBe(false);
  });

  it("returns false when authorization header is absent", () => {
    const req = makeRequest();
    expect(isCronAuthorized(req)).toBe(false);
  });

  it("returns false when header is present but missing Bearer prefix", () => {
    const req = makeRequest(secret);
    expect(isCronAuthorized(req)).toBe(false);
  });

  it("returns false when CRON_SECRET is not set", () => {
    delete process.env.CRON_SECRET;
    const req = makeRequest(`Bearer ${secret}`);
    expect(isCronAuthorized(req)).toBe(false);
  });

  it("is case-sensitive on the token value", () => {
    const req = makeRequest(`Bearer ${secret.toUpperCase()}`);
    expect(isCronAuthorized(req)).toBe(false);
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
