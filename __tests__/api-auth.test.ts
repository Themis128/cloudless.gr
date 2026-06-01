import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock @/lib/auth so readSessionCookie() is controllable in tests.
// vi.mock is hoisted — the factory runs before any imports.
const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

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
    // Reset the entire mock (clears queued Once values + call history) then set
    // the default: no session. Tests that need a session configure mockOnce() explicitly.
    authMock.mockReset();
    authMock.mockResolvedValue(null);
    // Clear the issuer so verifyToken takes the decode-only fallback path.
    // (Global setup.ts already does this + resetJwksCache(); belt-and-suspenders.)
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
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

    it("returns true when user has the realm:admin role", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
        realm_access: { roles: ["realm:admin"] },
      };
      expect(isAdmin(decoded)).toBe(true);
    });
  });

  describe("requireAuth() — Bearer token path", () => {
    it("returns 401 when no token in header and no session cookie", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns 401 for expired Bearer token", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest(makeExpiredJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns ok:true with user for valid Bearer token", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest(makeValidJwt({ email: "x@x.com" })));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("user-1");
    });
  });

  describe("requireAuth() — session cookie path (no Bearer header)", () => {
    it("returns ok:true when next-auth session provides a valid user", async () => {
      // Reset modules so api-auth re-imports @/lib/auth with our mock applied.
      vi.resetModules();
      authMock.mockResolvedValueOnce({
        user: { id: "session-user-1", email: "user@cloudless.gr", groups: [], roles: [] },
      });
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAuth(makeRequest()); // no Bearer header
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe("session-user-1");
        expect(result.user.email).toBe("user@cloudless.gr");
      }
    });

    it("returns 401 when auth() returns null (no active session)", async () => {
      vi.resetModules();
      authMock.mockResolvedValueOnce(null);
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns 401 when auth() throws (e.g. misconfigured next-auth)", async () => {
      vi.resetModules();
      authMock.mockRejectedValueOnce(new Error("auth config missing"));
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("Bearer token takes priority over session cookie when both are present", async () => {
      vi.resetModules();
      authMock.mockResolvedValueOnce({
        user: { id: "session-user", email: "session@cloudless.gr", groups: [], roles: [] },
      });
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      // Send a valid Bearer token — it should win over the session mock
      const result = await requireAuth(makeRequest(makeValidJwt({ email: "bearer@cloudless.gr" })));
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The Bearer token's sub/email, NOT the session mock values
        expect(result.user.sub).toBe("user-1");
        expect(result.user.email).toBe("bearer@cloudless.gr");
      }
    });
  });

  describe("requireAdmin()", () => {
    it("returns 403 when Bearer token user is not in admin group", async () => {
      const { requireAdmin } = await import("@/lib/api-auth");
      const result = await requireAdmin(makeRequest(makeValidJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("returns ok:true for a valid admin Bearer token (Keycloak groups claim)", async () => {
      const { requireAdmin } = await import("@/lib/api-auth");
      const token = makeValidJwt({ groups: ["admin"] });
      const result = await requireAdmin(makeRequest(token));
      expect(result.ok).toBe(true);
    });

    it("returns ok:true when session cookie user is in the admin group", async () => {
      vi.resetModules();
      authMock.mockResolvedValueOnce({
        user: {
          id: "admin-1",
          email: "admin@cloudless.gr",
          groups: ["admin"],
          roles: [],
        },
      });
      const { requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAdmin(makeRequest()); // no Bearer header
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("admin-1");
    });

    it("returns 403 when session cookie user is not in admin group", async () => {
      vi.resetModules();
      authMock.mockResolvedValueOnce({
        user: { id: "plain-user", email: "user@cloudless.gr", groups: [], roles: [] },
      });
      const { requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAdmin(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });
  });
});
