import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getTokenFromHeader, isAdmin, verifyToken, type DecodedToken } from "@/lib/api-auth";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("getTokenFromHeader", () => {
  it("returns null when Authorization header is missing", () => {
    expect(getTokenFromHeader(makeRequest())).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(getTokenFromHeader(makeRequest({ authorization: "Basic abc123" }))).toBeNull();
  });

  it("returns the token for a valid Bearer header", () => {
    const result = getTokenFromHeader(makeRequest({ authorization: "Bearer my-token-abc" }));
    expect(result).toBe("my-token-abc");
  });

  it("returns null when Bearer has no token value", () => {
    const result = getTokenFromHeader(makeRequest({ authorization: "Bearer" }));
    expect(result).toBeNull();
  });
});

describe("isAdmin", () => {
  it("returns false for null", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdmin(undefined)).toBe(false);
  });

  it("returns false when groups is empty", () => {
    const user: DecodedToken = { sub: "u1", groups: [] };
    expect(isAdmin(user)).toBe(false);
  });

  it("returns true when groups includes admin", () => {
    const user: DecodedToken = { sub: "u1", groups: ["admin"] };
    expect(isAdmin(user)).toBe(true);
  });

  it("returns false when groups has non-admin roles", () => {
    const user: DecodedToken = { sub: "u1", groups: ["editor", "viewer"] };
    expect(isAdmin(user)).toBe(false);
  });
});

describe("verifyToken (no D1)", () => {
  it("returns null when D1 is not configured", async () => {
    const result = await verifyToken("fake-session-token");
    expect(result).toBeNull();
  });
});
