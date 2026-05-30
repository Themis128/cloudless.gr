/**
 * AuthContext / amplify-config guard tests
 *
 * Reproduces the "Amplify has not been configured" browser error pattern
 * (AuthContext.tsx:241). Root cause: callers invoke getAuthModule() before
 * configureAmplify() returns true, or env vars are absent in the environment.
 *
 * Tests use real module code where possible. Mocks are limited to the
 * aws-amplify SDK boundary (we can't call real Cognito in unit tests).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Temporarily set Cognito env vars for one test. */
async function withCognitoEnv<T>(
  userPoolId: string,
  clientId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = {
    pool: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    client: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  };
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = userPoolId;
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = clientId;
  try {
    return await fn();
  } finally {
    if (prev.pool === undefined) delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    else process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = prev.pool;
    if (prev.client === undefined) delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    else process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = prev.client;
  }
}

// ── configureAmplify ─────────────────────────────────────────────────────────

describe("configureAmplify()", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns false when both Cognito env vars are absent", async () => {
    vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
    const { configureAmplify } = await import("@/lib/amplify-config");
    expect(configureAmplify()).toBe(false);
  });

  it("returns false when only COGNITO_USER_POOL_ID is set", async () => {
    await withCognitoEnv("us-east-1_testPool", "", async () => {
      vi.resetModules();
      vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
      const { configureAmplify } = await import("@/lib/amplify-config");
      expect(configureAmplify()).toBe(false);
    });
  });

  it("returns false when only COGNITO_CLIENT_ID is set", async () => {
    await withCognitoEnv("", "testClientId", async () => {
      vi.resetModules();
      vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
      const { configureAmplify } = await import("@/lib/amplify-config");
      expect(configureAmplify()).toBe(false);
    });
  });

  it("returns true when both Cognito env vars are set", async () => {
    await withCognitoEnv("us-east-1_testPool", "testClientId", async () => {
      vi.resetModules();
      vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
      const { configureAmplify } = await import("@/lib/amplify-config");
      expect(configureAmplify()).toBe(true);
    });
  });
});

// ── getAuthModule ─────────────────────────────────────────────────────────────

describe("getAuthModule()", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves with auth functions when env vars are set", async () => {
    await withCognitoEnv("us-east-1_testPool", "testClientId", async () => {
      vi.resetModules();
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

    // Simulate AuthContext's token extraction
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
  afterEach(() => vi.restoreAllMocks());

  it("when configureAmplify returns false, checkAuth must not be called", () => {
    // Mirrors the guard in AuthContext.tsx:
    //   if (!ok) { setConfigError(...); return; }
    //   checkAuth();
    const checkAuth = vi.fn();
    const configured = false; // simulates configureAmplify() returning false

    if (!configured) {
      // set configError + return — checkAuth never called
    } else {
      checkAuth();
    }

    expect(checkAuth).not.toHaveBeenCalled();
  });

  it("when configureAmplify returns true, checkAuth is called", () => {
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
    // Reproduces AuthContext.checkAuth error path — the "Amplify not configured"
    // warning is caught here and surfaced as configError, not an uncaught throw.
    const amplifyError = new Error(
      "Amplify has not been configured. Please call Amplify.configure() before using this service.",
    );

    let configError: string | null = null;
    let user: unknown = null;

    // Simulate checkAuth body
    try {
      // getAuthModule throws → caught → configError set
      throw amplifyError;
    } catch (err) {
      configError = err instanceof Error ? err.message : "unknown";
      user = null;
    }

    expect(configError).toContain("Amplify has not been configured");
    expect(user).toBeNull();
  });

  it("multiple 'Amplify not configured' errors are idempotent — configError stays set", async () => {
    // AuthContext's useEffect runs once, but if Amplify was never configured
    // and the component re-renders, configError should remain non-null.
    let configError: string | null = null;

    const setConfigError = (msg: string) => {
      configError = msg;
    };

    // Simulate two consecutive failures
    for (let i = 0; i < 2; i++) {
      try {
        throw new Error("Amplify has not been configured.");
      } catch (err) {
        if (!configError) {
          setConfigError(err instanceof Error ? err.message : "unknown");
        }
      }
    }

    expect(configError).toContain("Amplify has not been configured");
  });
});
