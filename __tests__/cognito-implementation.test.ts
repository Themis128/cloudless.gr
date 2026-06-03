// @vitest-environment node
/**
 * Cognito implementation tests — the REAL src/lib/auth.ts in Cognito mode.
 *
 * auth-lib-callbacks.test.ts exercises the same callbacks in *Keycloak* mode.
 * This file flips the env so COGNITO_ISSUER is set and asserts the
 * Cognito-specific behaviour that the Keycloak path never touches:
 *
 *   1. Provider selection — authProvider === "cognito" when COGNITO_ISSUER set
 *   2. cognito:groups claim extraction (id_token preferred over access_token)
 *   3. Refresh hits {COGNITO_DOMAIN}/oauth2/token with HTTP Basic auth
 *      (client_id:client_secret) — NOT client_secret in the body
 *   4. Cognito does not rotate refresh tokens — the existing one is kept
 *      when the refresh response omits refresh_token
 *   5. RP-initiated logout hits {COGNITO_DOMAIN}/logout?client_id&logout_uri
 *      (Cognito's non-standard endpoint, not an OIDC end_session_endpoint)
 *
 * Sources:
 *   - https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
 *   - https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
 *   - https://authjs.dev/getting-started/providers/cognito
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

vi.mock("next-auth/providers/cognito", () => ({
  default: (opts: Record<string, unknown>) => ({ ...opts, id: "cognito", name: "cognito" }),
}));

vi.mock("next-auth/providers/keycloak", () => ({
  default: (opts: Record<string, unknown>) => ({ ...opts, id: "keycloak", name: "keycloak" }),
}));

// ── JWT helper: base64url payload (unsigned — decodeJwtPayload only reads it) ──

function buildToken(payload: Record<string, unknown>): string {
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${enc({ alg: "RS256" })}.${enc(payload)}.sig`;
}

type JwtInput = {
  token: Record<string, unknown>;
  account?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST";
const COGNITO_DOMAIN = "https://cloudless-auth.auth.us-east-1.amazoncognito.com";
const CLIENT_ID = "cognito-client-id";
const CLIENT_SECRET = "cognito-client-secret";
const AUTH_URL = "https://cloudless.gr";

describe("src/lib/auth.ts — Cognito mode", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    capturedConfig = {};
    // Cognito wins: COGNITO_ISSUER set, Keycloak vars absent.
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-padded!!";
    process.env.COGNITO_ISSUER = COGNITO_ISSUER;
    process.env.COGNITO_CLIENT_ID = CLIENT_ID;
    process.env.COGNITO_CLIENT_SECRET = CLIENT_SECRET;
    process.env.COGNITO_DOMAIN = COGNITO_DOMAIN;
    process.env.AUTH_URL = AUTH_URL;
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.KEYCLOAK_CLIENT_ID;
    delete process.env.KEYCLOAK_CLIENT_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_SECRET;
    delete process.env.COGNITO_DOMAIN;
    delete process.env.AUTH_URL;
  });

  // ── 1. provider selection ──────────────────────────────────────────────────

  it("selects Cognito as the active provider when COGNITO_ISSUER is set", async () => {
    const mod = await import("@/lib/auth");
    expect(mod.authProvider).toBe("cognito");
    const providers = capturedConfig.providers as Array<{ id?: string }>;
    expect(providers[0]?.id).toBe("cognito");
  });

  // ── 2. cognito:groups extraction ───────────────────────────────────────────

  it("extracts groups from the cognito:groups claim in the id_token", async () => {
    await import("@/lib/auth");
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const idToken = buildToken({ "cognito:groups": ["admin", "users"] });
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
    expect(result.groups).toEqual(["admin", "users"]);
  });

  it("ignores the Keycloak `groups` claim name when in Cognito mode", async () => {
    await import("@/lib/auth");
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    // A token carrying only the Keycloak-style `groups` (not cognito:groups)
    // must NOT populate groups when Cognito is the active provider.
    const idToken = buildToken({ groups: ["admin"] });
    const result = await jwt.jwt({
      token: {},
      account: {
        access_token: buildToken({}),
        id_token: idToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      },
    });
    expect(result.groups).toEqual([]);
  });

  // ── 3. refresh hits the Cognito token endpoint with HTTP Basic auth ─────────

  it("refreshes at {domain}/oauth2/token using HTTP Basic auth (not body secret)", async () => {
    await import("@/lib/auth");
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: buildToken({ "cognito:groups": ["admin"] }),
        expires_in: 3600,
      }),
    });
    globalThis.fetch = fetchMock;

    const expired = {
      accessToken: "old",
      refreshToken: "rtk-cognito",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    };
    await jwt.jwt({ token: { ...expired } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${COGNITO_DOMAIN}/oauth2/token`);

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`);

    // The secret must travel in the Basic header, never in the body.
    const body = String(init.body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=rtk-cognito");
    expect(body).not.toContain("client_secret");
  });

  // ── 4. Cognito does not rotate refresh tokens ───────────────────────────────

  it("keeps the existing refresh_token when the response omits one", async () => {
    await import("@/lib/auth");
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: buildToken({ "cognito:groups": ["admin"] }),
        // No refresh_token — Cognito reuses the existing one.
        expires_in: 3600,
      }),
    });
    const result = await jwt.jwt({
      token: {
        accessToken: "old",
        refreshToken: "rtk-keep-me",
        expiresAt: Math.floor(Date.now() / 1000) - 60,
      },
    });
    expect(result.refreshToken).toBe("rtk-keep-me");
    expect(result.groups).toEqual(["admin"]);
    expect(result.error).toBeUndefined();
  });

  // ── 5. RP-initiated logout via Cognito's non-standard /logout ───────────────

  it("signOut event calls {domain}/logout with client_id and logout_uri", async () => {
    await import("@/lib/auth");
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { idToken: "id-tok" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`${COGNITO_DOMAIN}/logout`);
    expect(url).toContain(`client_id=${CLIENT_ID}`);
    expect(url).toContain(`logout_uri=${encodeURIComponent(`${AUTH_URL}/`)}`);
    // Cognito logout must NOT use the OIDC end_session endpoint.
    expect(url).not.toContain("openid-connect/logout");
  });

  it("signOut event is a no-op when COGNITO_DOMAIN is unset", async () => {
    delete process.env.COGNITO_DOMAIN;
    vi.resetModules();
    capturedConfig = {};
    await import("@/lib/auth");
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { idToken?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { idToken: "id-tok" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
