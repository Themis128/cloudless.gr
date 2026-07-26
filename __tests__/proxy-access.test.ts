import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock next-auth/jwt so getToken returns controlled token data.
// proxy.ts calls getToken() to read the next-auth session cookie.
const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (opts: unknown) => mockGetToken(opts) }));

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
});
