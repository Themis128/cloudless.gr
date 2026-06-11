/**
 * Regression test for the chunked-session-cookie bug in src/proxy.ts.
 *
 * The next-auth session JWT stores the IdP access/id/refresh tokens, so
 * it exceeds the 4096-byte cookie limit and next-auth splits it into chunked
 * cookies: `<name>.0`, `<name>.1`, … — the unchunked `<name>` cookie then does
 * not exist. readAuthToken's precheck used to look only for the base cookie
 * name, so it early-returned valid:false for logged-in users with a chunked
 * cookie and bounced admins to /auth/login instead of /admin.
 *
 * These tests drive the real proxy() with a mocked getToken (decode) and assert
 * the post-login resolver routes correctly based ONLY on the precheck seeing
 * the chunked cookie. With the old precheck, the chunked-cookie case redirects
 * to /auth/login and getToken is never called — so this test guards the fix.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getTokenMock = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => getTokenMock(...args) }));

function postLogin(cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest("https://cloudless.gr/en/auth/post-login", { headers });
}

describe("proxy.ts post-login resolver — chunked session cookie", () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    // Simulate a successfully decoded admin session JWT.
    getTokenMock.mockResolvedValue({ groups: ["admin"], roles: [] });
  });

  it("routes an admin with a CHUNKED cookie (.0) to /admin", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(postLogin("authjs.session-token.0=chunk0-value"));

    // The precheck must have passed and called getToken to decode the session.
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/admin");
  });

  it("still routes an admin with an UNCHUNKED cookie to /admin", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(postLogin("authjs.session-token=whole-value"));

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/admin");
  });

  it("routes a non-admin (chunked cookie, no admin group) to /dashboard", async () => {
    getTokenMock.mockResolvedValue({ groups: [], roles: [] });
    const { proxy } = await import("@/proxy");
    const res = await proxy(postLogin("authjs.session-token.0=chunk0-value"));

    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/dashboard");
  });

  it("redirects to /auth/login when no session cookie is present", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(postLogin());

    // No cookie at all → precheck short-circuits, getToken never called.
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/auth/login");
  });
});
