import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { getAuthDbFromEnvMock, getUserBySessionMock, d1IsAdminMock } = vi.hoisted(() => ({
  getAuthDbFromEnvMock: vi.fn(() => null),
  getUserBySessionMock: vi.fn(),
  d1IsAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: getAuthDbFromEnvMock,
  getUserBySession: getUserBySessionMock,
  isAdmin: d1IsAdminMock,
}));

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

function makeCookieRequest(sessionId: string, bearer?: string): NextRequest {
  const headers: Record<string, string> = {
    cookie: `session_token=${sessionId}`,
  };
  if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

function resetD1Mocks() {
  getAuthDbFromEnvMock.mockReset();
  getAuthDbFromEnvMock.mockReturnValue(null);
  getUserBySessionMock.mockReset();
  d1IsAdminMock.mockReset();
}

function mockD1User(
  user: { id: string; email: string; name?: string | null },
  admin = false,
) {
  getAuthDbFromEnvMock.mockReturnValue({ prepare: vi.fn() });
  getUserBySessionMock.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  });
  d1IsAdminMock.mockResolvedValue(admin);
}

describe("api-auth.ts (D1-only)", () => {
  beforeEach(() => {
    resetD1Mocks();
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
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

  describe("verifyToken() — D1 session resolve", () => {
    it("returns null when auth DB is unavailable", async () => {
      getAuthDbFromEnvMock.mockReturnValue(null);
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken("any-session-id")).toBeNull();
    });

    it("returns null when session id is empty", async () => {
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken("")).toBeNull();
    });

    it("returns null when getUserBySession finds no user", async () => {
      getAuthDbFromEnvMock.mockReturnValue({ prepare: vi.fn() });
      getUserBySessionMock.mockResolvedValue(null);
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken("missing-session")).toBeNull();
    });

    it("returns DecodedToken for a valid D1 session", async () => {
      mockD1User({ id: "user-1", email: "test@example.com", name: "Test" }, false);
      const { verifyToken } = await import("@/lib/api-auth");
      const result = await verifyToken("valid-session");
      expect(result).not.toBeNull();
      expect(result!.sub).toBe("user-1");
      expect(result!.email).toBe("test@example.com");
      expect(result!.name).toBe("Test");
      expect(result!.email_verified).toBe(true);
      expect(result!.groups).toEqual([]);
    });

    it("includes admin group when D1 user is admin", async () => {
      mockD1User({ id: "admin-1", email: "admin@example.com" }, true);
      const { verifyToken } = await import("@/lib/api-auth");
      const result = await verifyToken("admin-session");
      expect(result).not.toBeNull();
      expect(result!.groups).toEqual(["admin"]);
    });

    it("returns null when auth-d1 throws", async () => {
      getAuthDbFromEnvMock.mockImplementation(() => {
        throw new Error("db boom");
      });
      const { verifyToken } = await import("@/lib/api-auth");
      expect(await verifyToken("any")).toBeNull();
    });
  });

  describe("isAdmin()", () => {
    it("returns false for null", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin(null)).toBe(false);
    });

    it("returns false when groups claim is missing", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u" })).toBe(false);
    });

    it("returns false when user is not in the admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u", groups: ["users", "editors"] })).toBe(false);
    });

    it("returns true when user is in the admin group", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(isAdmin({ sub: "u", groups: ["users", "admin"] })).toBe(true);
    });

    it("returns false for legacy realm_access roles (groups-only)", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(
        isAdmin({
          sub: "u",
          realm_access: { roles: ["offline_access", "admin"] },
        } as never),
      ).toBe(false);
    });

    it("returns false for legacy cognito:groups (groups-only)", async () => {
      const { isAdmin } = await import("@/lib/api-auth");
      expect(
        isAdmin({
          sub: "u",
          "cognito:groups": ["users", "admin"],
        } as never),
      ).toBe(false);
    });
  });

  describe("requireAuth()", () => {
    it("returns 401 when no token in header and no session cookie", async () => {
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("returns ok:true with admin groups when D1 cookie session is admin", async () => {
      mockD1User({ id: "d1-admin", email: "admin@d1.test", name: "D1 Admin" }, true);
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeCookieRequest("d1-session-abc"));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe("d1-admin");
        expect(result.user.groups).toContain("admin");
        expect(result.user.email_verified).toBe(true);
      }
    });

    it("returns ok:true without admin when D1 cookie user is not admin", async () => {
      mockD1User({ id: "d1-user", email: "user@d1.test" }, false);
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeCookieRequest("d1-session-xyz"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.groups ?? []).not.toContain("admin");
    });

    it("authenticates opaque Bearer session id via D1", async () => {
      mockD1User({ id: "d1-bearer", email: "bearer@d1.test", name: "Bearer D1" }, false);
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest("opaque-session-id"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("d1-bearer");
    });

    it("prefers session_token cookie over Bearer when both are present", async () => {
      getAuthDbFromEnvMock.mockReturnValue({ prepare: vi.fn() });
      getUserBySessionMock.mockImplementation((_db: unknown, sid: string) => {
        if (sid === "good-cookie") {
          return Promise.resolve({ id: "from-cookie", email: "c@d1.test", name: null });
        }
        if (sid === "bearer-session") {
          return Promise.resolve({ id: "from-bearer", email: "b@d1.test", name: null });
        }
        return Promise.resolve(null);
      });
      d1IsAdminMock.mockResolvedValue(false);
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeCookieRequest("good-cookie", "bearer-session"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("from-cookie");
    });

    it("returns 401 for invalid Bearer with no cookie", async () => {
      getAuthDbFromEnvMock.mockReturnValue({ prepare: vi.fn() });
      getUserBySessionMock.mockResolvedValue(null);
      const { requireAuth } = await import("@/lib/api-auth");
      const result = await requireAuth(makeRequest("bogus-session"));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });
  });

  describe("requireAdmin()", () => {
    it("returns 403 when D1 user is not admin", async () => {
      mockD1User({ id: "d1-user", email: "user@d1.test" }, false);
      const { requireAdmin } = await import("@/lib/api-auth");
      const result = await requireAdmin(makeCookieRequest("d1-session-xyz"));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("returns ok:true when D1 user is admin", async () => {
      mockD1User({ id: "d1-admin", email: "admin@d1.test", name: "D1 Admin" }, true);
      const { requireAdmin } = await import("@/lib/api-auth");
      const result = await requireAdmin(makeCookieRequest("d1-session-abc"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.sub).toBe("d1-admin");
    });
  });

  describe("requireVerifiedAuth()", () => {
    it("returns ok for an authenticated D1 session (email verified by construction)", async () => {
      mockD1User({ id: "d1-user", email: "user@d1.test" }, false);
      const { requireVerifiedAuth } = await import("@/lib/api-auth");
      const result = await requireVerifiedAuth(makeCookieRequest("verified-session"));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.user.email_verified).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      const { requireVerifiedAuth } = await import("@/lib/api-auth");
      const result = await requireVerifiedAuth(makeRequest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });
  });
});

describe("requireAuth E2E_ADMIN_TOKEN bypass (test-only)", () => {
  beforeEach(() => {
    resetD1Mocks();
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });

  it("returns admin user when E2E env + matching Bearer token are set", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_E2E = "1";
    process.env.E2E_ADMIN_TOKEN = "e2e-secret-abc";
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth(makeRequest("e2e-secret-abc"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.sub).toBe("e2e-admin");
      expect(result.user.groups).toEqual(["admin"]);
    }
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });

  it("does NOT bypass when Bearer token doesn't match E2E_ADMIN_TOKEN", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_E2E = "1";
    process.env.E2E_ADMIN_TOKEN = "e2e-secret-abc";
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth(makeRequest("wrong-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    delete process.env.NEXT_PUBLIC_E2E;
    delete process.env.E2E_ADMIN_TOKEN;
  });
});
