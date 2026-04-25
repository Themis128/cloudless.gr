import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function makeExpiredJwt(extraClaims: Record<string, unknown> = {}): string {
  return makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 3600, ...extraClaims });
}

function makeValidJwt(extraClaims: Record<string, unknown> = {}): string {
  return makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600, ...extraClaims });
}

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("api-auth.ts (fallback path — no Cognito pool)", () => {
  beforeEach(() => {
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  });

  describe("getTokenFromHeader()", () => {
    it("returns null when no authorization header is present", async () => {
      const { getTokenFromHeader } = await import("@/lib/api-auth");
      expect(getTokenFromHeader(makeRequest())).toBeNull();
    });

    it("returns null when scheme is not Bearer", async () => {
      const { getTokenFromHeader } = await import("@/lib/api-auth");
      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(getTokenFromHeader(req)).toBeNull();
    });

    it("returns the token string when header is valid", async () => {
      const { getTokenFromHeader } = await import("@/lib/api-auth");
      expect(getTokenFromHeader(makeRequest("my-token-123"))).toBe("my-token-123");
    });
  });

  describe("verifyToken() — fallback path (no JWKS)", () => {
    it("returns null for a malformed token", async () => {
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken("not.a.valid.jwt.here")).toBeNull();
    });

    it("returns null for an expired token", async () => {
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken(makeExpiredJwt())).toBeNull();
    });

    it("returns payload for a non-expired token", async () => {
      const { verifyToken } = await import("@/lib/api-auth");
      const result = await verifyToken(makeValidJwt({ email: "test@example.com" }));
      expect(result).not.toBeNull();
      expect(result!.sub).toBe("user-1");
      expect(result!.email).toBe("test@example.com");
    });

    it("returns payload when exp is not set (no expiry check)", async () => {
      const { verifyToken } = await import("@/lib/api-auth");
      const jwt = makeJwt({ sub: "user-2" });
      const result = await verifyToken(jwt);
      expect(result).not.toBeNull();
      expect(result!.sub).toBe("user-2");
    });
  });

  describe("isAdmin()", () => {
    it("returns false for null", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin(null)).toBe(false);
    });

    it("returns false when cognito:groups is absent", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = { sub: "u", aud: "a", iss: "i", iat: 0, exp: 9999999999 };
      expect(isAdmin(decoded)).toBe(false);
    });

    it("returns false when user is not in admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u", aud: "a", iss: "i", iat: 0, exp: 9999999999,
        "cognito:groups": ["users", "editors"],
      };
      expect(isAdmin(decoded)).toBe(false);
    });

    it("returns true when user is in admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u", aud: "a", iss: "i", iat: 0, exp: 9999999999,
        "cognito:groups": ["users", "admin"],
      };
      expect(isAdmin(decoded)).toBe(true);
    });
  });

  describe("requireAuth()", () => {
    it("returns 401 when no token in header", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns 401 for expired token", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest(makeExpiredJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns ok:true with user for valid token", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest(makeValidJwt({ email: "x@x.com" })));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("user-1");
    });
  });

  describe("requireAdmin()", () => {
    it("returns 403 when user is not in admin group", async () => {
      const { requireAdmin } = await import("@/lib/api-auth");
      const result = await requireAdmin(makeRequest(makeValidJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("returns ok:true for a valid admin token", async () => {
      const { requireAdmin } = await import("@/lib/api-auth");
      const token = makeValidJwt({ "cognito:groups": ["admin"] });
      const result = await requireAdmin(makeRequest(token));
      expect(result.ok).toBe(true);
    });
  });
});
