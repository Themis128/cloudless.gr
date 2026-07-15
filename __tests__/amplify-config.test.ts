/**
 * amplify-config shim tests — Keycloak era.
 *
 * The shim no longer calls Amplify.configure() — it checks NEXT_PUBLIC_KEYCLOAK_ISSUER
 * and routes getAuthModule() to keycloak-auth.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("amplify-config.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  });

  afterEach(() => vi.restoreAllMocks());

  it("configureAmplifyWith returns false when NEXT_PUBLIC_KEYCLOAK_ISSUER is absent", async () => {
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(false);
    expect(isAmplifyConfigured()).toBe(false);
  });

  it("configureAmplifyWith returns true when NEXT_PUBLIC_KEYCLOAK_ISSUER is set", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(true);
    expect(isAmplifyConfigured()).toBe(true);
  });

  it("configureAmplifyWith is idempotent", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(true);
    expect(configureAmplifyWith({ userPoolId: "x", userPoolClientId: "y" })).toBe(true);
  });

  it("getAuthModule returns keycloakAuthModule shape", async () => {
    vi.mock("@/lib/keycloak-auth", () => ({
      keycloakAuthModule: {
        signIn: vi.fn(), signOut: vi.fn(), getCurrentUser: vi.fn(),
        fetchAuthSession: vi.fn(), fetchUserAttributes: vi.fn(),
        updateUserAttributes: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn(),
        resetPassword: vi.fn(), confirmResetPassword: vi.fn(), confirmSignIn: vi.fn(),
      },
    }));
    const { getAuthModule } = await import("@/lib/amplify-config");
    const auth = await getAuthModule();
    expect(typeof auth.signIn).toBe("function");
    expect(typeof auth.getCurrentUser).toBe("function");
    expect(typeof auth.fetchAuthSession).toBe("function");
  });
});
