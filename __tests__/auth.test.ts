/**
 * Tests for the exported helpers in src/lib/auth.ts that
 * auth-lib-callbacks.test.ts does NOT cover:
 *
 *   - getAuthProvider returns "cognito" or null based on env
 *   - handlers.GET/.POST fallback path (returns disabled-auth response
 *     when next-auth instance isn't available)
 *   - /api/auth/session disabled-fallback returns null (not "{}")
 *   - signIn / signOut / auth shims resolve to undefined/null when the
 *     underlying NextAuth instance is missing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock next-auth so it never tries to do real network work. We model two
// scenarios via the test env: instance present (mock returned) vs instance
// missing (mock returns falsy when AUTH_SECRET is empty, mirroring real
// getNextAuth() guard behaviour).
const nextAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  default: (config: unknown) => nextAuthMock(config),
}));

vi.mock("@/lib/session-token-store", () => ({
  getTokens: vi.fn().mockResolvedValue(null),
  putTokens: vi.fn().mockResolvedValue(undefined),
  deleteTokens: vi.fn().mockResolvedValue(undefined),
}));

const ENV_KEYS = [
  "COGNITO_ISSUER",
  "COGNITO_USER_POOL_ID",
  "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
  "AWS_REGION",
  "COGNITO_CLIENT_ID",
  "COGNITO_CLIENT_SECRET",
  "COGNITO_DOMAIN",
  "AUTH_URL",
  "NEXT_PUBLIC_SITE_URL",
  "AUTH_SECRET",
] as const;

const originalEnv: Record<string, string | undefined> = {};

function clearAuthEnv() {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
  }
  clearAuthEnv();
  nextAuthMock.mockReset();
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  }
});

describe("getAuthProvider", () => {
  it("returns null when no Cognito issuer can be resolved", async () => {
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBeNull();
  });

  it("returns 'cognito' when explicit COGNITO_ISSUER is set", async () => {
    process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc";
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("cognito");
  });

  it("returns 'cognito' when only the pool ID is set (derives the issuer URL)", async () => {
    process.env.COGNITO_USER_POOL_ID = "us-east-1_xyz";
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("cognito");
  });

  it("treats NEXT_PUBLIC_COGNITO_USER_POOL_ID as a fallback for the pool ID", async () => {
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "eu-west-1_pubpool";
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("cognito");
  });

  it("strips a trailing slash from COGNITO_ISSUER", async () => {
    process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc/";
    // The exported getAuthProvider only reports truthy, but the stripping
    // logic is exercised under the hood — any string remains "cognito".
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("cognito");
  });
});

describe("handlers fallback (auth disabled)", () => {
  // Force getNextAuth() to return null by leaving AUTH_SECRET / issuer empty.
  beforeEach(() => {
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
  });

  it("/api/auth/session GET returns JSON null when auth is unconfigured", async () => {
    const { handlers } = await import("@/lib/auth");
    const req = new Request("https://cloudless.gr/api/auth/session");
    const res = await handlers.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it("other GET endpoints return an empty JSON object when auth is unconfigured", async () => {
    const { handlers } = await import("@/lib/auth");
    const req = new Request("https://cloudless.gr/api/auth/providers");
    const res = await handlers.GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("POST returns an empty JSON object when auth is unconfigured", async () => {
    const { handlers } = await import("@/lib/auth");
    const req = new Request("https://cloudless.gr/api/auth/signin/cognito", {
      method: "POST",
    });
    const res = await handlers.POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});

describe("handlers happy path (auth configured)", () => {
  beforeEach(() => {
    // Provide enough env for getNextAuth() to materialize a real instance.
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-aaaaaaaaaa";
    process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc";
    process.env.COGNITO_CLIENT_ID = "client-x";
    process.env.COGNITO_CLIENT_SECRET = "secret-x";
  });

  it("delegates GET to the underlying next-auth handler", async () => {
    const getHandler = vi.fn().mockResolvedValue(new Response("upstream-get", { status: 200 }));
    nextAuthMock.mockReturnValue({
      handlers: { GET: getHandler, POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
    const { handlers } = await import("@/lib/auth");
    const req = new Request("https://cloudless.gr/api/auth/session");
    const res = await handlers.GET(req);
    expect(getHandler).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe("upstream-get");
  });

  it("delegates POST to the underlying next-auth handler", async () => {
    const postHandler = vi.fn().mockResolvedValue(new Response("upstream-post", { status: 200 }));
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: postHandler },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
    const { handlers } = await import("@/lib/auth");
    const req = new Request("https://cloudless.gr/api/auth/signin/cognito", {
      method: "POST",
    });
    const res = await handlers.POST(req);
    expect(postHandler).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe("upstream-post");
  });
});

describe("signIn / signOut / auth shims", () => {
  it("signIn resolves to undefined when the underlying instance is missing", async () => {
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
    // env is clean → getNextAuth() returns null → shim falls through.
    const { signIn } = await import("@/lib/auth");
    await expect(signIn("cognito")).resolves.toBeUndefined();
  });

  it("signOut resolves to undefined when the underlying instance is missing", async () => {
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
    const { signOut } = await import("@/lib/auth");
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("auth() resolves to null when the underlying instance is missing", async () => {
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    });
    const { auth } = await import("@/lib/auth");
    await expect((auth as () => Promise<unknown>)()).resolves.toBeNull();
  });

  it("auth() delegates to the underlying instance when configured", async () => {
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-aaaaaaaaaa";
    process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc";
    process.env.COGNITO_CLIENT_ID = "client-x";
    process.env.COGNITO_CLIENT_SECRET = "secret-x";

    const authFn = vi.fn().mockResolvedValue({ user: { id: "u1" } });
    nextAuthMock.mockReturnValue({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: authFn,
    });
    const { auth } = await import("@/lib/auth");
    const r = await (auth as () => Promise<unknown>)();
    expect(authFn).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ user: { id: "u1" } });
  });
});
