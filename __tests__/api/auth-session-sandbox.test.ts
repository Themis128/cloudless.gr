/**
 * Tests for GET/HEAD/DELETE /api/auth/session and GET/POST /api/auth/sandbox.
 *
 * session keeps the REAL auth-d1 helpers (getUserBySession/isAdmin/
 * deleteSession) against the route's own HTTP-D1 fallback shim — a SQL-
 * routing fetch fake drives prepare/bind/all/run/first end to end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  db: null as unknown,
  rlOk: true,
  authError: null as string | null,
  createError: null as string | null,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() =>
    hoisted.rlOk
      ? { ok: true, remaining: 99 }
      : {
          ok: false,
          response: Response.json({ error: "rate limited" }, { status: 429 }),
        }
  ),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: vi.fn(() => hoisted.db),
    authenticateUser: vi.fn(async () =>
      hoisted.authError
        ? { error: hoisted.authError }
        : { user: { email: "u@x" }, session: { expires_at: "2099" } }
    ),
    createUser: vi.fn(async () =>
      hoisted.createError
        ? { error: hoisted.createError }
        : { user: { id: "u1", email: "u@x" } }
    ),
  };
});

import { GET, HEAD, DELETE } from "@/app/api/auth/session/route";
import { GET as sandboxGet, POST as sandboxPost } from "@/app/api/auth/sandbox/route";

const SESSION = "http://localhost/api/auth/session";
const SANDBOX = "http://localhost/api/auth/sandbox";

/** SQL-routing D1 fake — mirrors the CF D1 HTTP API the fallback shim uses. */
function d1Fetch(routes: { sql: RegExp; results: unknown[] }[]) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { sql } = JSON.parse(init.body as string);
    const hit = routes.find((r) => r.sql.test(sql));
    return new Response(
      JSON.stringify({
        success: true,
        result: [
          { results: hit?.results ?? [], success: true, meta: { changes: 1 } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });
}

function useHttpFallback(routes: { sql: RegExp; results: unknown[] }[]) {
  hoisted.db = null;
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc-1");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok-1");
  vi.stubGlobal("fetch", d1Fetch(routes));
}

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    hoisted.db = null;
  });

  it("returns user:null when no db is available", async () => {
    const j = await (await GET(new NextRequest(SESSION))).json();
    expect(j).toEqual({ user: null });
  });

  it("returns user:null without a session cookie", async () => {
    useHttpFallback([]);
    const j = await (await GET(new NextRequest(SESSION))).json();
    expect(j.user).toBeNull();
  });

  it("clears the cookie when the session is gone", async () => {
    useHttpFallback([{ sql: /FROM session/, results: [] }]);
    const res = await GET(
      new NextRequest(SESSION, { headers: { cookie: "session_token=abc" } })
    );
    expect((await res.json()).user).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("session_token=");
  });

  it("returns the user + admin flag via the real D1 helpers", async () => {
    useHttpFallback([
      { sql: /FROM session/, results: [{ user_id: "u1" }] },
      {
        sql: /FROM user WHERE id/,
        results: [
          { id: "u1", email: "e@x", name: "N", company: "C", phone: "P" },
        ],
      },
      { sql: /FROM user_role/, results: [{ role: "admin" }] },
    ]);
    const j = await (
      await GET(new NextRequest(SESSION, { headers: { cookie: "session_token=abc" } }))
    ).json();
    expect(j.user).toEqual({ id: "u1", email: "e@x", name: "N", company: "C", phone: "P" });
    expect(j.isAdmin).toBe(true);
  });

  it("clears the cookie on db errors", async () => {
    useHttpFallback([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 }))
    );
    const res = await GET(
      new NextRequest(SESSION, { headers: { cookie: "session_token=abc" } })
    );
    expect((await res.json()).user).toBeNull();
  });

  it("HEAD returns a bare 200", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
  });

  it("DELETE removes the session + cookie", async () => {
    useHttpFallback([{ sql: /DELETE FROM session/, results: [] }]);
    const res = await DELETE(
      new NextRequest(SESSION, {
        method: "DELETE",
        headers: { cookie: "session_token=abc" },
      })
    );
    expect((await res.json()).ok).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("session_token=");
  });

  it("DELETE without db still clears the cookie", async () => {
    const res = await DELETE(new NextRequest(SESSION, { method: "DELETE" }));
    expect((await res.json()).ok).toBe(true);
  });
});

