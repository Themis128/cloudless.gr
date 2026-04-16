/**
 * Unit tests for POST /api/admin/cache
 *
 * Verifies:
 *  - 401 when no Authorization header is present
 *  - 403 when a non-admin user token is supplied
 *  - 200 + invalidateCache() called with no prefix (clear all) for admin
 *  - 200 + invalidateCache("blog") called when prefix is provided
 *  - 200 response shape contains `ok`, `clearedPrefix`, and `clearedAt`
 *
 * Auth notes
 * ----------
 * @/lib/api-auth falls back to a decode-only (no-signature) path when
 * COGNITO_USER_POOL_ID is absent, which is the case in the Vitest jsdom
 * environment. No jose mock is therefore needed -- fake tokens with a valid
 * `exp` field are accepted automatically.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/notion-cache so we can spy on invalidateCache without touching
// the real in-memory store.
// ---------------------------------------------------------------------------
const mockInvalidateCache = vi.fn();
vi.mock("@/lib/notion-cache", () => ({
  invalidateCache: mockInvalidateCache,
  cached: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Token + request helpers
// ---------------------------------------------------------------------------

/** Build a fake admin JWT. No real signature -- accepted by the dev fallback. */
function makeAdminToken(): string {
  const payload = {
    sub: "test-admin",
    email: "admin@cloudless.gr",
    "cognito:groups": ["admin"],
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

/** Build a fake non-admin JWT. */
function makeUserToken(): string {
  const payload = {
    sub: "test-user",
    email: "user@cloudless.gr",
    "cognito:groups": [],
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

/** POST with admin token and optional JSON body. */
function adminPost(body?: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/cache", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** POST with non-admin token (no body). */
function userPost(): NextRequest {
  return new NextRequest("http://localhost/api/admin/cache", {
    method: "POST",
    headers: { Authorization: `Bearer ${makeUserToken()}` },
  });
}

/** POST with no Authorization header. */
function unauthPost(): NextRequest {
  return new NextRequest("http://localhost/api/admin/cache", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/admin/cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no Cognito pool ID is set so api-auth uses the dev decode-only fallback
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  });

  it("returns 401 when no token is provided", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const res = await POST(unauthPost());
    expect(res.status).toBe(401);
  });

  it("returns 403 when a non-admin token is provided", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const res = await POST(userPost());
    expect(res.status).toBe(403);
  });

  it("returns 200 and clears entire cache when no prefix is given", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const res = await POST(adminPost());
    expect(res.status).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.clearedPrefix).toBe("(all)");
    expect(data.clearedAt).toBeDefined();
  });

  it("returns 200 and calls invalidateCache('blog') when prefix='blog'", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const res = await POST(adminPost({ prefix: "blog" }));
    expect(res.status).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith("blog");
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.clearedPrefix).toBe("blog");
  });

  it("returns 200 and calls invalidateCache('forms') when prefix='forms'", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const res = await POST(adminPost({ prefix: "forms" }));
    expect(res.status).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith("forms");
    const data = await res.json();
    expect(data.clearedPrefix).toBe("forms");
  });

  it("clearedAt is a valid ISO timestamp within the current second", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    const before = Date.now();
    const res = await POST(adminPost());
    const after = Date.now();
    const data = await res.json();
    const ts = new Date(data.clearedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("ignores non-string prefix values and clears entire cache", async () => {
    const { POST } = await import("@/app/api/admin/cache/route");
    // numeric prefix should be treated as "no valid prefix"
    const res = await POST(adminPost({ prefix: 42 }));
    expect(res.status).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.clearedPrefix).toBe("(all)");
  });
});
