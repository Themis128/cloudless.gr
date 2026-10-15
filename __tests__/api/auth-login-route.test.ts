/**
 * api/auth/login — POST (credential login) + GET (session check).
 * Real route + zod parsing + cookie handling; D1/auth helpers faked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockUserBySession = vi.fn();
const mockIsAdmin = vi.fn();
const mockFailedAttempts = vi.fn();
const mockLogActivity = vi.fn();
const mockSecretCheck = vi.fn();
const mockGetDb = vi.fn();
vi.mock("@/lib/auth-d1", () => ({
  authenticateUser: (...a: unknown[]) => mockAuth(...a),
  getUserBySession: (...a: unknown[]) => mockUserBySession(...a),
  isAdmin: (...a: unknown[]) => mockIsAdmin(...a),
  checkFailedAttempts: (...a: unknown[]) => mockFailedAttempts(...a),
  logSessionActivity: (...a: unknown[]) => mockLogActivity(...a),
  validateSessionSecret: (...a: unknown[]) => mockSecretCheck(...a),
  getAuthDbFromEnv: (...a: unknown[]) => mockGetDb(...a),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

const mockWriteLimit = vi.fn();
vi.mock("@/lib/d1-http", () => ({
  isD1WriteLimitError: (...a: unknown[]) => mockWriteLimit(...a),
}));

import { POST, GET } from "@/app/api/auth/login/route";

const db = { prepare: vi.fn() };

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDb.mockReturnValue(db);
  mockSecretCheck.mockReturnValue({ valid: true });
  mockRateLimit.mockReturnValue({ ok: true });
  mockFailedAttempts.mockResolvedValue({ locked: false });
  mockLogActivity.mockResolvedValue(undefined);
  mockIsAdmin.mockResolvedValue(false);
  mockWriteLimit.mockReturnValue(false);
});

describe("POST /api/auth/login", () => {
  it("400 on malformed/missing credentials", async () => {
    for (const bad of [{}, { email: "" }, { email: "a@b.c" }, { email: 5, password: "x" }]) {
      const res = await POST(req(bad));
      expect(res.status).toBe(400);
    }
    const res = await POST(req({ email: "", password: "" }));
    expect((await res.json()).error).toBe("Email is required");
  });

  it("400 with generic message on a non-JSON body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not valid json",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request body");
  });

  it("503 when the auth DB is not configured", async () => {
    mockGetDb.mockReturnValue(null);
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Auth not configured");
  });

  it("respects the IP rate limit", async () => {
    mockRateLimit.mockReturnValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "slow down" }), { status: 429 }),
    });
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(429);
  });

  it("429 on locked account", async () => {
    mockFailedAttempts.mockResolvedValue({ locked: true });
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("locked");
  });

  it("401 on bad credentials and logs the failed attempt", async () => {
    mockAuth.mockResolvedValue({ error: "Invalid email or password" });
    const res = await POST(req({ email: "a@b.c", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(mockLogActivity).toHaveBeenCalledWith(
      db, "failed-attempt", "failed_attempt", "a@b.c", "1.2.3.4", undefined
    );
  });

  it("500 when auth returns no session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u" }, session: null });
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(500);
  });

  it("success → user payload, admin flag, session cookie (30d)", async () => {
    mockAuth.mockResolvedValue({
      session: { id: "sess_1" },
      user: { id: "u1", email: "a@b.c", name: "A", company: "C", phone: "1" },
    });
    mockIsAdmin.mockResolvedValue(true);
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.isAdmin).toBe(true);
    expect(body.user.email).toBe("a@b.c");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("session_token=sess_1");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Max-Age=2592000");
    expect(mockLogActivity).toHaveBeenCalledWith(
      db, "sess_1", "login", "a@b.c", "1.2.3.4", undefined
    );
  });

  it("rememberMe → 60-day cookie", async () => {
    mockAuth.mockResolvedValue({
      session: { id: "s" },
      user: { id: "u", email: "a@b.c" },
    });
    const res = await POST(req({ email: "a@b.c", password: "p", rememberMe: true }));
    expect(res.headers.get("set-cookie")).toContain("Max-Age=5184000");
    expect(mockAuth).toHaveBeenCalledWith(db, "a@b.c", "p", true);
  });

  it("warns but proceeds when SESSION_SECRET validation fails", async () => {
    mockSecretCheck.mockReturnValue({ valid: false, error: "weak" });
    mockAuth.mockResolvedValue({ session: { id: "s" }, user: { id: "u", email: "a@b.c" } });
    const res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(200);
  });

  it("503 on D1 write-limit error, 500 on generic failure", async () => {
    mockWriteLimit.mockReturnValue(true);
    mockAuth.mockRejectedValue(new Error("D1 write limit"));
    let res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("D1 write limit");

    mockWriteLimit.mockReturnValue(false);
    mockAuth.mockRejectedValue(new Error("other"));
    res = await POST(req({ email: "a@b.c", password: "p" }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/auth/login", () => {
  const getReq = (cookie?: string) =>
    new NextRequest("http://localhost/api/auth/login", {
      headers: cookie ? { cookie: `session_token=${cookie}` } : {},
    });

  it("null user when db unbound or no cookie", async () => {
    mockGetDb.mockReturnValue(null);
    expect((await (await GET(getReq("s"))).json()).user).toBeNull();
    mockGetDb.mockReturnValue(db);
    expect((await (await GET(getReq())).json()).user).toBeNull();
  });

  it("clears the cookie on a stale session", async () => {
    mockUserBySession.mockResolvedValue(null);
    const res = await GET(getReq("stale"));
    expect((await res.json()).user).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("session_token=");
  });

  it("returns the user + admin flag on a live session", async () => {
    mockUserBySession.mockResolvedValue({ id: "u1", email: "a@b.c", name: "A", company: "C", phone: "9" });
    mockIsAdmin.mockResolvedValue(true);
    const res = await GET(getReq("live"));
    const body = await res.json();
    expect(body.user.id).toBe("u1");
    expect(body.isAdmin).toBe(true);
  });
});
