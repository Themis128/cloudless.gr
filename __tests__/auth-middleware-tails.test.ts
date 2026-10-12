import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tail coverage for src/lib/auth-middleware.ts — the optionalAuth
 * requireAuth fallback, isAuthenticated, requireVerifiedAuth, and
 * getTokenFromHeader passthroughs. `@/lib/api-auth` is the boundary mock.
 */

const { mockRequireAuth, mockRequireVerifiedAuth, mockGetToken } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireVerifiedAuth: vi.fn(),
  mockGetToken: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireVerifiedAuth: (...a: unknown[]) => mockRequireVerifiedAuth(...a),
  getTokenFromHeader: (...a: unknown[]) => mockGetToken(...a),
}));

import {
  optionalAuth,
  isAuthenticated,
  requireVerifiedAuth,
  getTokenFromHeader,
  cleanupSessions,
} from "@/lib/auth-middleware";

const req = () => new NextRequest("http://localhost/api/x");

describe("auth-middleware tails", () => {
  it("optionalAuth returns the user JSON when requireAuth succeeds", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: "u1", email: "a@b.gr" } });
    const res = await optionalAuth(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { sub: "u1", email: "a@b.gr" } });
  });

  it("optionalAuth returns a null user when requireAuth fails", async () => {
    mockRequireAuth.mockResolvedValue({ ok: false });
    const res = await optionalAuth(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("isAuthenticated maps the requireAuth result to a boolean", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: { sub: "u1" } });
    expect(await isAuthenticated(req())).toBe(true);
    mockRequireAuth.mockResolvedValueOnce({ ok: false });
    expect(await isAuthenticated(req())).toBe(false);
  });

  it("requireVerifiedAuth and getTokenFromHeader pass through to api-auth", async () => {
    mockRequireVerifiedAuth.mockResolvedValue({ ok: true, user: { sub: "v1" } });
    const r = req();
    const out = await requireVerifiedAuth(r);
    expect(out).toEqual({ ok: true, user: { sub: "v1" } });
    expect(mockRequireVerifiedAuth).toHaveBeenCalledWith(r);

    mockGetToken.mockResolvedValue("tok_1");
    expect(await getTokenFromHeader(r)).toBe("tok_1");
  });

  it("cleanupSessions is a no-op kept for API compatibility", async () => {
    await expect(cleanupSessions()).resolves.toBeUndefined();
  });
});
