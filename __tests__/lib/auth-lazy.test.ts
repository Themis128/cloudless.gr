import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  nextAuthConfig: {} as Record<string, unknown>,
  handlersGet: vi.fn(),
  handlersPost: vi.fn(),
  signInFn: vi.fn(),
  signOutFn: vi.fn(),
  authFn: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: (config: Record<string, unknown>) => {
    m.nextAuthConfig = config;
    return {
      handlers: { GET: m.handlersGet, POST: m.handlersPost },
      signIn: m.signInFn,
      signOut: m.signOutFn,
      auth: m.authFn,
    };
  },
}));

type Stmt = { sql: string; bind: (...a: unknown[]) => Bound };
type Bound = { run: () => Promise<void>; first: () => Promise<unknown> };

function fakeD1(firstResult: unknown = null) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db = {
    calls,
    prepare(sql: string): Stmt {
      return {
        sql,
        bind: (...args: unknown[]) => ({
          run: async () => {
            calls.push({ sql, args });
          },
          first: async () => firstResult,
        }),
      };
    },
  };
  (globalThis as Record<string, unknown>).AUTH_DB = db;
  return db;
}

async function importAuth() {
  return await import("@/lib/auth");
}

describe("lib/auth lazy next-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fakeD1();
    delete process.env.AUTH_SECRET;
    delete process.env.AUTH_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("serves the disabled-auth response when AUTH_SECRET is unset", async () => {
    const { handlers } = await importAuth();
    const session = await handlers.GET(new Request("https://x/api/auth/session"));
    expect(await session.json()).toBeNull();
    const other = await handlers.GET(new Request("https://x/api/auth/callback"));
    expect(await other.json()).toEqual({});
    const post = await handlers.POST(new Request("https://x/api/auth/signin"));
    expect(await post.json()).toEqual({});
  });

  it("delegates to the built next-auth instance when configured", async () => {
    process.env.AUTH_SECRET = "s3cret";
    const { handlers, signIn, signOut, auth, getAuthProvider } = await importAuth();
    expect(getAuthProvider()).toBe("d1");
    m.handlersGet.mockResolvedValue(Response.json({ ok: true }));
    const res = await handlers.GET(new Request("https://x/api/auth/session"));
    expect(await res.json()).toEqual({ ok: true });
    expect(m.nextAuthConfig).toMatchObject({
      secret: "s3cret",
      trustHost: true,
      session: { strategy: "jwt" },
    });
    m.signInFn.mockResolvedValue("in");
    m.signOutFn.mockResolvedValue("out");
    m.authFn.mockResolvedValue("sess");
    expect(await signIn("credentials")).toBe("in");
    expect(await signOut()).toBe("out");
    expect(await auth()).toBe("sess");
  });

  it("jwt callback persists the session to D1 on sign-in", async () => {
    process.env.AUTH_SECRET = "s3cret";
    const db = fakeD1();
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const jwt = (m.nextAuthConfig.callbacks as Record<string, (...args: never[]) => unknown>).jwt;
    const token = await jwt({ token: { sub: "u1" }, user: { id: "u1", email: "e" } });
    expect(token.tokensPersisted).toBe(true);
    expect(token.groups).toEqual([]);
    expect(db.calls[0].sql).toContain("INSERT INTO sessions");
    expect(db.calls[0].args[0]).toBe("u1");
  });

  it("jwt callback returns early for a live token and refreshes an expired one", async () => {
    process.env.AUTH_SECRET = "s3cret";
    fakeD1({ expires_at: Math.floor(Date.now() / 1000) + 9999 });
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const jwt = (m.nextAuthConfig.callbacks as Record<string, (...args: never[]) => unknown>).jwt;

    const live = await jwt({ token: { sub: "u1", expiresAt: Math.floor(Date.now() / 1000) + 500 } });
    expect(live.error).toBeUndefined();

    const db = (globalThis as Record<string, unknown>).AUTH_DB as ReturnType<typeof fakeD1>;
    const refreshed = await jwt({ token: { sub: "u1", expiresAt: 1 } });
    expect(refreshed.error).toBeUndefined();
    expect(db.calls.some((c) => c.sql.includes("UPDATE sessions"))).toBe(true);
  });

  it("jwt refresh flags RefreshTokenError on missing/expired session or db failure", async () => {
    process.env.AUTH_SECRET = "s3cret";
    fakeD1(null); // no session row
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const jwt = (m.nextAuthConfig.callbacks as Record<string, (...args: never[]) => unknown>).jwt;

    const noSub = await jwt({ token: { expiresAt: 1 } });
    expect(noSub.error).toBe("RefreshTokenError");
    const expired = await jwt({ token: { sub: "u1", expiresAt: 1 } });
    expect(expired.error).toBe("RefreshTokenError");

    fakeD1({ expires_at: 1 }); // session row but already expired
    const expired2 = await jwt({ token: { sub: "u1", expiresAt: 1 } });
    expect(expired2.error).toBe("RefreshTokenError");

    (globalThis as Record<string, unknown>).AUTH_DB = {
      prepare: () => ({ bind: () => ({ first: async () => { throw new Error("d1"); }, run: async () => {} }) }),
    };
    const boom = await jwt({ token: { sub: "u1", expiresAt: 1 } });
    expect(boom.error).toBe("RefreshTokenError");
  });

  it("session callback copies claims and error into the session", async () => {
    process.env.AUTH_SECRET = "s3cret";
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const sessionCb = (m.nextAuthConfig.callbacks as Record<string, (...args: never[]) => unknown>).session;
    const session = await sessionCb({
      session: { user: {} },
      token: { sub: "u9", groups: ["g"], roles: ["admin"], error: "RefreshTokenError" },
    });
    expect(session.user.id).toBe("u9");
    expect(session.user.roles).toEqual(["admin"]);
    expect(session.error).toBe("RefreshTokenError");
  });

  it("signOut event deletes the D1 session best-effort", async () => {
    process.env.AUTH_SECRET = "s3cret";
    const db = fakeD1();
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const signOutEvent = (m.nextAuthConfig.events as Record<string, (...args: never[]) => unknown>).signOut;
    await signOutEvent({ token: { sub: "u1" } });
    expect(db.calls[0].sql).toContain("DELETE FROM sessions");
    await signOutEvent({ session: {} }); // no token — no-op
    (globalThis as Record<string, unknown>).AUTH_DB = {
      prepare: () => ({ bind: () => ({ run: async () => { throw new Error("d1"); } }) }),
    };
    await signOutEvent({ token: { sub: "u1" } }); // swallowed
  });

  it("logger.error writes to console", async () => {
    process.env.AUTH_SECRET = "s3cret";
    const { handlers } = await importAuth();
    m.handlersGet.mockResolvedValue(Response.json(null));
    await handlers.GET(new Request("https://x/api/auth/session"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (m.nextAuthConfig.logger as Record<string, (...args: never[]) => unknown>).error(new Error("bad"));
    expect(spy).toHaveBeenCalledWith("[auth][error] bad");
    spy.mockRestore();
  });
});
