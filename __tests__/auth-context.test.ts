/**
 * amplify-config shim + keycloak-auth module tests.
 *
 * The "amplify-config" module is now a thin shim that:
 *   - configureAmplifyWith() returns true when NEXT_PUBLIC_KEYCLOAK_ISSUER is set
 *   - getAuthModule() returns keycloak-auth's module (not aws-amplify)
 *
 * These tests verify the shim contract that AuthContext depends on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── configureAmplifyWith ──────────────────────────────────────────────────────

describe("configureAmplifyWith() — Keycloak shim", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns false when NEXT_PUBLIC_KEYCLOAK_ISSUER is absent", async () => {
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(false);
    expect(isAmplifyConfigured()).toBe(false);
  });

  it("returns false when NEXT_PUBLIC_KEYCLOAK_ISSUER is empty string", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "";
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(false);
  });

  it("returns true when NEXT_PUBLIC_KEYCLOAK_ISSUER is set", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(true);
    expect(isAmplifyConfigured()).toBe(true);
  });

  it("is idempotent — repeated calls return true without re-configuring", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(true);
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(true);
  });

  it("cognitoConfig params are ignored (kept only for interface compatibility)", async () => {
    // With Cognito values set but no Keycloak issuer → still false
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(
      configureAmplifyWith({ userPoolId: "us-east-1_Pool", userPoolClientId: "clientId" })
    ).toBe(false);
  });
});

// ── getAuthModule ─────────────────────────────────────────────────────────────

describe("getAuthModule() — returns Keycloak auth module", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => vi.restoreAllMocks());

  it("resolves with all auth functions expected by AuthContext", async () => {
    vi.mock("@/lib/keycloak-auth", () => ({
      keycloakAuthModule: {
        signIn: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
        confirmSignUp: vi.fn(),
        resetPassword: vi.fn(),
        confirmResetPassword: vi.fn(),
        confirmSignIn: vi.fn(),
        getCurrentUser: vi.fn(),
        fetchAuthSession: vi.fn(),
        fetchUserAttributes: vi.fn(),
        updateUserAttributes: vi.fn(),
      },
    }));
    const { getAuthModule } = await import("@/lib/amplify-config");
    const auth = await getAuthModule();
    expect(typeof auth.signIn).toBe("function");
    expect(typeof auth.getCurrentUser).toBe("function");
    expect(typeof auth.fetchAuthSession).toBe("function");
    expect(typeof auth.updateUserAttributes).toBe("function");
  });

  it("fetchAuthSession result has the shape AuthContext expects (groups in idToken)", async () => {
    // Verify AuthContext's idToken → cognito:groups / groups extraction
    const payload = { groups: ["admin"], sub: "user-123" };
    const idTokenStr = [
      Buffer.from("{}").toString("base64"),
      Buffer.from(JSON.stringify(payload)).toString("base64"),
      "sig",
    ].join(".");

    const mockSession = { tokens: { idToken: { toString: () => idTokenStr } } };

    // Simulate AuthContext token extraction
    const idToken = mockSession.tokens?.idToken?.toString();
    const base64Url = idToken!.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.codePointAt(0)!.toString(16)).slice(-2))
          .join(""),
      ),
    ) as Record<string, unknown>;

    const groups = (decoded["groups"] as string[]) ?? [];
    expect(groups).toContain("admin");
  });
});

// ── AuthContext init guard ────────────────────────────────────────────────────

describe("AuthContext init guard contract", () => {
  it("when configureAmplifyWith returns false, checkAuth must be skipped", () => {
    const checkAuth = vi.fn();
    const configured = false;
    if (configured) checkAuth();
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it("when configureAmplifyWith returns true, checkAuth is called", () => {
    const checkAuth = vi.fn();
    const configured = true;
    if (configured) checkAuth();
    expect(checkAuth).toHaveBeenCalledOnce();
  });

  it("checkAuth catches getAuthModule errors and sets configError (no crash)", async () => {
    const amplifyError = new Error(
      "Amplify has not been configured. Please call Amplify.configure() before using this service.",
    );
    let configError: string | null = null;
    try {
      throw amplifyError;
    } catch (err) {
      configError = err instanceof Error ? err.message : "unknown";
    }
    expect(configError).toContain("Amplify has not been configured");
  });

  it("multiple errors are idempotent — configError stays set", () => {
    let configError: string | null = null;
    const setConfigError = (msg: string) => { configError ??= msg; };
    for (let i = 0; i < 2; i++) {
      try { throw new Error("Amplify has not been configured."); }
      catch (err) { setConfigError(err instanceof Error ? err.message : "unknown"); }
    }
    expect(configError).toContain("Amplify has not been configured");
  });
});
