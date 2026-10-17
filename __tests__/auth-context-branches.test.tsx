/**
 * AuthContext branch tails, on a production hostname so the e2e cookie bypass
 * must stay inert: default (provider-less) context, empty/partial session
 * payloads, failed profile enrichment, unreadable error bodies, rejected
 * DELETEs, and profile/preference updates without a signed-in user.
 *
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://cloudless.gr/en/dashboard"}
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const clearSessionCache = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({ clearSessionCache: () => clearSessionCache() }));

import { AuthProvider, useAuth } from "@/context/AuthContext";

type Auth = ReturnType<typeof useAuth>;

const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

let routes: Record<string, (init?: RequestInit) => Promise<Response> | Response>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const key = `${init?.method ?? "GET"} ${url}`;
  const handler = routes[key];
  if (!handler) throw new Error(`unexpected fetch ${key}`);
  return handler(init);
});

async function mount(): Promise<() => Auth> {
  let auth!: Auth;
  function Grab() {
    auth = useAuth();
    return null;
  }
  await act(async () => {
    render(
      <AuthProvider>
        <Grab />
      </AuthProvider>
    );
  });
  // Let background profile enrichment settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return () => auth;
}

beforeEach(() => {
  routes = {
    "GET /api/auth/session": () => jsonRes({}, 401),
    "GET /api/user/profile": () => jsonRes({}, 404),
  };
  fetchMock.mockClear();
  clearSessionCache.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "e2e_admin=; max-age=0";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.cookie = "e2e_admin=; max-age=0";
});

describe("AuthContext defaults outside a provider", () => {
  it("exposes a loading, signed-out context whose actions are no-ops", async () => {
    let auth!: Auth;
    function Grab() {
      auth = useAuth();
      return null;
    }
    render(<Grab />);
    expect(auth.user).toBeNull();
    expect(auth.isAdmin).toBe(false);
    expect(auth.isLoading).toBe(true);
    expect(auth.configError).toBeNull();
    await expect(auth.signIn("a@b.c", "pw")).resolves.toBeUndefined();
    await expect(auth.signOut()).resolves.toBeUndefined();
    await expect(auth.forgotPassword("a@b.c")).resolves.toBeUndefined();
    await expect(auth.updateProfile({ name: "x" })).resolves.toBeUndefined();
    await expect(auth.updatePreferences({ theme: "light" })).resolves.toBeUndefined();
    await expect(auth.refreshProfile()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AuthContext session check", () => {
  it("ignores the e2e_admin cookie on a production hostname", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E", "");
    document.cookie = "e2e_admin=1";
    const get = await mount();
    expect(window.location.hostname).toBe("cloudless.gr");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", expect.anything());
    expect(get().user).toBeNull();
    expect(get().isAdmin).toBe(false);
    expect(get().isLoading).toBe(false);
  });

  it("treats an empty session body as signed out", async () => {
    routes["GET /api/auth/session"] = () => new Response("", { status: 200 });
    const get = await mount();
    expect(get().user).toBeNull();
    expect(get().isLoading).toBe(false);
  });

  it("falls back to the email as username and keeps the base user when the profile 404s", async () => {
    routes["GET /api/auth/session"] = () =>
      jsonRes({ user: { email: "pat@cloudless.gr", roles: ["user"] } });
    const get = await mount();
    expect(get().user).toEqual({
      username: "pat@cloudless.gr",
      email: "pat@cloudless.gr",
      name: undefined,
      preferences: {
        theme: "dark",
        language: "en",
        emailOrders: true,
        emailNewsletter: false,
        emailMarketing: false,
      },
    });
    expect(get().isAdmin).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/user/profile");
  });

  it("uses an empty username when the session user has neither id nor email", async () => {
    routes["GET /api/auth/session"] = () => jsonRes({ user: { name: "Anon" }, isAdmin: true });
    const get = await mount();
    expect(get().user?.username).toBe("");
    expect(get().user?.email).toBeUndefined();
    expect(get().user?.name).toBe("Anon");
    expect(get().isAdmin).toBe(true);
  });

  it("still signs out on RefreshTokenError when the DELETE rejects", async () => {
    routes["GET /api/auth/session"] = () => jsonRes({ error: "RefreshTokenError" });
    routes["DELETE /api/auth/session"] = () => Promise.reject(new Error("network"));
    const get = await mount();
    expect(get().user).toBeNull();
    expect(get().isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", { method: "DELETE" });
  });
});

describe("AuthContext actions", () => {
  it("signIn reports a generic failure when the error body is unreadable", async () => {
    routes["POST /api/auth/login"] = () => new Response("<html>502</html>", { status: 502 });
    const get = await mount();
    await expect(get().signIn("a@b.c", "pw")).rejects.toThrow("Sign in failed");
    expect(get().user).toBeNull();
  });

  it("signIn falls back to the typed email and keeps company/phone when the profile 404s", async () => {
    routes["POST /api/auth/login"] = () =>
      jsonRes({ ok: true, user: { company: "Acme", phone: "+30 210" } });
    const get = await mount();
    await act(async () => {
      await get().signIn("typed@cloudless.gr", "pw");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(get().user).toMatchObject({
      username: "typed@cloudless.gr",
      email: "typed@cloudless.gr",
      name: undefined,
      company: "Acme",
      phone: "+30 210",
    });
    expect(get().isAdmin).toBe(false);
  });

  it("signOut resolves even when the session DELETE rejects", async () => {
    routes["DELETE /api/auth/session"] = () => Promise.reject(new Error("offline"));
    const get = await mount();
    await act(async () => {
      await expect(get().signOut()).resolves.toBeUndefined();
    });
    expect(clearSessionCache).toHaveBeenCalledTimes(1);
    expect(get().user).toBeNull();
  });

  it("forgotPassword reports a generic failure when the error body is unreadable", async () => {
    routes["POST /api/auth/reset-password"] = () => new Response("oops", { status: 500 });
    const get = await mount();
    await expect(get().forgotPassword("a@b.c")).rejects.toThrow("Password reset failed");
  });

  it("updateProfile does not retry an AWS-fallback 503 and reports the status", async () => {
    routes["POST /api/user/profile"] = () =>
      new Response("down", { status: 503, headers: { "x-served-by": "aws-fallback" } });
    const get = await mount();
    await expect(get().updateProfile({ name: "N" })).rejects.toThrow(
      "Failed to update profile: 503"
    );
    expect(fetchMock.mock.calls.filter(([u, i]) => u === "/api/user/profile" && i)).toHaveLength(1);
  });

  it("updateProfile without a signed-in user saves but leaves the user empty", async () => {
    routes["POST /api/user/profile"] = () => jsonRes({ ok: true });
    const get = await mount();
    await act(async () => {
      await get().updateProfile({ company: "Acme" });
    });
    expect(get().user).toBeNull();
    const post = fetchMock.mock.calls.find(([u, i]) => u === "/api/user/profile" && i);
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ company: "Acme" });
  });

  it("updateProfile keeps fields that were not provided", async () => {
    routes["GET /api/auth/session"] = () =>
      jsonRes({ user: { id: "u1", email: "u1@cloudless.gr", name: "Pat" } });
    routes["GET /api/user/profile"] = () => jsonRes({ company: "Old", phone: "1" });
    routes["POST /api/user/profile"] = () => jsonRes({ ok: true });
    const get = await mount();
    expect(get().user?.company).toBe("Old");
    await act(async () => {
      await get().updateProfile({ company: "New" });
    });
    expect(get().user).toMatchObject({ name: "Pat", company: "New", phone: "1" });
  });

  it("updatePreferences without a user merges onto the defaults", async () => {
    routes["POST /api/user/profile"] = () => jsonRes({ ok: true });
    const get = await mount();
    await act(async () => {
      await get().updatePreferences({ theme: "light" });
    });
    expect(get().user).toBeNull();
    const post = fetchMock.mock.calls.find(([u, i]) => u === "/api/user/profile" && i);
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      preferences: {
        theme: "light",
        language: "en",
        emailOrders: true,
        emailNewsletter: false,
        emailMarketing: false,
      },
    });
  });
});
