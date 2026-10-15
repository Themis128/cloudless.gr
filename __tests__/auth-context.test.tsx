/**
 * AuthContext provider tests — session check paths, e2e bypass, sign in/out,
 * forgot-password, profile update retry, preferences merge.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { AuthProvider, useAuth } from "@/context/AuthContext";

const pending: { p?: Promise<unknown> } = {};

function Probe() {
  const auth = useAuth();
  const track = (p: Promise<unknown>) => {
    pending.p = p;
    p.catch(() => {});
  };
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email ?? auth.user.username : "anon"}</span>
      <span data-testid="admin">{String(auth.isAdmin)}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="name">{auth.user?.name ?? "-"}</span>
      <span data-testid="theme">{auth.user?.preferences.theme ?? "-"}</span>
      <button data-testid="in" onClick={() => track(auth.signIn("a@b.com", "pw"))}>in</button>
      <button data-testid="out" onClick={() => track(auth.signOut())}>out</button>
      <button data-testid="forgot" onClick={() => track(auth.forgotPassword("a@b.com"))}>forgot</button>
      <button data-testid="prof" onClick={() => track(auth.updateProfile({ name: "New" }))}>prof</button>
      <button data-testid="prefs" onClick={() => track(auth.updatePreferences({ theme: "light" }))}>prefs</button>
      <button data-testid="refresh" onClick={() => track(auth.refreshProfile())}>refresh</button>
    </div>
  );
}

const flush = () => act(async () => { await Promise.resolve(); });
const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

const okSession = (user: unknown, isAdmin = false) =>
  jsonRes({ user: user ?? undefined, isAdmin });

describe("AuthContext", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    document.cookie = "e2e_admin=; max-age=0";
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  it("e2e_admin cookie bypass sets admin user without fetching", async () => {
    document.cookie = "e2e_admin=1";
    renderAuth();
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("e2e-admin@cloudless.test");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("populates user from session and enriches profile in background", async () => {
    fetchMock
      .mockResolvedValueOnce(okSession({ id: "u1", email: "a@b.com", groups: ["admin"] }))
      .mockResolvedValueOnce(jsonRes({ name: "Pat", company: "Acme" }));
    renderAuth();
    await flush();
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("a@b.com");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("name").textContent).toBe("Pat");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("keeps the base user when profile enrichment fetch rejects", async () => {
    fetchMock
      .mockResolvedValueOnce(okSession({ id: "u8", email: "a@b.com" }))
      .mockRejectedValueOnce(new Error("profile api down")); // /api/user/profile
    renderAuth();
    await flush();
    // enrichment failed → base session user retained, no crash
    expect(screen.getByTestId("user").textContent).toBe("a@b.com");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("treats non-ok session and non-JSON bodies as logged out", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({}, 401));
    const { unmount } = renderAuth();
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("anon");
    unmount();
    fetchMock.mockResolvedValueOnce(new Response("<html>challenge</html>", { status: 200 }));
    renderAuth();
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("anon");
  });

  it("clears the session on RefreshTokenError", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ error: "RefreshTokenError" }))
      .mockResolvedValueOnce(jsonRes({}));
    renderAuth();
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("anon");
    const del = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === "DELETE");
    expect(del?.[0]).toBe("/api/auth/session");
  });

  it("signIn sets user + admin, throws on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({})); // checkAuth: no user
    renderAuth();
    await flush();
    fetchMock
      .mockResolvedValueOnce(jsonRes({ ok: true, isAdmin: true, user: { id: "u9", email: "a@b.com" } }))
      .mockResolvedValueOnce(jsonRes({ name: "P" }));
    await act(async () => { screen.getByTestId("in").click(); });
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("a@b.com");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    fetchMock.mockResolvedValueOnce(jsonRes({ error: "bad creds" }, 401));
    await act(async () => { screen.getByTestId("in").click(); });
    await expect(pending.p).rejects.toThrow("bad creds");
  });

  it("signOut clears state and DELETEs the session", async () => {
    document.cookie = "e2e_admin=1";
    renderAuth();
    await flush();
    fetchMock.mockResolvedValueOnce(jsonRes({}));
    await act(async () => { screen.getByTestId("out").click(); });
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("anon");
  });

  it("forgotPassword throws the API error on non-ok", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({}));
    renderAuth();
    await flush();
    fetchMock.mockResolvedValueOnce(jsonRes({ error: "rate limited" }, 429));
    await act(async () => { screen.getByTestId("forgot").click(); });
    await expect(pending.p).rejects.toThrow("rate limited");
    fetchMock.mockResolvedValueOnce(jsonRes({}));
    await act(async () => { screen.getByTestId("forgot").click(); }); // resolves silently
  });

  it("updateProfile retries once on 502 without x-served-by, then throws", async () => {
    document.cookie = "e2e_admin=1";
    renderAuth();
    await flush();
    // first 502 → retried → success
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(jsonRes({}));
    await act(async () => { screen.getByTestId("prof").click(); });
    await flush();
    expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/user/profile")).toHaveLength(2);
    expect(screen.getByTestId("name").textContent).toBe("New");
    // aws-fallback header → no retry → throws
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad" }), {
        status: 502,
        headers: { "x-served-by": "aws-fallback" },
      })
    );
    await act(async () => { screen.getByTestId("prof").click(); });
    await expect(pending.p).rejects.toThrow("bad");
  });

  it("updatePreferences merges into user state and tolerates fetch failure", async () => {
    document.cookie = "e2e_admin=1";
    renderAuth();
    await flush();
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await act(async () => { screen.getByTestId("prefs").click(); });
    await flush();
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("refreshProfile re-runs checkAuth", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({}));
    renderAuth();
    await flush();
    fetchMock.mockResolvedValueOnce(okSession({ id: "u2", email: "b@c.com" }));
    fetchMock.mockResolvedValueOnce(jsonRes({}));
    await act(async () => { screen.getByTestId("refresh").click(); });
    await flush();
    expect(screen.getByTestId("user").textContent).toBe("b@c.com");
  });
});
