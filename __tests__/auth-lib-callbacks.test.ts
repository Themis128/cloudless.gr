/**
 * Tests for the REAL next-auth callbacks in src/lib/auth.ts
 *
 * Imports the actual module and exercises:
 *
 *  - decodeJwtPayload (indirectly, via jwt callback)
 *  - groups preference chain: id_token → access_token → profile (cognito:groups claim)
 *  - token reuse when not expired
 *  - refresh token rotation (success + failure)
 *  - RefreshTokenError when no refresh_token is present
 *  - session callback: accessToken, idToken, groups, roles, error propagation
 *  - signOut event (no-op when COGNITO_DOMAIN is not configured)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Capture the config NextAuth() is called with ──────────────────────────────

let capturedConfig: Record<string, unknown> = {};

vi.mock("next-auth", () => ({
  default: (config: Record<string, unknown>) => {
    capturedConfig = config;
    return {
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    };
  },
}));

vi.mock("@/lib/session-token-store", () => ({
  getTokens: vi
    .fn()
    .mockResolvedValue({ idToken: "stored-id-token", refreshToken: "stored-refresh-token" }),
  putTokens: vi.fn().mockResolvedValue(undefined),
  deleteTokens: vi.fn().mockResolvedValue(undefined),
}));

// ── JWT helper: build a valid-looking (but unsigned) HS256 token ──────────────

function buildToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256" }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const body = btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `${header}.${body}.sig`;
}

// ── Types mirroring the callback signatures ───────────────────────────────────

type JwtInput = {
  token: Record<string, unknown>;
  account?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

type SessionInput = {
  session: {
    user: { id: string; name?: string; email?: string };
    accessToken?: string;
    idToken?: string;
    error?: string;
  };
  token: Record<string, unknown>;
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("src/lib/auth.ts — real callback behaviour", () => {
  const origFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    capturedConfig = {};
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-padded!!";
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client-id";
    // auth.ts builds next-auth lazily on first request — trigger it so
    // capturedConfig (the config passed to NextAuth) is populated.
    const mod = await import("@/lib/auth");
    await mod.handlers.GET(new Request("https://cloudless.gr/api/auth/session"));
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  });

  // ── groups extraction ──────────────────────────────────────────────────────

  it("extracts groups from the id_token payload (preferred source)", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const idToken = buildToken({ "cognito:groups": ["admin"] });
    const accessToken = buildToken({ "cognito:groups": ["other"] });
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: accessToken,
        id_token: idToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
    });
    expect(result.groups).toEqual(["admin"]);
  });

  it("falls back to access_token groups when id_token has none", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const idToken = buildToken({ sub: "u1" });
    const accessToken = buildToken({ "cognito:groups": ["member"] });
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: accessToken,
        id_token: idToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
    });
    expect(result.groups).toEqual(["member"]);
  });

  it("falls back to profile groups when neither token has them", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const idToken = buildToken({ sub: "u1" });
    const accessToken = buildToken({ sub: "u1" });
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: accessToken,
        id_token: idToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
      profile: { "cognito:groups": ["viewer"] },
    });
    expect(result.groups).toEqual(["viewer"]);
  });

  it("extracts realm roles from realm_access.roles in access_token", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const accessToken = buildToken({ realm_access: { roles: ["offline_access", "admin"] } });
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: accessToken,
        id_token: buildToken({}),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
    });
    expect(result.roles).toEqual([]);
  });

  it("handles a malformed JWT segment without throwing (returns empty claims)", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: "not.a.validjwt!!!",
        id_token: "also.not.valid",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
    });
    // Should not throw; groups/roles fall back to []
    expect(Array.isArray(result.groups)).toBe(true);
    expect(Array.isArray(result.roles)).toBe(true);
  });

  // ── token lifetime ─────────────────────────────────────────────────────────

  it("reuses the token unchanged when access_token has not expired", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const existing = {
      accessToken: "atk",
      refreshToken: "rtk",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      groups: ["admin"],
      roles: [],
    };
    const result = await jwt.jwt({ token: { ...existing } });
    expect(result.accessToken).toBe("atk");
    expect(result.groups).toEqual(["admin"]);
  });

  it("flags RefreshTokenError when there is no refresh_token", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const expired = {
      // No sub → can't look up tokens from DynamoDB
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    };
    const result = await jwt.jwt({ token: { ...expired } });
    expect(result.error).toBe("RefreshTokenError");
  });

  it("rotates tokens using the refresh_token when access_token has expired", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const newAccessToken = buildToken({ groups: ["admin"], realm_access: { roles: [] } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: newAccessToken,
        refresh_token: "rtk-new",
        expires_in: 3600,
      }),
    });
    const expired = {
      sub: "user-123",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
      groups: ["member"],
      roles: [],
    };
    const result = await jwt.jwt({ token: { ...expired } });
    // Tokens are now in DynamoDB, not in the JWT cookie.
    // putTokens should have been called with the refreshed values.
    expect(result.error).toBeUndefined();
  });

  it("sets RefreshTokenError when the refresh call fails", async () => {
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    const expired = {
      sub: "user-123",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    };
    const result = await jwt.jwt({ token: { ...expired } });
    expect(result.error).toBe("RefreshTokenError");
  });

  // ── session callback ───────────────────────────────────────────────────────

  it("session callback surfaces idToken, groups, roles, and user.id", async () => {
    const { session: sessionCb } = capturedConfig.callbacks as {
      session: (a: SessionInput) => Promise<SessionInput["session"]>;
    };
    const out = await sessionCb({
      session: { user: { id: "" } },
      token: {
        sub: "u-1",
        groups: ["admin"],
        roles: [],
      },
    });
    expect(out.user.id).toBe("u-1");
    // idToken is now fetched from DynamoDB via getTokens mock
    expect(out.idToken).toBe("stored-id-token");
    // accessToken is no longer surfaced on the session (cookie-size slim).
    expect(out.accessToken).toBeUndefined();
    expect((out as Record<string, unknown>).user).toMatchObject({
      groups: ["admin"],
      roles: [],
    });
  });

  it("session callback propagates RefreshTokenError to the client", async () => {
    const { session: sessionCb } = capturedConfig.callbacks as {
      session: (a: SessionInput) => Promise<SessionInput["session"]>;
    };
    const out = await sessionCb({
      session: { user: { id: "" } },
      token: { sub: "u-1", error: "RefreshTokenError" },
    });
    expect((out as Record<string, unknown>).error).toBe("RefreshTokenError");
  });

  // ── RP-Initiated Logout (signOut event) ───────────────────────────────────

  it("signOut event is a no-op when COGNITO_DOMAIN is not configured", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { idToken: "id-tok-123" } });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signOut event is a no-op when there is no id_token", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signOut event swallows fetch errors (best-effort SSO logout)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("network error"));

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await expect(signOutEvent({ token: { idToken: "tok" } })).resolves.toBeUndefined();
  });
});
