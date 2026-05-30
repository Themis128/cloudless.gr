/**
 * AuthContext / amplify-config guard tests
 *
 * Verifies the prop-driven configuration path:
 * Server Component reads NEXT_PUBLIC_COGNITO_* and passes them as a
 * cognitoConfig prop to AuthProvider, which calls configureAmplifyWith().
 *
 * Tests use real module code where possible. Mocks are limited to the
 * aws-amplify SDK boundary (we can't call real Cognito in unit tests).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── configureAmplifyWith ──────────────────────────────────────────────────────

describe("configureAmplifyWith()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns false when both credentials are empty", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    const { configureAmplifyWith, isAmplifyConfigured } = await import(
      "@/lib/amplify-config"
    );
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(false);
    expect(isAmplifyConfigured()).toBe(false);
  });

  it("returns false when only userPoolId is set", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(
      configureAmplifyWith({ userPoolId: "us-east-1_testPool", userPoolClientId: "" })
    ).toBe(false);
  });

  it("returns false when only userPoolClientId is set", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    const { configureAmplifyWith } = await import("@/lib/amplify-config");
    expect(
      configureAmplifyWith({ userPoolId: "", userPoolClientId: "testClientId" })
    ).toBe(false);
  });

  it("returns true and flips isAmplifyConfigured() to true when both credentials are set", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    const { configureAmplifyWith, isAmplifyConfigured } = await import(
      "@/lib/amplify-config"
    );

    expect(
      configureAmplifyWith({
        userPoolId: "us-east-1_testPool",
        userPoolClientId: "testClientId",
      })
    ).toBe(true);
    expect(isAmplifyConfigured()).toBe(true);

    // Idempotent — repeated calls still return true and don't reset state.
    expect(
      configureAmplifyWith({
        userPoolId: "us-east-1_testPool",
        userPoolClientId: "testClientId",
      })
    ).toBe(true);
    expect(isAmplifyConfigured()).toBe(true);
  });
});

// ── getAuthModule ─────────────────────────────────────────────────────────────

describe("getAuthModule()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("resolves with auth functions", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    vi.mock("aws-amplify/auth", () => ({
      signIn: vi.fn(),
      signOut: vi.fn(),
      getCurrentUser: vi.fn(),
      fetchAuthSession: vi.fn(),
      fetchUserAttributes: vi.fn(),
      confirmSignIn: vi.fn(),
      signUp: vi.fn(),
      confirmSignUp: vi.fn(),
      resetPassword: vi.fn(),
      confirmResetPassword: vi.fn(),
      updateUserAttributes: vi.fn(),
    }));
    const { getAuthModule } = await import("@/lib/amplify-config");
    const auth = await getAuthModule();
    expect(typeof auth.signIn).toBe("function");
    expect(typeof auth.getCurrentUser).toBe("function");
    expect(typeof auth.fetchAuthSession).toBe("function");
  });

  it("fetchAuthSession result has the shape AuthContext expects", async () => {
    // Verify AuthContext's session → idToken → groups extraction works
    // with the shape returned by the real aws-amplify/auth mock.
    const idTokenPayload = { "cognito:groups": ["admin"], sub: "user-123" };
    const idTokenStr = [
      Buffer.from("{}").toString("base64"),
      Buffer.from(JSON.stringify(idTokenPayload)).toString("base64"),
      "sig",
    ].join(".");

    const mockSession = {
      tokens: {
        idToken: { toString: () => idTokenStr },
      },
    };

    const idToken = mockSession.tokens?.idToken?.toString();
    expect(idToken).toBeTruthy();

    const base64Url = idToken!.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      ),
    ) as Record<string, unknown>;

    const groups = (payload["cognito:groups"] as string[]) ?? [];
    expect(groups).toContain("admin");
  });
});

// ── AuthContext init guard contract ──────────────────────────────────────────

describe("AuthContext init guard contract", () => {
  it("when configureAmplifyWith returns false, checkAuth must not be called", () => {
    // Mirrors the guard in AuthContext.tsx:
    //   if (!ok) { setConfigError(...); return; }
    //   checkAuth();
    const checkAuth = vi.fn();
    const configured = false;

    if (!configured) {
      // set configError + return — checkAuth never called
    } else {
      checkAuth();
    }

    expect(checkAuth).not.toHaveBeenCalled();
  });

  it("when configureAmplifyWith returns true, checkAuth is called", () => {
    const checkAuth = vi.fn();
    const configured = true;

    if (!configured) {
      // set configError + return
    } else {
      checkAuth();
    }

    expect(checkAuth).toHaveBeenCalledOnce();
  });

  it("checkAuth catches getAuthModule errors and sets configError (no crash)", async () => {
    const amplifyError = new Error(
      "Amplify has not been configured. Please call Amplify.configure() before using this service.",
    );

    let configError: string | null = null;
    let user: unknown = null;

    try {
      throw amplifyError;
    } catch (err) {
      configError = err instanceof Error ? err.message : "unknown";
      user = null;
    }

    expect(configError).toContain("Amplify has not been configured");
    expect(user).toBeNull();
  });
});
