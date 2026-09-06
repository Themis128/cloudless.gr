import { describe, it, expect, vi } from "vitest";

const { mockRequireAuth, mockRequireAdmin, mockIsAdmin, mockGetToken } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockGetToken: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
  requireAdmin: mockRequireAdmin,
  isAdmin: mockIsAdmin,
  getTokenFromHeader: mockGetToken,
}));

import { requireAuth, requireAdmin, isAdmin, getTokenFromHeader } from "@/lib/auth-middleware";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("requireAuth", () => {
  it("returns ok:false when api-auth returns ok:false and no x-auth-user header", async () => {
    mockRequireAuth.mockResolvedValue({ ok: false });
    const result = await requireAuth(makeRequest());
    expect(result.ok).toBe(false);
  });

  it("creates synthetic user from x-auth-user header when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({ ok: false });
    const req = makeRequest({ "x-auth-user": "testuser", "x-auth-role": "admin" });
    const result = await requireAuth(req);
    expect(result.ok).toBe(true);
    expect(result.user?.sub).toBe("testuser");
  });
});

describe("requireAdmin", () => {
  it("returns ok:false when api-auth returns ok:false and no headers", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false });
    const result = await requireAdmin(makeRequest());
    expect(result.ok).toBe(false);
  });
});

describe("isAdmin", () => {
  it("delegates to api-auth isAdmin", async () => {
    mockIsAdmin.mockResolvedValue(false);
    const result = await isAdmin(undefined);
    expect(result).toBe(false);
  });
});

describe("getTokenFromHeader", () => {
  it("delegates to api-auth getTokenFromHeader", async () => {
    mockGetToken.mockResolvedValue(null);
    const result = await getTokenFromHeader(makeRequest());
    expect(result).toBeNull();
  });
});
