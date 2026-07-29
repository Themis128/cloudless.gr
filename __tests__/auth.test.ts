/**
 * Tests for the exported helpers in src/lib/auth.ts.
 *
 * Auth is D1-only now (getAuthProvider always returns "d1"). Cognito-era
 * provider selection tests are skipped; handlers / shims still exercise the
 * AUTH_SECRET-gated next-auth fallback path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const nextAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  default: (config: unknown) => nextAuthMock(config),
}));

vi.mock("@/lib/session-token-store", () => ({
  getTokens: vi.fn().mockResolvedValue(null),
  putTokens: vi.fn().mockResolvedValue(undefined),
  deleteTokens: vi.fn().mockResolvedValue(undefined),
}));

const ENV_KEYS = ["AUTH_URL", "NEXT_PUBLIC_SITE_URL", "AUTH_SECRET"] as const;

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
  it("always returns 'd1' (D1-only auth)", async () => {
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("d1");
  });

  it("still returns 'd1' when AUTH_SECRET is unset", async () => {
    clearAuthEnv();
    const { getAuthProvider } = await import("@/lib/auth");
    expect(getAuthProvider()).toBe("d1");
  });
});

describe("handlers fallback (auth disabled)", () => {
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
    const req = new Request("https://cloudless.gr/api/auth/signin", {
      method: "POST",
    });
    const res = await handlers.POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});

describe("handlers happy path (auth configured)", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-aaaaaaaaaa";
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
    const req = new Request("https://cloudless.gr/api/auth/signin", {
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
    const { signIn } = await import("@/lib/auth");
    await expect(signIn()).resolves.toBeUndefined();
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
