import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock next-auth/jwt so getToken returns controlled token data.
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

function makeRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:4000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy protected routes access", () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue(null); // unauthenticated by default
    mockGetAuthDbFromEnv.mockReturnValue(null);
    mockGetUserBySession.mockReset();
    mockIsAdmin.mockReset();
  });

  it("redirects unauthenticated /en/dashboard to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fdashboard");
  });

  it("redirects unauthenticated /en/admin to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fadmin");
  });

  it("allows authenticated non-admin user to access /en/dashboard and nested routes", async () => {
    mockGetToken.mockResolvedValue({ sub: "user-1", groups: ["viewer"], roles: [] });

    const dashboardResponse = await proxy(
      makeRequest("/en/dashboard", "authjs.session-token=mock")
    );
    const purchasesResponse = await proxy(
      makeRequest("/en/dashboard/purchases", "authjs.session-token=mock")
    );

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("location")).toBeNull();
    expect(purchasesResponse.status).toBe(200);
    expect(purchasesResponse.headers.get("location")).toBeNull();
  });

  it("redirects authenticated non-admin user from /en/admin and nested routes to /en/dashboard", async () => {
    mockGetToken.mockResolvedValue({ sub: "user-1", groups: ["viewer"], roles: [] });

    const adminResponse = await proxy(makeRequest("/en/admin", "authjs.session-token=mock"));
    const adminOrdersResponse = await proxy(
      makeRequest("/en/admin/orders", "authjs.session-token=mock")
    );

    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/en/dashboard");
    expect(adminOrdersResponse.status).toBe(307);
    expect(adminOrdersResponse.headers.get("location")).toContain("/en/dashboard");
  });

  it("allows authenticated admin user to access /en/admin and nested routes", async () => {
    mockGetToken.mockResolvedValue({ sub: "admin-1", groups: ["admin"], roles: [] });

    const adminResponse = await proxy(makeRequest("/en/admin", "authjs.session-token=mock"));
    const adminOrdersResponse = await proxy(
      makeRequest("/en/admin/orders", "authjs.session-token=mock")
    );

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers.get("location")).toBeNull();
    expect(adminOrdersResponse.status).toBe(200);
    expect(adminOrdersResponse.headers.get("location")).toBeNull();
  });

  it("allows D1 session_token admin through /en/admin and /en/auth/post-login", async () => {
    mockGetAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    mockGetUserBySession.mockResolvedValue({
      id: "admin-user-001",
      email: "admin@cloudless.gr",
      name: "Admin",
    });
    mockIsAdmin.mockResolvedValue(true);

    const adminResponse = await proxy(
      makeRequest("/en/admin", "session_token=d1-session-id")
    );
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers.get("location")).toBeNull();

    const postLogin = await proxy(
      makeRequest("/en/auth/post-login", "session_token=d1-session-id")
    );
    expect(postLogin.status).toBe(307);
    expect(postLogin.headers.get("location")).toContain("/en/admin");
  });

  it("routes D1 session_token non-admin from /en/admin to /en/dashboard", async () => {
    mockGetAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    mockGetUserBySession.mockResolvedValue({
      id: "user-1",
      email: "user@cloudless.gr",
      name: "User",
    });
    mockIsAdmin.mockResolvedValue(false);

    const adminResponse = await proxy(
      makeRequest("/en/admin", "session_token=d1-session-id")
    );
    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/en/dashboard");

    const postLogin = await proxy(
      makeRequest("/en/auth/post-login", "session_token=d1-session-id")
    );
    expect(postLogin.status).toBe(307);
    expect(postLogin.headers.get("location")).toContain("/en/dashboard");
  });

  it("bounces invalid D1 session_token to login", async () => {
    mockGetAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    mockGetUserBySession.mockResolvedValue(null);

    const dashboard = await proxy(
      makeRequest("/en/dashboard", "session_token=expired-or-forged")
    );
    expect(dashboard.status).toBe(307);
    expect(dashboard.headers.get("location")).toContain("/en/auth/login");
  });

  it("redirects unprefixed /store to /en/store (localePrefix always)", async () => {
    const response = await proxy(makeRequest("/store"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/store");
  });

  it("does not locale-prefix /api, /portal, or file-like paths", async () => {
    const api = await proxy(makeRequest("/api/health"));
    expect(api.headers.get("location")).toBeNull();
    const portal = await proxy(makeRequest("/portal/waiting"));
    expect(portal.status).toBe(200);
    expect(portal.headers.get("location")).toBeNull();
    const sitemap = await proxy(makeRequest("/sitemap.xml"));
    expect(sitemap.headers.get("location")).toBeNull();
    const robots = await proxy(makeRequest("/robots.txt"));
    expect(robots.headers.get("location")).toBeNull();
  });
});
