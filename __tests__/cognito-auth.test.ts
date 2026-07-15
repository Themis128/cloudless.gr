/**
 * cognito-auth.ts — direct tests against the real implementation.
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

process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "https://cloudless.auth.us-east-1.amazoncognito.com";
process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "cloudless-test";
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_TESTPOOL";

beforeEach(() => {
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

describe("cognito-auth.ts — real module", () => {
  it("signIn delegates to next-auth signIn with provider=cognito", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const result = await cognitoAuthModule.signIn({ username: "u", password: "p" });
    expect(mockNextAuthSignIn).toHaveBeenCalledWith("cognito", { redirect: true });
    expect(result).toEqual({ isSignedIn: true });
  });

  it("signOut delegates to next-auth signOut with callbackUrl=/", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await cognitoAuthModule.signOut();
    expect(mockNextAuthSignOut).toHaveBeenCalledWith({ callbackUrl: "/", redirect: true });
  });

  it("signUp redirects to the Cognito Hosted UI signup URL with email hint", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await cognitoAuthModule.signUp({
      username: "alice",
      password: "secret",
      options: { userAttributes: { email: "alice@example.com" } },
    });
    expect(window.location.href).toContain("/signup");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain("scope=openid+profile+email");
    expect(window.location.href).toContain("login_hint=alice%40example.com");
  });

  it("signUp without email omits the login_hint parameter", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await cognitoAuthModule.signUp({ username: "bob", password: "x" });
    expect(window.location.href).toContain("/signup");
    expect(window.location.href).not.toContain("login_hint=");
  });

  it("confirmSignUp is a no-op (Cognito Hosted UI handles verification)", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await expect(
      cognitoAuthModule.confirmSignUp({ username: "u", confirmationCode: "123" }),
    ).resolves.toBeUndefined();
  });

  it("resetPassword redirects to the Cognito Hosted UI forgot-password URL", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await cognitoAuthModule.resetPassword({ username: "alice@example.com" });
    expect(window.location.href).toContain("/forgotPassword");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain("login_hint=alice%40example.com");
  });

  it("confirmResetPassword is a no-op (handled by Cognito Hosted UI)", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await expect(
      cognitoAuthModule.confirmResetPassword({
        username: "u",
        confirmationCode: "1",
        newPassword: "new",
      }),
    ).resolves.toBeUndefined();
  });

  it("confirmSignIn returns isSignedIn:true", async () => {
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const result = await cognitoAuthModule.confirmSignIn({ challengeResponse: "x" });
    expect(result).toEqual({ isSignedIn: true });
  });

  it("getCurrentUser throws UserNotFoundException when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await expect(cognitoAuthModule.getCurrentUser()).rejects.toThrow("UserNotFoundException");
  });

  it("getCurrentUser returns the username from session.user.id", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "u@e.com", name: "U" } });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const u = await cognitoAuthModule.getCurrentUser();
    expect(u.username).toBe("user-1");
    expect(u.signInDetails?.loginId).toBe("u@e.com");
  });

  it("getCurrentUser falls back to email when id is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "fallback@e.com" } });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const u = await cognitoAuthModule.getCurrentUser();
    expect(u.username).toBe("fallback@e.com");
  });

  it("fetchAuthSession returns empty tokens when no idToken", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u" } });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const s = await cognitoAuthModule.fetchAuthSession();
    expect(s.tokens).toEqual({});
  });

  it("fetchAuthSession returns wrapped idToken with toString()", async () => {
    mockGetSession.mockResolvedValue({ idToken: "eyJ.fake.jwt" });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const s = await cognitoAuthModule.fetchAuthSession();
    expect(s.tokens?.idToken?.toString()).toBe("eyJ.fake.jwt");
  });

  it("fetchUserAttributes returns {} when there is no session.user", async () => {
    mockGetSession.mockResolvedValue(null);
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const a = await cognitoAuthModule.fetchUserAttributes();
    expect(a).toEqual({});
  });

  it("fetchUserAttributes maps email/name/sub from session.user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-42", email: "user@cloudless.gr", name: "Themis" },
    });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const a = await cognitoAuthModule.fetchUserAttributes();
    expect(a).toEqual({ email: "user@cloudless.gr", name: "Themis", sub: "user-42" });
  });

  it("fetchUserAttributes uses empty strings when fields are missing", async () => {
    mockGetSession.mockResolvedValue({ user: {} });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    const a = await cognitoAuthModule.fetchUserAttributes();
    expect(a).toEqual({ email: "", name: "", sub: "" });
  });

  it("updateUserAttributes is not supported via the client shim", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u" }, accessToken: "bearer-1" });
    const { cognitoAuthModule } = await import("@/lib/cognito-auth");
    await expect(
      cognitoAuthModule.updateUserAttributes({ userAttributes: { name: "X" } }),
    ).rejects.toThrow("not supported");
  });
});
