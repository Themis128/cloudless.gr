// @vitest-environment node
/**
 * proxy.ts residual branches: non-/en destinations for dotted (locale-exempt)
 * protected paths through both the D1 and NextAuth checks, sessions without
 * groups, missing D1 binding, blank forwarded-for IPs, and the development
 * build's relaxed limits / no HSTS / no upgrade-insecure-requests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

let ipCounter = 0;
function req(
  path: string,
  init: { cookie?: string; headers?: Record<string, string>; method?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {
    "x-forwarded-for": `10.8.7.${(ipCounter += 1) % 250}`,
    ...(init.headers ?? {}),
  };
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`http://localhost:4000${path}`, {
    headers,
    method: init.method ?? "GET",
  });
}

const location = (r: Response) => new URL(r.headers.get("location")!).pathname;

async function loadProxy() {
  vi.resetModules();
  return (await import("@/proxy")).proxy;
}

beforeEach(() => {
  mockGetToken.mockReset().mockResolvedValue(null);
  mockGetAuthDbFromEnv.mockReset().mockReturnValue({ db: true });
  mockGetUserBySession.mockReset();
  mockIsAdmin.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy — unprefixed (dotted) protected paths use the bare destinations", () => {
  // A dot in the last segment skips the locale redirect, so these reach the
  // auth checks with no /en prefix.
  it("D1 session: post-login sends admins to /admin and users to /dashboard", async () => {
    const proxy = await loadProxy();
    mockGetUserBySession.mockResolvedValue({ id: "u1" });
    mockIsAdmin.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const a = await proxy(req("/auth/post-login.x", { cookie: "session_token=d1" }));
    const b = await proxy(req("/auth/post-login.x", { cookie: "session_token=d1" }));
    expect([a.status, location(a)]).toEqual([307, "/admin"]);
    expect([b.status, location(b)]).toEqual([307, "/dashboard"]);
  });

  it("D1 session: non-admin on /admin.x goes to /dashboard", async () => {
    const proxy = await loadProxy();
    mockGetUserBySession.mockResolvedValue({ id: "u1" });
    mockIsAdmin.mockResolvedValue(false);
    const r = await proxy(req("/admin.x", { cookie: "session_token=d1" }));
    expect(location(r)).toBe("/dashboard");
  });

  it("NextAuth: post-login and non-admin redirects use bare paths", async () => {
    const proxy = await loadProxy();
    mockGetToken.mockResolvedValue({ sub: "u", groups: ["admin"] });
    const a = await proxy(req("/auth/post-login.x", { cookie: "authjs.session-token=t" }));
    expect(location(a)).toBe("/admin");

    // a session with no groups at all is not an admin
    mockGetToken.mockResolvedValue({ sub: "u" });
    const b = await proxy(req("/auth/post-login.x", { cookie: "authjs.session-token=t" }));
    const c = await proxy(req("/admin.x", { cookie: "authjs.session-token=t" }));
    expect(location(b)).toBe("/dashboard");
    expect(location(c)).toBe("/dashboard");
  });

  it("no session on an unprefixed post-login path → bare /auth/login", async () => {
    const proxy = await loadProxy();
    const r = await proxy(req("/auth/post-login.x"));
    expect(r.status).toBe(307);
    expect(location(r)).toBe("/auth/login");
    expect(new URL(r.headers.get("location")!).search).toBe("");
  });

  it("missing D1 binding falls through to the NextAuth check", async () => {
    const proxy = await loadProxy();
    mockGetAuthDbFromEnv.mockReturnValue(null);
    mockGetToken.mockResolvedValue({ sub: "u", groups: ["admin"] });
    const r = await proxy(req("/en/admin", { cookie: "session_token=d1" }));
    expect(r.status).toBe(200);
    expect(mockGetUserBySession).not.toHaveBeenCalled();
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });
});

describe("proxy — client IP fallback", () => {
  it("a blank forwarded-for is rate-limited under the shared 'unknown' key", async () => {
    const proxy = await loadProxy();
    // A literal "unknown" client IP and a blank first forwarded-for hop must
    // land in the same bucket; with no `|| "unknown"` fallback the blank one
    // would get its own "" bucket and Remaining would restart at 99.
    const literal = { headers: { "x-forwarded-for": "unknown" } };
    const blank = { headers: { "x-forwarded-for": " , 10.0.0.1" } };
    const first = await proxy(req("/api/health", literal));
    expect(first.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("99");
    const api = await proxy(req("/api/health", blank));
    expect(api.headers.get("X-RateLimit-Remaining")).toBe("98");

    // Page routes charge the same bucket: use up the rest of the 100 with
    // "unknown" requests, then a blank forwarded-for page hit is refused.
    for (let i = 0; i < 98; i += 1) {
      const r = await proxy(req("/en/store", literal));
      expect(r.status).toBe(200);
    }
    const page = await proxy(req("/en/store", blank));
    expect(page.status).toBe(429);
    // a real client IP is unaffected
    const other = await proxy(req("/en/store"));
    expect(other.status).toBe(200);
  });
});

describe("proxy — development build", () => {
  it("uses the dev rate limits and omits HSTS / upgrade-insecure-requests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const proxy = await loadProxy();

    const anon = await proxy(req("/api/health"));
    expect(anon.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(anon.headers.get("Strict-Transport-Security")).toBeNull();
    expect(anon.headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");

    const bearer = { headers: { authorization: "Bearer tok" } };
    const authed = await proxy(req("/api/health", bearer));
    expect(authed.headers.get("X-RateLimit-Limit")).toBe("2000");

    const adminProbe = await proxy(req("/api/admin/x", { method: "POST" }));
    expect(adminProbe.headers.get("X-RateLimit-Limit")).toBe("1000");
    const adminWrite = await proxy(req("/api/admin/x", { method: "POST", ...bearer }));
    expect(adminWrite.headers.get("X-RateLimit-Limit")).toBe("2000");
  });

  it("production build sends HSTS and upgrade-insecure-requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const proxy = await loadProxy();
    const r = await proxy(req("/api/health"));
    expect(r.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(r.headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
  });
});
