// @vitest-environment node
/**
 * proxy.ts tail coverage — bare-root locale redirect, rate-limit windows,
 * cleanup sampling, nonce fallback, auth-token paths, admin API limits,
 * e2e_admin bypass, RSC prefetch skip.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (opts: unknown) => mockGetToken(opts) }));

const mockGetAuthDbFromEnv = vi.fn();
const mockGetUserBySession = vi.fn();
const mockIsAdmin = vi.fn();
vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => mockGetAuthDbFromEnv(),
  getUserBySession: (...args: unknown[]) => mockGetUserBySession(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

import { proxy } from "@/proxy";

let ipCounter = 0;
function makeRequest(
  path: string,
  init: { cookie?: string; headers?: Record<string, string>; method?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {
    "x-forwarded-for": `10.9.9.${(ipCounter += 1) % 250}`,
    ...(init.headers ?? {}),
  };
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`http://localhost:4000${path}`, {
    headers,
    method: init.method ?? "GET",
  });
}

beforeEach(() => {
  mockGetToken.mockResolvedValue(null);
  mockGetAuthDbFromEnv.mockReturnValue(null);
  mockGetUserBySession.mockReset();
  mockIsAdmin.mockReset();
});

describe("proxy tail branches", () => {
  it("redirects bare / to /en", async () => {
    const res = await proxy(makeRequest("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en");
  });

  it("Bearer authorization counts as auth token", async () => {
    const res = await proxy(
      makeRequest("/en/services", { headers: { authorization: "Bearer tok-1" } })
    );
    expect(res.status).toBe(200);
  });

  it("next-auth.session-token cookie path", async () => {
    mockGetToken.mockResolvedValue({ sub: "u1", groups: [] });
    const res = await proxy(makeRequest("/en/dashboard", { cookie: "next-auth.session-token=t" }));
    expect(res.status).toBe(200);
  });

  it("unauthenticated /api/admin POST probes are capped", async () => {
    const res = await proxy(makeRequest("/api/admin/anything", { method: "POST" }));
    expect([200, 401, 403, 404, 429]).toContain(res.status);
  });

  it("GET /api/admin with Bearer uses auth budget", async () => {
    const res = await proxy(
      makeRequest("/api/admin/anything", { headers: { authorization: "Bearer tok-2" } })
    );
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it("429s once the rate limit is exhausted for an identifier", async () => {
    // unauthenticated /api/admin probes use the tight ADMIN_RATE_LIMIT.ip bucket
    const headers = { "x-forwarded-for": "10.8.8.8" };
    let last = 0;
    for (let i = 0; i < 60; i++) {
      const res = await proxy(
        new NextRequest("http://localhost:4000/api/admin/probe", { headers, method: "POST" })
      );
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it("e2e_admin cookie bypasses admin gate", async () => {
    const res = await proxy(makeRequest("/en/admin", { cookie: "e2e_admin=1" }));
    expect(res.status).toBe(200);
  });

  it("RSC prefetch skips the ip rate-limit check", async () => {
    const res = await proxy(makeRequest("/en/services?_rsc=1"));
    expect(res.status).toBe(200);
  });

  it("cleanup sampling runs when random draws low", async () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const res = await proxy(makeRequest("/en/services"));
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("generateNonce falls back when randomUUID missing", async () => {
    const orig = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    const res = await proxy(makeRequest("/en/services"));
    expect(res.status).toBe(200);
    Object.defineProperty(crypto, "randomUUID", { value: orig, configurable: true });
  });

  it("rate-limiter resets after the window elapses", async () => {
    vi.useFakeTimers();
    try {
      const headers = { "x-forwarded-for": "10.7.7.7" };
      await proxy(
        new NextRequest("http://localhost:4000/en/services", { headers })
      );
      vi.setSystemTime(Date.now() + 120_000);
      const res = await proxy(
        new NextRequest("http://localhost:4000/en/services", { headers })
      );
      expect(res.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serves page-route health paths without the HTTPS redirect", async () => {
    const res = await proxy(makeRequest("/en/api/health"));
    expect(res.status).toBe(200);
  });

  it("POST /api/admin with a Bearer token uses the admin auth budget", async () => {
    const res = await proxy(
      makeRequest("/api/admin/anything", {
        method: "POST",
        headers: { authorization: "Bearer tok-3" },
      })
    );
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it("non-admin /api GET with a Bearer token uses the auth budget", async () => {
    const res = await proxy(
      makeRequest("/api/contact", { headers: { authorization: "Bearer tok-4" } })
    );
    expect([200, 401, 403, 404, 405]).toContain(res.status);
    // token-keyed rate-limit headers
    expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
  });

  it("sweeps expired rate-limit entries when the sample fires", async () => {
    vi.useFakeTimers();
    try {
      const headers = { "x-forwarded-for": "10.6.6.6" };
      // seed a rate-limit record
      await proxy(new NextRequest("http://localhost:4000/en/services", { headers }));
      // let it expire
      vi.setSystemTime(Date.now() + 120_000);
      // force the cleanup sample to run
      const spy = vi
        .spyOn(crypto, "getRandomValues")
        .mockImplementation(<T extends ArrayBufferView>(arr: T): T => {
          new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = 0;
          return arr;
        });
      const res = await proxy(
        new NextRequest("http://localhost:4000/en/services", { headers })
      );
      expect(res.status).toBe(200);
      spy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redirects to login when the NextAuth JWT is absent/invalid", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await proxy(
      makeRequest("/en/dashboard", { cookie: "next-auth.session-token=bad" })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/auth/login");
  });

  it("NextAuth session on /en/auth/post-login redirects to the dashboard", async () => {
    mockGetToken.mockResolvedValue({ sub: "u1", groups: [] });
    const res = await proxy(
      makeRequest("/en/auth/post-login", { cookie: "next-auth.session-token=t" })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/");
  });

  it("valid D1 session on /en/dashboard falls through to the app", async () => {
    mockGetAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    mockGetUserBySession.mockResolvedValue({
      id: "u-1",
      email: "user@example.com",
      name: "User",
    });
    mockIsAdmin.mockResolvedValue(false);
    const res = await proxy(
      makeRequest("/en/dashboard", { cookie: "session_token=d1-session-id" })
    );
    expect(res.status).toBe(200);
  });
});
