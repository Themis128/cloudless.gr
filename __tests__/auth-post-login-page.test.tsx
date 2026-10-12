/**
 * auth/post-login — server component resolver.
 * redirect() is mocked to throw (matching real Next.js semantics where
 * redirect never returns), so each test asserts the thrown destination.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);
const cookieGet = vi.hoisted(() => vi.fn());
const getAuthDbFromEnv = vi.hoisted(() => vi.fn());
const getUserBySession = vi.hoisted(() => vi.fn());
const d1IsAdmin = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: (u: string) => redirectMock(u) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv, getUserBySession, isAdmin: d1IsAdmin }));

import PostLoginPage from "@/app/[locale]/auth/post-login/page";

const params = (locale: string) => Promise.resolve({ locale });

describe("auth/post-login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: "sess-1" });
    getAuthDbFromEnv.mockReturnValue({ db: true });
    getUserBySession.mockResolvedValue({ id: "u1" });
    d1IsAdmin.mockResolvedValue(false);
  });
  afterEach(() => vi.restoreAllMocks());

  it("redirects admins to /admin", async () => {
    d1IsAdmin.mockResolvedValue(true);
    await expect(PostLoginPage({ params: params("en") })).rejects.toThrow("REDIRECT:/en/admin");
  });

  it("redirects regular users to /dashboard", async () => {
    await expect(PostLoginPage({ params: params("en") })).rejects.toThrow(
      "REDIRECT:/en/dashboard"
    );
  });

  it("redirects to login without a session cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(PostLoginPage({ params: params("en") })).rejects.toThrow(
      "REDIRECT:/en/auth/login"
    );
  });

  it("redirects to login without an auth DB", async () => {
    getAuthDbFromEnv.mockReturnValue(null);
    await expect(PostLoginPage({ params: params("en") })).rejects.toThrow(
      "REDIRECT:/en/auth/login"
    );
  });

  it("redirects to login for an unknown session", async () => {
    getUserBySession.mockResolvedValue(null);
    await expect(PostLoginPage({ params: params("en") })).rejects.toThrow(
      "REDIRECT:/en/auth/login"
    );
  });

  it("falls back to /en for unsupported locales", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(PostLoginPage({ params: params("x%2F..%2Fetc") })).rejects.toThrow(
      "REDIRECT:/en/auth/login"
    );
  });
});
