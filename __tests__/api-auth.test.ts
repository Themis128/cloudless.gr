import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

describe("api-auth.ts (fallback path — decode-only, no issuer)", () => {
  beforeEach(() => {
    // Reset the entire mock (clears queued Once values + call history) then set
    // the default: no session. Tests that need a session configure mockOnce() explicitly.
    authMock.mockReset();
    authMock.mockResolvedValue(null);
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    // Clear the issuer so verifyToken takes the decode-only fallback path.
    // (Global setup.ts already does this + resetJwksCache(); belt-and-suspenders.)
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

    it("returns true when user is in the admin group", async () => {
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

    it("returns true when user is in the Cognito admin group (cognito:groups)", async () => {
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

    it("returns false for a non-admin Cognito group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      const decoded = {
        sub: "u",
        aud: "a",
        iss: "i",
        iat: 0,
        exp: 9999999999,
        "cognito:groups": ["users"],
      };
      expect(isAdmin(decoded)).toBe(false);
    });
  });

  describe("requireAuth() — Bearer token path", () => {
    it("returns 401 when no token in header and no session cookie", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns 401 for expired Bearer token (cognito provider)", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAuth(makeRequest(makeExpiredJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("returns ok:true with user for valid Bearer token (cognito provider)", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAuth(makeRequest(makeValidJwt({ email: "x@x.com" })));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("user-1");
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("D1 mode: opaque Bearer session id authenticates without Cognito JWKS", async () => {
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
      process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LEFTOVER";
      vi.resetModules();
      vi.doMock("@/lib/auth-d1", () => ({
        getAuthDbFromEnv: () => ({ prepare: vi.fn() }),
        getUserBySession: vi.fn().mockResolvedValue({
          id: "d1-bearer",
          email: "bearer@d1.test",
          name: "Bearer D1",
        }),
        isAdmin: vi.fn().mockResolvedValue(false),
      }));
      const { requireAuth, resetJwksCache, isCognitoAuthEnabled } = await import("@/lib/api-auth");
      resetJwksCache();
      expect(isCognitoAuthEnabled()).toBe(false);
      const result = await requireAuth(makeRequest("opaque-session-id"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("d1-bearer");
      delete process.env.COGNITO_ISSUER;
    });

    it("D1 mode: stale Cognito JWT Bearer falls through to session_token cookie", async () => {
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
      vi.resetModules();
      vi.doMock("@/lib/auth-d1", () => ({
        getAuthDbFromEnv: () => ({ prepare: vi.fn() }),
        getUserBySession: vi.fn().mockImplementation((_db: unknown, sid: string) => {
          if (sid === "good-cookie") {
            return Promise.resolve({ id: "from-cookie", email: "c@d1.test", name: null });
          }
          return Promise.resolve(null);
        }),
        isAdmin: vi.fn().mockResolvedValue(false),
      }));
      const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const req = new NextRequest("http://localhost/api/test", {
        headers: {
          authorization: `Bearer ${makeValidJwt({ email: "stale@cognito.test" })}`,
          cookie: "session_token=good-cookie",
        },
      });
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("from-cookie");
    });
  });

  describe("requireAuth() — D1 session_token cookie", () => {
    it("returns ok:true with admin groups when D1 session is admin", async () => {
      vi.resetModules();
      authMock.mockResolvedValue(null);
      vi.doMock("@/lib/auth-d1", () => ({
        getAuthDbFromEnv: () => ({ prepare: vi.fn() }),
        getUserBySession: vi.fn().mockResolvedValue({
          id: "d1-admin",
          email: "admin@d1.test",
          name: "D1 Admin",
        }),
        isAdmin: vi.fn().mockResolvedValue(true),
      }));
      const { requireAuth, requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const req = new NextRequest("http://localhost/api/test", {
        headers: { cookie: "session_token=d1-session-abc" },
      });
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe("d1-admin");
        expect(result.user.groups).toContain("admin");
      }
      const admin = await requireAdmin(req);
      expect(admin.ok).toBe(true);
    });

    it("returns ok:true without admin when D1 user is not admin", async () => {
      vi.resetModules();
      authMock.mockResolvedValue(null);
      vi.doMock("@/lib/auth-d1", () => ({
        getAuthDbFromEnv: () => ({ prepare: vi.fn() }),
        getUserBySession: vi.fn().mockResolvedValue({
          id: "d1-user",
          email: "user@d1.test",
          name: null,
        }),
        isAdmin: vi.fn().mockResolvedValue(false),
      }));
      const { requireAuth, requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const req = new NextRequest("http://localhost/api/test", {
        headers: { cookie: "session_token=d1-session-xyz" },
      });
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.groups ?? []).not.toContain("admin");
      const admin = await requireAdmin(req);
      expect(admin.ok).toBe(false);
      if (!admin.ok) expect(admin.response.status).toBe(403);
    });
  });

  describe("requireAuth() — Cognito next-auth session cookie", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

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
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      const { requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAdmin(makeRequest(makeValidJwt()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("returns ok:true for a valid admin Bearer token (groups claim)", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      const { requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const token = makeValidJwt({ groups: ["admin"] });
      const result = await requireAdmin(makeRequest(token));
      expect(result.ok).toBe(true);
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("returns ok:true when session cookie user is in the admin group", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
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
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("returns 403 when session cookie user is not in admin group", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      authMock.mockResolvedValueOnce({
        user: { id: "plain-user", email: "user@cloudless.gr", groups: [], roles: [] },
      });
      const { requireAdmin, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const result = await requireAdmin(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });
  });
});

// ===========================================================================
// Coverage backfill — exercise remaining code paths in api-auth.ts
// ===========================================================================

describe("api-auth.ts (coverage backfill)", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(null);
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    delete process.env.AWS_REGION;
  });

  describe("verifyToken after Cognito removal (PR-05)", () => {
    it("isCognitoAuthEnabled is always false even with legacy env", async () => {
      process.env.NEXT_PUBLIC_AUTH_PROVIDER = "cognito";
      process.env.ALLOW_LEGACY_COGNITO = "1";
      vi.resetModules();
      const { isCognitoAuthEnabled, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      expect(isCognitoAuthEnabled()).toBe(false);
      delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
      delete process.env.ALLOW_LEGACY_COGNITO;
    });

    it("verifyToken still decodes unsigned JWT in non-production", async () => {
      vi.resetModules();
      const { verifyToken, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
      const body = Buffer.from(JSON.stringify({ sub: "dev-user", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url");
      const decoded = await verifyToken(`${header}.${body}.sig`);
      expect(decoded?.sub).toBe("dev-user");
    });
  });

  
  describe("decodeTokenUnverified (JSON.parse catch branch)", () => {
    it("returns null when payload is not valid base64-encoded JSON", async () => {
      vi.resetModules();
      const { verifyToken, resetJwksCache } = await import("@/lib/api-auth");
      resetJwksCache();
      const bogus = "aGVhZGVy." + Buffer.from("not-json-at-all").toString("base64url") + ".sig";
      const decoded = await verifyToken(bogus);
      expect(decoded).toBeNull();
    });
  });

  describe("isAdmin via realm_access.roles (legacy claim)", () => {
    it("returns true when realm_access.roles contains 'admin'", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u", realm_access: { roles: ["admin"] } })).toBe(true);
    });

    it("returns true when realm_access.roles contains 'realm:admin'", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u", realm_access: { roles: ["realm:admin"] } })).toBe(true);
    });

    it("returns false when no admin role/group is present", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u", groups: ["user"], realm_access: { roles: ["viewer"] } })).toBe(
        false
      );
    });
  });
});

describe("requireAuth E2E_ADMIN_TOKEN bypass (test-only)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });

  it("returns admin user when E2E env + matching Bearer token are set", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_E2E = "1";
    process.env.E2E_ADMIN_TOKEN = "e2e-secret-abc";
    const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
    resetJwksCache();
    const result = await requireAuth(makeRequest("e2e-secret-abc"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.sub).toBe("e2e-admin");
      expect(result.user["cognito:groups"]).toEqual(["admin"]);
    }
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });

  it("does NOT bypass when Bearer token doesn't match E2E_ADMIN_TOKEN", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_E2E = "1";
    process.env.E2E_ADMIN_TOKEN = "e2e-secret-abc";
    const { requireAuth, resetJwksCache } = await import("@/lib/api-auth");
    resetJwksCache();
    const result = await requireAuth(makeRequest("wrong-token"));
    // Falls through to normal auth which will 401 (no valid session)
    expect(result.ok).toBe(false);
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });
});
