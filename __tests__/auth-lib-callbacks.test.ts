/**
 * Tests for the REAL next-auth callbacks in src/lib/auth.ts
 *
 * Imports the actual module and exercises:
 *
 *  - groups preference chain: id_token → profile (cognito:groups claim)
 *  - session callback: groups, roles, and user.id
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
      events: config.events,
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
    process.env.COGNITO_DOMAIN = "https://cloudless-auth.auth.us-east-1.amazoncognito.com";
    // auth.ts builds next-auth lazily on first request — trigger it so
    // capturedConfig (the config passed to NextAuth) is populated.
    const mod = await import("@/lib/auth");
    await mod.handlers.GET(new Request("https://cloudless.gr/api/auth/session"));
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    delete process.env.COGNITO_DOMAIN;
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

  // ── session callback ───────────────────────────────────────────────────────

  it("session callback surfaces groups, roles, and user.id", async () => {
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
    expect((out as Record<string, unknown>).user).toMatchObject({
      groups: ["admin"],
      roles: [],
    });
  });

  // ── RP-Initiated Logout (signOut event) ───────────────────────────────────

  it("signOut event calls Cognito Hosted UI logout when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { idToken: "id-tok-123" } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://cloudless-auth.auth.us-east-1.amazoncognito.com/logout"),
      { method: "GET" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("client_id=test-client-id"),
      { method: "GET" }
    );
  });

  it("signOut event still calls Cognito Hosted UI logout without an id_token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: {} });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://cloudless-auth.auth.us-east-1.amazoncognito.com/logout"),
      { method: "GET" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("logout_uri=http%3A%2F%2Flocalhost%3A4000%2F"),
      { method: "GET" }
    );
  });

  it("signOut event swallows fetch errors (best-effort SSO logout)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("network error"));

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await expect(signOutEvent({ token: { idToken: "tok" } })).resolves.toBeUndefined();
  });
});