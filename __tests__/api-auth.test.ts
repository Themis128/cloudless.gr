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

describe("api-auth.ts (fallback path — no Keycloak issuer)", () => {
  beforeEach(() => {
    // Clear the issuer/pool so verifyToken takes the decode-only fallback path
    // (no JWKS), which is what these fake-signature fixtures exercise.
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
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

    it("fails closed in production even with no JWKS (never decodes unverified)", async () => {
      const prev = process.env.NODE_ENV;
      // @ts-expect-error — NODE_ENV is readonly in types but writable at runtime
      process.env.NODE_ENV = "production";
      try {
        const { verifyToken } = await import("@/lib/api-auth");
        // A perfectly well-formed, non-expired token must still be rejected:
        // production never trusts an unverified decode.
        expect(await verifyToken(makeValidJwt({ email: "x@x.com" }))).toBeNull();
      } finally {
        // @ts-expect-error — restore
        process.env.NODE_ENV = prev;
      }
    });
  });

  describe("isAdmin()", () => {
    it("returns false for null", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin(null)).toBe(false);
    });

    it("returns false when no group/role claim is present", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = { sub: "u", aud: "a", iss: "i", iat: 0, exp: 9999999999 };
      expect(isAdmin(decoded)).toBe(false);
    });

    it("returns false when user is not in the admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
        groups: ["users", "editors"],
      };
      expect(isAdmin(decoded)).toBe(false);
    });

    it("returns true when user is in the Keycloak admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
        groups: ["users", "admin"],
      };
      expect(isAdmin(decoded)).toBe(true);
    });

    it("returns true when user has the admin realm role", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
        realm_access: { roles: ["offline_access", "admin"] },
      };
      expect(isAdmin(decoded)).toBe(true);
    });

    it("still honors the legacy cognito:groups claim (back-compat)", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
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

    it("returns ok:true for a valid admin token (Keycloak groups claim)", async () => {
      const { requireAdmin } = await import("@/lib/api-auth");
      const token = makeValidJwt({ groups: ["admin"] });
      const result = await requireAdmin(makeRequest(token));
      expect(result.ok).toBe(true);
    });
  });
});
