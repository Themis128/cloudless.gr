import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

// Mock jose: replace jwtVerify with a decode-only version so tests can use
// fake-signed tokens without hitting the real Cognito JWKS endpoint. Same
// pattern as __tests__/admin-api.test.ts and the other admin-*.test.ts files.
vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

// proxy.ts captures JWKS at module load time from NEXT_PUBLIC_COGNITO_USER_POOL_ID.
// If that's empty, readCognitoToken short-circuits to invalid for every request and
// the authenticated-user tests below would redirect to /auth/login. vi.hoisted()
// runs before vi.mock() hoists and before ESM import hoisting, so the env vars are
// set before the proxy module's top-level code (which reads them) executes.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_TestPool";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client-id";
});

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

  it("redirects unauthenticated /en/dashboard to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fen%2Fdashboard");
  });

  it("redirects unauthenticated /en/admin to /en/auth/login", async () => {
    const response = await proxy(makeRequest("/en/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/en/auth/login");
    expect(response.headers.get("location")).toContain("redirect=%2Fen%2Fadmin");
  });

  it("allows authenticated non-admin user to access /en/dashboard and nested routes", async () => {
    const cookie = makeAuthCookies(false);
    const dashboardResponse = await proxy(makeRequest("/en/dashboard", cookie));
    const purchasesResponse = await proxy(makeRequest("/en/dashboard/purchases", cookie));

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("location")).toBeNull();
    expect(purchasesResponse.status).toBe(200);
    expect(purchasesResponse.headers.get("location")).toBeNull();
  });

  it("redirects authenticated non-admin user from /en/admin and nested routes to /en/dashboard", async () => {
    const cookie = makeAuthCookies(false);
    const adminResponse = await proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = await proxy(makeRequest("/en/admin/orders", cookie));

    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/en/dashboard");
    expect(adminOrdersResponse.status).toBe(307);
    expect(adminOrdersResponse.headers.get("location")).toContain("/en/dashboard");
  });

  it("allows authenticated admin user to access /en/admin and nested routes", async () => {
    const cookie = makeAuthCookies(true);
    const adminResponse = await proxy(makeRequest("/en/admin", cookie));
    const adminOrdersResponse = await proxy(makeRequest("/en/admin/orders", cookie));

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers.get("location")).toBeNull();
    expect(adminOrdersResponse.status).toBe(200);
    expect(adminOrdersResponse.headers.get("location")).toBeNull();
  });
});
