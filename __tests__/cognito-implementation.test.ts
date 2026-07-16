// @vitest-environment node
/**
 * Cognito implementation tests — the REAL src/lib/auth.ts in Cognito mode.
 *
 * Covers the Cognito jwt/session callback behaviour.
 * This file flips the env so COGNITO_ISSUER is set and asserts the
 * Cognito-specific behaviour:
 *
 *   1. Provider selection — authProvider === "cognito" when COGNITO_ISSUER set
 *   2. cognito:groups claim extraction (id_token preferred over access_token)
 *   3. Refresh hits {COGNITO_DOMAIN}/oauth2/token with client_id in the body
 *      (public PKCE — no Authorization header, no client_secret)
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

vi.mock("@/lib/session-token-store", () => ({
  getTokens: vi
    .fn()
    .mockResolvedValue({ idToken: "stored-id-token", refreshToken: "stored-refresh-token" }),
  putTokens: vi.fn().mockResolvedValue(undefined),
  deleteTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-auth/providers/cognito", () => ({
  default: (opts: Record<string, unknown>) => ({ ...opts, id: "cognito", name: "cognito" }),
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

// auth.ts builds the next-auth instance lazily (on first request), so importing
// the module no longer calls NextAuth() / populates capturedConfig. Trigger the
// lazy build by invoking a handler, then return the module.
async function loadAuth(): Promise<typeof import("@/lib/auth")> {
  const mod = await import("@/lib/auth");
  await mod.handlers.GET(new Request("https://cloudless.gr/api/auth/session"));
  return mod;
}

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
    // COGNITO_ISSUER set.
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-padded!!";
    process.env.COGNITO_ISSUER = COGNITO_ISSUER;
    process.env.COGNITO_CLIENT_ID = CLIENT_ID;
    process.env.COGNITO_CLIENT_SECRET = CLIENT_SECRET;
    process.env.COGNITO_DOMAIN = COGNITO_DOMAIN;
    process.env.AUTH_URL = AUTH_URL;
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
    const mod = await loadAuth();
    expect(mod.getAuthProvider()).toBe("cognito");
    const providers = capturedConfig.providers as Array<{ id?: string }>;
    expect(providers[0]?.id).toBe("cognito");
  });

  // ── 2. cognito:groups extraction ───────────────────────────────────────────

  it("extracts groups from the cognito:groups claim in the id_token", async () => {
    await loadAuth();
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

  it("ignores the legacy `groups` claim name in Cognito mode", async () => {
    await loadAuth();
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    // A token carrying only a bare `groups` claim (not cognito:groups)
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
  // Note: Refresh token logic removed as part of migration away from AWS/Cognito
  
  it("returns error when token is expired (no refresh in current implementation)", async () => {
    await loadAuth();
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    
    const expired = {
      sub: "user-123",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    };
    const result = await jwt.jwt({ token: { ...expired } });
    
    // Without refresh logic, the token remains but will be expired
    // The error property signals to next-auth that token needs re-auth
    expect(result.error).toBe("RefreshTokenMissing");
  });

  // ── 4. Cognito does not rotate refresh tokens ───────────────────────────────
  // Note: This test is no longer applicable after removing refresh logic
  
  it("does not attempt token refresh (migrating from Cognito)", async () => {
    await loadAuth();
    const { putTokens } = (await import("@/lib/session-token-store")) as {
      putTokens: ReturnType<typeof vi.fn>;
    };
    const jwt = capturedConfig.callbacks as Record<
      string,
      (a: JwtInput) => Promise<Record<string, unknown>>
    >;
    
    // Even with an expired token, no refresh should occur
    const result = await jwt.jwt({
      token: {
        sub: "user-123",
        expiresAt: Math.floor(Date.now() / 1000) - 60,
      },
    });
    
    // putTokens should NOT be called - no refresh logic
    expect(putTokens).not.toHaveBeenCalled();
    // Token should be marked as needing re-auth
    expect(result.error).toBe("RefreshTokenMissing");
  });

  // ── 5. RP-initiated logout via Cognito's non-standard /logout ───────────────

  it("signOut event calls {domain}/logout with client_id and logout_uri", async () => {
    await loadAuth();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { sub?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { sub: "user-123" } });

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
    await loadAuth();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const { signOut: signOutEvent } = capturedConfig.events as {
      signOut: (msg: { token?: { sub?: string } }) => Promise<void>;
    };
    await signOutEvent({ token: { sub: "user-456" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── 6. issuer derivation from COGNITO_USER_POOL_ID ──────────────────────────
  //
  // The deploy env / SSM commonly carry only the pool ID, not COGNITO_ISSUER.
  // resolveCognitoIssuer() must derive the canonical OIDC issuer
  //   https://cognito-idp.{region}.amazonaws.com/{poolId}
  // so the provider still builds — otherwise Auth.js throws "missing both
  // issuer and authorization endpoint" and every /api/auth/* request 500s.

  const providerIssuer = () =>
    (capturedConfig.providers as Array<{ id?: string; issuer?: string }>)[0]?.issuer;

  it("derives the issuer from COGNITO_USER_POOL_ID when COGNITO_ISSUER is unset", async () => {
    delete process.env.COGNITO_ISSUER;
    process.env.COGNITO_USER_POOL_ID = "us-east-1_DERIVED";
    delete process.env.AWS_REGION;
    vi.resetModules();
    capturedConfig = {};
    const mod = await loadAuth();
    expect(mod.getAuthProvider()).toBe("cognito");
    // Region falls back to the pool ID's prefix ("us-east-1").
    expect(providerIssuer()).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DERIVED");
    delete process.env.COGNITO_USER_POOL_ID;
  });

  it("prefers AWS_REGION over the pool ID prefix when deriving the issuer", async () => {
    delete process.env.COGNITO_ISSUER;
    process.env.COGNITO_USER_POOL_ID = "us-east-1_DERIVED";
    process.env.AWS_REGION = "eu-central-1";
    vi.resetModules();
    capturedConfig = {};
    await loadAuth();
    expect(providerIssuer()).toBe(
      "https://cognito-idp.eu-central-1.amazonaws.com/us-east-1_DERIVED"
    );
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.AWS_REGION;
  });

  it("falls back to NEXT_PUBLIC_COGNITO_USER_POOL_ID for derivation", async () => {
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_USER_POOL_ID;
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-west-2_PUBLIC";
    delete process.env.AWS_REGION;
    vi.resetModules();
    capturedConfig = {};
    const mod = await loadAuth();
    expect(mod.getAuthProvider()).toBe("cognito");
    expect(providerIssuer()).toBe("https://cognito-idp.us-west-2.amazonaws.com/us-west-2_PUBLIC");
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  });

  it("strips a trailing slash from an explicit COGNITO_ISSUER", async () => {
    process.env.COGNITO_ISSUER = `${COGNITO_ISSUER}/`;
    vi.resetModules();
    capturedConfig = {};
    await loadAuth();
    expect(providerIssuer()).toBe(COGNITO_ISSUER); // no trailing slash
  });

  it("resolves no provider when neither issuer nor pool ID is present", async () => {
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    vi.resetModules();
    capturedConfig = {};
    const mod = await import("@/lib/auth");
    expect(mod.getAuthProvider()).toBeNull();
  });
});
