// @vitest-environment node
/**
 * auth routes — getHttpAuthDbFallback Cloudflare D1 REST client.
 * getAuthDbFromEnv returns null + CF envs set → the route builds an HTTP
 * client; downstream mocks capture it and exercise stmt all/run/first
 * against a stubbed fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const authenticateUser = vi.fn();
const getUserBySession = vi.fn();
const isAdmin = vi.fn();
const checkFailedAttempts = vi.fn();
const logSessionActivity = vi.fn();
const createUser = vi.fn();
const createPasswordResetToken = vi.fn();
const markEmailVerified = vi.fn();
const validateSessionSecret = vi.fn();
const validatePasswordStrength = vi.fn();
const getAuthDbFromEnv = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  authenticateUser: (...a: unknown[]) => authenticateUser(...a),
  getUserBySession: (...a: unknown[]) => getUserBySession(...a),
  isAdmin: (...a: unknown[]) => isAdmin(...a),
  checkFailedAttempts: (...a: unknown[]) => checkFailedAttempts(...a),
  logSessionActivity: (...a: unknown[]) => logSessionActivity(...a),
  createUser: (...a: unknown[]) => createUser(...a),
  createPasswordResetToken: (...a: unknown[]) => createPasswordResetToken(...a),
  markEmailVerified: (...a: unknown[]) => markEmailVerified(...a),
  validateSessionSecret: (...a: unknown[]) => validateSessionSecret(...a),
  validatePasswordStrength: (...a: unknown[]) => validatePasswordStrength(...a),
  getAuthDbFromEnv: (...a: unknown[]) => getAuthDbFromEnv(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/d1-http", () => ({ isD1WriteLimitError: () => false }));
vi.mock("@/lib/auth-activation", () => ({
  verifyActivationOtp: vi.fn(() => true),
  verifyActivationToken: vi.fn(() => true),
}));
vi.mock("@/lib/canonical-origin", () => ({ canonicalOrigin: () => "https://cloudless.gr" }));
vi.mock("@/lib/admin-notifications", () => ({ recordNotification: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendActivationEmail: vi.fn(async () => {}),
  notifyTeam: vi.fn(async () => {}),
}));
vi.mock("@/lib/slack-notify", () => ({ slackRegistrationNotify: vi.fn(async () => true) }));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn(async () => {}) }));

type D1 = { prepare: (sql: string) => unknown };
type Stmt = {
  bind: (...a: unknown[]) => Stmt;
  all: <T>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
  first: <T>(col?: string) => Promise<T | null>;
};

const origFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function d1Ok(results: unknown[] = [], changes = 1) {
  return new Response(
    JSON.stringify({ success: true, result: [{ results, success: true, meta: { changes } }] }),
    { status: 200 }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthDbFromEnv.mockReturnValue(null);
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc-1";
  process.env.CLOUDFLARE_API_TOKEN = "tok-1";
  fetchMock = vi.fn(async () => d1Ok([{ id: "u1", email: "a@b.c" }]));
  globalThis.fetch = fetchMock;
  validateSessionSecret.mockReturnValue({ valid: true });
  validatePasswordStrength.mockReturnValue({ valid: true });
  checkFailedAttempts.mockResolvedValue({ locked: false });
  logSessionActivity.mockResolvedValue(undefined);
  isAdmin.mockResolvedValue(false);
});

afterEach(() => {
  globalThis.fetch = origFetch;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
});

async function exerciseDb(db: unknown) {
  const d = db as D1;
  const stmt = d.prepare("SELECT * FROM users WHERE email = ?") as Stmt;
  const bound = stmt.bind("a@b.c");
  const all = await bound.all<{ id: string }>();
  expect(all.results[0].id).toBe("u1");
  const first = await bound.first<{ id: string }>();
  expect(first?.id).toBe("u1");
  const colOnly = await bound.first<string>("email");
  expect(colOnly).toBe("a@b.c");
  const run = await bound.run();
  expect(run.success).toBe(true);
  const url = String(fetchMock.mock.calls[0][0]);
  expect(url).toContain("api.cloudflare.com/client/v4/accounts/acc-1/d1/database/");
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
}

describe("login route HTTP D1 fallback", () => {
  it("builds and exercises the HTTP client", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    authenticateUser.mockImplementation(async (db: unknown) => {
      await exerciseDb(db);
      return { user: { id: "u1", email: "a@b.c" }, session: { id: "s1", token: "t" } };
    });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c", password: "p" }),
      })
    );
    expect(res.status).not.toBe(503);
  });

  it("returns empty results on upstream failure", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );
    const { POST } = await import("@/app/api/auth/login/route");
    authenticateUser.mockImplementation(async (db: unknown) => {
      const d = db as D1;
      const stmt = d.prepare("SELECT 1") as Stmt;
      const all = await stmt.bind().all();
      expect(all).toEqual({ results: [], success: false });
      const run = await stmt.bind().run();
      expect(run.success).toBe(false);
      const first = await stmt.bind().first();
      expect(first).toBeNull();
      return { error: "Invalid credentials" };
    });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c", password: "p" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("register route HTTP D1 fallback", () => {
  it("builds the HTTP client when no binding", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    createUser.mockImplementation(async (db: unknown) => {
      await exerciseDb(db);
      return { user: { id: "u1", email: "n@b.c" } };
    });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "n@b.c", password: "Str0ng!Pass" }),
      })
    );
    expect(res.status).not.toBe(503);
  });
});

describe("activate route HTTP D1 fallback", () => {
  it("confirmUserD1 uses the HTTP client", async () => {
    markEmailVerified.mockImplementation(async (db: unknown) => {
      await exerciseDb(db);
      return true;
    });
    const { GET } = await import("@/app/api/auth/activate/route");
    const res = await GET(
      new NextRequest("https://x/api/auth/activate?email=a@b.c&token=t")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/auth/login?activated=1");
  });

  it("HTTP stmt returns its non-ok fallbacks for all/run", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );
    markEmailVerified.mockImplementation(async (db: unknown) => {
      const stmt = (db as D1).prepare("SELECT 1") as Stmt;
      expect(await stmt.bind().all()).toEqual({ results: [], success: false });
      expect(await stmt.bind().run()).toEqual({ success: false, meta: { changes: 0 } });
      return false;
    });
    const { GET } = await import("@/app/api/auth/activate/route");
    const res = await GET(new NextRequest("https://x/api/auth/activate?email=a@b.c&token=t"));
    expect(res.headers.get("location")).toContain("activated=error");
  });
});

describe("confirm route HTTP D1 fallback", () => {
  it("uses the HTTP client for markEmailVerified", async () => {
    markEmailVerified.mockImplementation(async (db: unknown) => {
      await exerciseDb(db);
      return true;
    });
    const { POST } = await import("@/app/api/auth/confirm/route");
    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c", code: "123456", token: "tok" }),
      })
    );
    expect((await res.json()).ok).toBe(true);
  });

  it("HTTP stmt all() returns its non-ok fallback", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );
    markEmailVerified.mockImplementation(async (db: unknown) => {
      const stmt = (db as D1).prepare("SELECT 1") as Stmt;
      expect(await stmt.bind().all()).toEqual({ results: [], success: false });
      return false;
    });
    const { POST } = await import("@/app/api/auth/confirm/route");
    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c", code: "123456", token: "tok" }),
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("reset-password route HTTP D1 fallback", () => {
  it("HTTP stmt first(col) returns null for a missing column", async () => {
    createPasswordResetToken.mockImplementation(async (db: unknown) => {
      const stmt = (db as D1).prepare("SELECT 1") as Stmt;
      const bound = stmt.bind();
      expect(await bound.first<string>("nonexistent_col")).toBeNull();
      return {};
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(
      new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c" }),
      })
    );
    expect(res.status).not.toBe(503);
  });
});

describe("register route tails", () => {
  it("HTTP stmt returns its non-ok fallbacks for all/run", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );
    const { POST } = await import("@/app/api/auth/register/route");
    createUser.mockImplementation(async (db: unknown) => {
      const d = db as D1;
      const stmt = d.prepare("SELECT 1") as Stmt;
      const all = await stmt.bind().all();
      expect(all).toEqual({ results: [], success: false });
      const run = await stmt.bind().run();
      expect(run).toEqual({ success: false, meta: { changes: 0 } });
      return { user: { id: "u1", email: "n@b.c" } };
    });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "n@b.c", password: "Str0ng!Pass" }),
      })
    );
    expect(res.status).not.toBe(503);
  });

  it("warns when the session secret fails validation", async () => {
    validateSessionSecret.mockReturnValue({ valid: false, error: "too short" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/register/route");
    createUser.mockResolvedValue({ user: { id: "u1", email: "n@b.c" } });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "n@b.c", password: "Str0ng!Pass" }),
      })
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET validation"),
      "too short"
    );
    warn.mockRestore();
    expect(res.status).not.toBe(503);
  });

  it("still succeeds when the activation email send rejects", async () => {
    const emailMod = await import("@/lib/email");
    vi.mocked(emailMod.sendActivationEmail).mockRejectedValueOnce(new Error("smtp down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/register/route");
    createUser.mockResolvedValue({ user: { id: "u1", email: "n@b.c" } });
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "n@b.c", password: "Str0ng!Pass" }),
      })
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("activation email failed"),
      expect.any(Error)
    );
    err.mockRestore();
    expect(res.status).not.toBe(503);
  });
});
