/**
 * keycloak-auth.ts — direct tests against the real implementation.
 *
 * Existing tests (auth-context.test.tsx, amplify-config.test.ts) replace
 * the entire module with vi.mock(), so the source code is never executed.
 *
 * Here we load the real module and only mock its dependencies (next-auth/react),
 * giving the file genuine line/branch coverage.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockNextAuthSignIn = vi.fn().mockResolvedValue({ ok: true });
const mockNextAuthSignOut = vi.fn().mockResolvedValue(undefined);
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: mockNextAuthSignIn,
  signOut: mockNextAuthSignOut,
  getSession: mockGetSession,
}));

process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.test/realms/main";
process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = "cloudless-test";

beforeEach(() => {
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.test/realms/main";
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = "cloudless-test";
  mockNextAuthSignIn.mockClear();
  mockNextAuthSignOut.mockClear();
  mockGetSession.mockReset();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "", origin: "http://localhost:3000" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("keycloak-auth.ts — real module", () => {
  it("signIn delegates to next-auth signIn with provider=keycloak", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const result = await keycloakAuthModule.signIn({ username: "u", password: "p" });
    expect(mockNextAuthSignIn).toHaveBeenCalledWith("keycloak", { redirect: true });
    expect(result).toEqual({ isSignedIn: true });
  });

  it("signOut delegates to next-auth signOut with callbackUrl=/", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.signOut();
    // redirect:false is intentional — signOut performs RP-Initiated Logout by
    // redirecting to Keycloak's end_session_endpoint itself, so next-auth must
    // not redirect first (that would skip the SSO-cookie invalidation).
    expect(mockNextAuthSignOut).toHaveBeenCalledWith({ callbackUrl: "/", redirect: false });
  });

  it("signUp redirects to Keycloak registrations URL with email pre-filled", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.signUp({
      username: "alice",
      password: "secret",
      options: { userAttributes: { email: "alice@example.com" } },
    });
    expect(window.location.href).toContain("/protocol/openid-connect/registrations");
    expect(window.location.href).toContain("client_id=cloudless-test");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain("scope=openid+profile+email");
    expect(window.location.href).toContain("email=alice%40example.com");
  });

  it("signUp without email omits the email parameter", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.signUp({ username: "bob", password: "x" });
    expect(window.location.href).not.toContain("email=");
  });

  it("confirmSignUp is a no-op (Keycloak sends verification mail)", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await expect(
      keycloakAuthModule.confirmSignUp({ username: "u", confirmationCode: "123" }),
    ).resolves.toBeUndefined();
  });

  it("resetPassword redirects to Keycloak's reset-credentials URL", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.resetPassword({ username: "alice@example.com" });
    expect(window.location.href).toContain("/login-actions/reset-credentials");
    expect(window.location.href).toContain("client_id=cloudless-test");
    expect(window.location.href).toContain("username=alice%40example.com");
  });

  it("confirmResetPassword is a no-op (handled by Keycloak)", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await expect(
      keycloakAuthModule.confirmResetPassword({
        username: "u",
        confirmationCode: "1",
        newPassword: "new",
      }),
    ).resolves.toBeUndefined();
  });

  it("confirmSignIn returns isSignedIn:true", async () => {
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const result = await keycloakAuthModule.confirmSignIn({ challengeResponse: "x" });
    expect(result).toEqual({ isSignedIn: true });
  });

  it("getCurrentUser throws UserNotFoundException when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await expect(keycloakAuthModule.getCurrentUser()).rejects.toThrow("UserNotFoundException");
  });

  it("getCurrentUser returns the username from session.user.id", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@e.com", name: "U" } });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const u = await keycloakAuthModule.getCurrentUser();
    expect(u.username).toBe("user-1");
    expect(u.signInDetails?.loginId).toBe("u@e.com");
  });

  it("getCurrentUser falls back to email when id is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "fallback@e.com" } });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const u = await keycloakAuthModule.getCurrentUser();
    expect(u.username).toBe("fallback@e.com");
  });

  it("fetchAuthSession returns empty tokens when no idToken", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u" } });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const s = await keycloakAuthModule.fetchAuthSession();
    expect(s.tokens).toEqual({});
  });

  it("fetchAuthSession returns wrapped idToken with toString()", async () => {
    mockGetSession.mockResolvedValue({ idToken: "eyJ.fake.jwt" });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const s = await keycloakAuthModule.fetchAuthSession();
    expect(s.tokens?.idToken?.toString()).toBe("eyJ.fake.jwt");
  });

  it("fetchUserAttributes returns {} when there is no session.user", async () => {
    mockGetSession.mockResolvedValue(null);
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const a = await keycloakAuthModule.fetchUserAttributes();
    expect(a).toEqual({});
  });

  it("fetchUserAttributes maps email/name/sub from session.user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-42", email: "user@cloudless.gr", name: "Themis" },
    });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const a = await keycloakAuthModule.fetchUserAttributes();
    expect(a).toEqual({ email: "user@cloudless.gr", name: "Themis", sub: "user-42" });
  });

  it("fetchUserAttributes uses empty strings when fields are missing", async () => {
    mockGetSession.mockResolvedValue({ user: {} });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    const a = await keycloakAuthModule.fetchUserAttributes();
    expect(a).toEqual({ email: "", name: "", sub: "" });
  });

  it("updateUserAttributes throws when no accessToken is available", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u" } });
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await expect(
      keycloakAuthModule.updateUserAttributes({ userAttributes: { name: "X" } }),
    ).rejects.toThrow("Not authenticated");
  });

  it("updateUserAttributes calls Keycloak /account with name -> firstName", async () => {
    mockGetSession.mockResolvedValue({ accessToken: "bearer-1" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.updateUserAttributes({ userAttributes: { name: "Alice" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.test/realms/main/account",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer bearer-1",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.firstName).toBe("Alice");
  });

  it("updateUserAttributes maps given_name -> firstName and phone_number -> attributes.phone", async () => {
    mockGetSession.mockResolvedValue({ accessToken: "bearer-2" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.updateUserAttributes({
      userAttributes: { given_name: "Bob", phone_number: "+30 210 123" },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.firstName).toBe("Bob");
    expect(body.attributes.phone).toEqual(["+30 210 123"]);
  });

  it("updateUserAttributes maps custom:* attributes to Keycloak attributes object", async () => {
    mockGetSession.mockResolvedValue({ accessToken: "bearer-3" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await keycloakAuthModule.updateUserAttributes({
      userAttributes: { "custom:tier": "premium", "custom:org": "cloudless" },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.attributes.tier).toEqual(["premium"]);
    expect(body.attributes.org).toEqual(["cloudless"]);
  });

  it("updateUserAttributes throws on non-OK response", async () => {
    mockGetSession.mockResolvedValue({ accessToken: "bearer-4" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    const { keycloakAuthModule } = await import("@/lib/keycloak-auth");
    await expect(
      keycloakAuthModule.updateUserAttributes({ userAttributes: { name: "X" } }),
    ).rejects.toThrow("Failed to update profile: 403");
  });
});
