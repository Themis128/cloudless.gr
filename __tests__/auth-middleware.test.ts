import { test, expect, vi } from "vitest";

// Mock next/server to avoid importing the full Next.js server module
vi.mock("next/server", () => ({
  NextRequest: class NextRequest extends Request {
    constructor(input: string | URL | Request, init?: RequestInit) {
      super(input, init);
    }
  },
  NextResponse: class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      super(body, init);
    }
    static json(body: unknown, init?: ResponseInit) {
      return new NextResponse(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    }
    static redirect(url: string | URL, status = 302) {
      return new NextResponse(null, { status, headers: { location: String(url) } });
    }
  },
}));

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin, optionalAuth } from "@/lib/auth-middleware";
import { mockRequest } from "./mock-request";

test.describe("Auth Middleware Tests", () => {
  test("requireAuth should return 401 for unauthenticated users", async () => {
    const request = mockRequest({ url: "http://example.com/api/test" });
    const response = await requireAuth(request);

    expect(response.ok).toBe(false);
    expect(response.response).toBeInstanceOf(NextResponse);
    expect(response.response.status).toBe(401);
  });

  test("requireAuth should allow authenticated users", async () => {
    const request = mockRequest({
      url: "http://example.com/api/test",
      headers: { "x-auth-user": "123" },
    });
    const response = await requireAuth(request);

    expect(response.ok).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user).toHaveProperty("sub", "123");
  });

  test("requireAdmin should return 403 for non-admin users", async () => {
    const request = mockRequest({
      url: "http://example.com/api/admin",
      headers: { "x-auth-user": "123" },
    });
    const response = await requireAdmin(request);

    expect(response.ok).toBe(false);
    expect(response.response).toBeInstanceOf(NextResponse);
    expect(response.response.status).toBe(403);
  });

  test("requireAdmin should allow admin users", async () => {
    const request = mockRequest({
      url: "http://example.com/api/admin",
      headers: { "x-auth-user": "123", "x-auth-role": "admin" },
    });
    const response = await requireAdmin(request);

    expect(response.ok).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user).toHaveProperty("sub", "123");
    expect(response.user).toHaveProperty("groups", ["admin"]);
  });

  test("optionalAuth should echo x-auth-user header when present", async () => {
    const request = mockRequest({
      url: "http://example.com/api/test",
      headers: { "x-auth-user": "123" },
    });
    const response = await optionalAuth(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-auth-user")).toBe("123");
  });
});
