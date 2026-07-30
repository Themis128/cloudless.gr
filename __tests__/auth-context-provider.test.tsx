/**
 * AuthContext D1 sign-in / forgot-password handoff tests.
 */

import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

type AuthApi = {
  signIn: (e: string, p: string) => Promise<void>;
  forgotPassword: (e: string) => Promise<void>;
};

async function mountAuth(): Promise<() => AuthApi> {
  vi.resetModules();
  const mod = await import("@/context/AuthContext");
  let api: AuthApi;
  function Grab() {
    api = mod.useAuth() as unknown as AuthApi;
    return null;
  }
  await act(async () => {
    render(
      <mod.AuthProvider>
        <Grab />
      </mod.AuthProvider>
    );
  });
  return () => api;
}

describe("AuthContext D1 handoff", () => {
  it("signIn posts to D1 /api/auth/login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        user: { id: "u1", email: "e@x.com" },
        isAdmin: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const get = await mountAuth();
    await act(async () => {
      await get().signIn("e@x.com", "pw");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("forgotPassword posts to /api/auth/reset-password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const get = await mountAuth();
    await act(async () => {
      await get().forgotPassword("e@x.com");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({ method: "POST" })
    );
  });
});
