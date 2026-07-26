/**
 * AuthContext provider-handoff tests.
 *
 * AuthContext picks the next-auth provider at build time from
 * NEXT_PUBLIC_AUTH_PROVIDER. These tests verify the sign-in / sign-up /
 * forgot-password handlers hand off to the right provider:
 *   - Cognito → nextAuthSignIn("cognito", ...) for all three flows
 *
 * (Hosted-UI sign-up / reset paths navigate via window.location; jsdom can't
 * follow navigation, so only the provider hand-off is asserted here.)
 */

import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  getSession: vi.fn().mockResolvedValue(null),
  signIn: signInMock,
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

beforeEach(() => {
  signInMock.mockReset();
  // Session check on mount → no user.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
  vi.resetModules();
});

type AuthApi = {
  signIn: (e: string, p: string) => Promise<unknown>;
  signUp: (e: string, p: string, n?: string) => Promise<void>;
  forgotPassword: (e: string) => Promise<void>;
};

async function mountWith(provider?: string): Promise<() => AuthApi> {
  if (provider) process.env.NEXT_PUBLIC_AUTH_PROVIDER = provider;
  else delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
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

describe("AuthContext provider handoff", () => {
  it("cognito: signIn hands off to the cognito provider", async () => {
    const get = await mountWith("cognito");
    await act(async () => {
      await get().signIn("e@x.com", "pw");
    });
    expect(signInMock).toHaveBeenCalledWith("cognito", expect.objectContaining({ redirect: true }));
  });

  it("cognito: forgotPassword routes through the cognito hosted UI", async () => {
    const get = await mountWith("cognito");
    await act(async () => {
      await get().forgotPassword("e@x.com");
    });
    expect(signInMock).toHaveBeenCalledWith(
      "cognito",
      expect.objectContaining({ callbackUrl: "/auth/post-login" })
    );
  });

  it("cognito: signUp routes through the cognito hosted UI", async () => {
    const get = await mountWith("cognito");
    await act(async () => {
      await get().signUp("e@x.com", "pw", "Name");
    });
    expect(signInMock).toHaveBeenCalledWith(
      "cognito",
      expect.objectContaining({ callbackUrl: "/auth/post-login" })
    );
  });

  it("default (no provider set): signIn hands off to the cognito provider", async () => {
    const get = await mountWith(undefined);
    await act(async () => {
      await get().signIn("e@x.com", "pw");
    });
    expect(signInMock).toHaveBeenCalledWith("cognito", expect.objectContaining({ redirect: true }));
  });
});
