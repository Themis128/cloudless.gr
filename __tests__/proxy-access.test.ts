import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

import { proxy } from "@/proxy";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function makeAuthCookies(isAdmin = false): string {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID as string;
  const username = "test-user";
  const token = makeJwt({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "cognito:groups": isAdmin ? ["admin"] : ["users"],
  });

  return [
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser=${username}`,
    `CognitoIdentityServiceProvider.${clientId}.${username}.accessToken=${token}`,
  ].join("; ");
}

function makeRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:4000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy protected routes access", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client-id";
  });

  it("redirects unauthenticated /en/dashboard to /en/auth/login", () => {
    const response = proxy(makeRequest("/en/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fen%2Fdashboard");
  });

  it("redirects unauthenticated /en/admin to /en/auth/login", () => {
    const response = proxy(makeRequest("/en/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fen%2Fadmin");
  });

  it("allows authenticated non-admin user to access /en/dashboard and nested routes", () => {
    const cookie = makeAuthCookies(false);
    const dashboardResponse = proxy(makeRequest("/en/dashboard", cookie));
    const purchasesResponse = proxy(makeRequest("/en/dashboard/purchases", cookie));

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("location")).toBeNull();
    expect(purchasesResponse.status).toBe(200);
    expect(purchasesResponse.headers.get("location")).toBeNull();
  });

  it("redirects authenticated non-admin user from /en/admin and nested routes to /en/dashboard", () => {
    const cookie = makeAuthCookies(false);
    const adminResponse = proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = proxy(makeRequest("/en/admin/orders", cookie));

    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/en/dashboard");
    expect(adminOrdersResponse.status).toBe(307);
    expect(adminOrdersResponse.headers.get("location")).toContain("/en/dashboard");
  });

  it("allows authenticated admin user to access /en/admin and nested routes", () => {
    const cookie = makeAuthCookies(true);
    const adminResponse = proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = proxy(makeRequest("/en/admin/orders", cookie));

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers.get("location")).toBeNull();
    expect(adminOrdersResponse.status).toBe(200);
    expect(adminOrdersResponse.headers.get("location")).toBeNull();
  });
});