describe("/api/auth/sandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    hoisted.db = { prepare: vi.fn() };
    hoisted.rlOk = true;
    hoisted.authError = null;
    hoisted.createError = null;
  });

  const post = (body: unknown, cookie?: string) =>
    sandboxPost(
      new NextRequest(SANDBOX, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  it("403s outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await sandboxGet(new NextRequest(SANDBOX))).status).toBe(403);
    expect((await post({ action: "test-password" })).status).toBe(403);
  });

  it("GET lists actions when enabled + db present", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const j = await (await sandboxGet(new NextRequest(SANDBOX))).json();
    expect(j.enabled).toBe(true);
    expect(j.actions).toHaveLength(4);
  });

  it("GET 503s without db", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.db = null;
    expect((await sandboxGet(new NextRequest(SANDBOX))).status).toBe(503);
  });

  it("POST 429s when rate limited", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.rlOk = false;
    expect((await post({ action: "test-password" })).status).toBe(429);
  });

  it("POST validates body + action", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await post("{bad")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ action: "nope" })).status).toBe(400);
  });

  it("test-password returns the strength result with masked pw", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const j = await (
      await post({ action: "test-password", payload: { password: "weak" } })
    ).json();
    expect(j.action).toBe("test-password");
    expect(j.password).toBe("***");
    expect(j.valid).toBe(false);
  });

  it("test-login: missing fields → 400, bad creds → 401, ok → session", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      (await post({ action: "test-login", payload: { email: "a@b" } })).status
    ).toBe(400);

    hoisted.authError = "Invalid credentials";
    expect(
      (
        await post({
          action: "test-login",
          payload: { email: "a@b", password: "x" },
        })
      ).status
    ).toBe(401);

    hoisted.authError = null;
    const j = await (
      await post({
        action: "test-login",
        payload: { email: "a@b", password: "x" },
      })
    ).json();
    expect(j.user.email).toBe("u@x");
    expect(j.session.expiresAt).toBe("2099");
  });

  it("test-register: weak pw → 400, exists → message, err → 500, ok → user", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      (
        await post({
          action: "test-register",
          payload: { email: "a@b", password: "weak" },
        })
      ).status
    ).toBe(400);

    hoisted.createError = "User already exists";
    const j1 = await (
      await post({
        action: "test-register",
        payload: { email: "a@b", password: "Str0ng!Pass123" },
      })
    ).json();
    expect(j1.message).toBe("User already exists");

    hoisted.createError = "db exploded";
    expect(
      (
        await post({
          action: "test-register",
          payload: { email: "a@b", password: "Str0ng!Pass123" },
        })
      ).status
    ).toBe(500);

    hoisted.createError = null;
    const j2 = await (
      await post({
        action: "test-register",
        payload: { email: "a@b", password: "Str0ng!Pass123", fullName: "F" },
      })
    ).json();
    expect(j2.user.id).toBe("u1");
  });

  it("check-session: no cookie / expired / valid", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const j1 = await (await post({ action: "check-session" })).json();
    expect(j1.user).toBeNull();
    expect(j1.message).toBe("No session cookie");

    // Chainable fake db — real getUserBySession + isAdmin drive
    // prepare().bind().first().
    const dbFor = (rows: Record<string, unknown[]>) => ({
      prepare: (sql: string) => {
        const key = Object.keys(rows).find((k) => sql.includes(k));
        const results = (key ? rows[key] : []) as unknown[];
        return {
          bind: () => ({
            first: async () => results[0] ?? null,
            all: async () => ({ results }),
            run: async () => ({ success: true }),
          }),
        };
      },
    });

    hoisted.db = dbFor({ "FROM session": [] });
    const res2 = await post({ action: "check-session" }, "session_token=abc");
    const j2 = await res2.json();
    expect(j2.message).toBe("Session expired");
    expect(res2.headers.get("set-cookie")).toContain("session_token=");

    hoisted.db = dbFor({
      "FROM session": [{ user_id: "u1" }],
      "FROM user WHERE": [{ id: "u1", email: "e@x", name: "N" }],
      "FROM user_role": [{ role: "admin" }],
    });
    // key matching is substring-based on the SQL text
    const res3 = await post({ action: "check-session" }, "session_token=abc");
    const j3 = await res3.json();
    expect(j3.user).toEqual({ id: "u1", email: "e@x", name: "N", isAdmin: true });
  });
});
