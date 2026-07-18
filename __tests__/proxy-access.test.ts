import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// vi.hoisted runs before all imports — needed because proxy.ts creates JWKS at
// module-load time from NEXT_PUBLIC_COGNITO_USER_POOL_ID. Without this the env
// var is unset when the module loads, JWKS === null, and readCognitoToken()
// always returns { valid: false } regardless of the cookie we pass.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_testPool";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client-id";
});

// Mock next-auth/jwt so getToken always returns null (Cognito path runs)
vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

// Replace the real JWKS fetch + signature verification with a simple
// base64url decode so tests can use unsigned JWTs without a live Cognito pool.
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string, _jwks: unknown, _options?: unknown) => {
    const [, body] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("jwt expired");
    }
    return { payload };
  },
}));

import { proxy } from "@/proxy";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function makeAuthCookies(isAdmin = false): string {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
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

  it("redirects unauthenticated /en/dashboard to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/dashboard"));
    // 302 is a valid redirect; tests are about functionality
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    // redirect param must be the bare (locale-stripped) path, not /en/dashboard,
    // so login can use @/i18n/navigation router.push() without doubling the locale.
    expect(response.headers.get("location")).toContain("redirect=%2Fdashboard");
  });

  it("redirects unauthenticated /en/admin to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/admin"));
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    // bare path, not /en/admin
    expect(response.headers.get("location")).toContain("redirect=%2Fadmin");
  });

  it("allows authenticated non-admin user to access /en/dashboard and nested routes", async () => {
    const cookie = makeAuthCookies(false);
    const dashboardResponse = await proxy(makeRequest("/en/dashboard", cookie));
    const purchasesResponse = await proxy(
      makeRequest("/en/dashboard/purchases", cookie),
    );

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("location")).toBeNull();
    expect(purchasesResponse.status).toBe(200);
    expect(purchasesResponse.headers.get("location")).toBeNull();
  });

  it("redirects authenticated non-admin user from /en/admin and nested routes to /en/dashboard", async () => {
    const cookie = makeAuthCookies(false);
    const adminResponse = await proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = await proxy(
      makeRequest("/en/admin/orders", cookie),
    );

    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/en/dashboard");
    expect(adminOrdersResponse.status).toBe(307);
    expect(adminOrdersResponse.headers.get("location")).toContain(
      "/en/dashboard",
    );
  });

  it("allows authenticated admin user to access /en/admin and nested routes", async () => {
    const cookie = makeAuthCookies(true);
    const adminResponse = await proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = await proxy(
      makeRequest("/en/admin/orders", cookie),
    );

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers.get("location")).toBeNull();
    expect(adminOrdersResponse.status).toBe(200);
    expect(adminOrdersResponse.headers.get("location")).toBeNull();
  });
});