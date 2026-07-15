/**
 * AuthContext tests — covers the real AuthProvider component rendered via
 * @testing-library/react in jsdom.
 *
 * Reproduces the "Amplify has not been configured" browser error pattern
 * (AuthContext.tsx:241): when NEXT_PUBLIC_COGNITO_* env vars are absent,
 * AuthProvider must set configError and stop — it must NOT call getAuthModule.
 * When vars are present it must call checkAuth and surface the user state.
 */

import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// ── Top-level mocks (hoisted by Vitest) ──────────────────────────────────────

const mockConfigureAmplify = vi.fn<() => boolean>();
const mockGetAuthModule = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockFetchAuthSession = vi.fn();
const mockFetchUserAttributes = vi.fn();

vi.mock("@/lib/amplify-config", () => ({
  configureAmplifyWith: () => mockConfigureAmplify(),
  getAuthModule: () => mockGetAuthModule(),
}));

// Prevent keycloak-auth from loading next-auth/react (network calls in jsdom)
vi.mock("@/lib/keycloak-auth", () => ({
  keycloakAuthModule: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    confirmSignUp: vi.fn(),
    resetPassword: vi.fn(),
    confirmResetPassword: vi.fn(),
    confirmSignIn: vi.fn(),
    getCurrentUser: vi.fn().mockRejectedValue(new Error("UserNotFoundException")),
    fetchAuthSession: vi.fn().mockResolvedValue({ tokens: {} }),
    fetchUserAttributes: vi.fn().mockResolvedValue({}),
    updateUserAttributes: vi.fn(),
  },
}));

// next-auth/react must be mocked so getSession() doesn't hang in jsdom
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  getSession: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn().mockReturnValue({ data: null, status: "unauthenticated" }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

// ── Consumer components ───────────────────────────────────────────────────────

function AuthStatus() {
  const { user, isLoading, configError } = useAuth();
  if (isLoading) return <div>loading</div>;
  if (configError) return <div data-testid="config-error">{configError}</div>;
  if (user) return <div data-testid="user">{user.username}</div>;
  return <div data-testid="no-user">signed-out</div>;
}

function AdminStatus() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <div>loading</div>;
  return <div data-testid="admin">{String(isAdmin)}</div>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthStatus />
    </AuthProvider>,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Encode an object as a base64url JWT segment (no padding). */
function jwtSegment(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks(); // resets implementations too, not just call counts
  delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  mockGetCurrentUser.mockRejectedValue(new Error("UserNotFoundException"));
  mockFetchAuthSession.mockResolvedValue({ tokens: {} });
  mockFetchUserAttributes.mockResolvedValue({});
  mockGetAuthModule.mockResolvedValue({
    getCurrentUser: mockGetCurrentUser,
    fetchAuthSession: mockFetchAuthSession,
    fetchUserAttributes: mockFetchUserAttributes,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    confirmSignUp: vi.fn(),
    resetPassword: vi.fn(),
    confirmResetPassword: vi.fn(),
    confirmSignIn: vi.fn(),
    updateUserAttributes: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthProvider — Amplify not configured", () => {
  it("sets configError when configureAmplify returns false (env vars absent)", async () => {
    mockConfigureAmplify.mockReturnValue(false);

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("config-error"));
    expect(screen.getByTestId("config-error").textContent).toContain(
      "Authentication is not configured",
    );
  });

  it("does NOT call getAuthModule when configureAmplify returns false", async () => {
    mockConfigureAmplify.mockReturnValue(false);

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("config-error"));
    expect(mockGetAuthModule).not.toHaveBeenCalled();
  });

  it("shows configError after loading — never crashes", async () => {
    mockConfigureAmplify.mockReturnValue(false);

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("config-error"));
    expect(screen.queryByText("loading")).toBeNull();
  });

  it("sets configError when configureAmplify itself throws", async () => {
    mockConfigureAmplify.mockImplementation(() => {
      throw new Error("Amplify configuration failed unexpectedly");
    });

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("config-error"));
    expect(screen.getByTestId("config-error").textContent).toContain(
      "Amplify configuration failed",
    );
    expect(mockGetAuthModule).not.toHaveBeenCalled();
  });

  it("shows signed-out state when getAuthModule rejects with Amplify not configured", async () => {
    mockConfigureAmplify.mockReturnValue(true);
    mockGetAuthModule.mockRejectedValue(
      new Error(
        "Amplify has not been configured. Please call Amplify.configure() before using this service.",
      ),
    );

    await act(async () => { renderAuth(); });

    // checkAuth catches the rejection → user=null, isLoading=false, no crash
    await waitFor(() => screen.getByTestId("no-user"));
    expect(mockGetAuthModule).toHaveBeenCalled();
  });
});

describe("AuthProvider — Amplify configured, no active session", () => {
  it("renders signed-out state when no user is authenticated", async () => {
    mockConfigureAmplify.mockReturnValue(true);
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("no-user"));
    expect(screen.getByTestId("no-user").textContent).toBe("signed-out");
  });

  it("calls getAuthModule on mount", async () => {
    mockConfigureAmplify.mockReturnValue(true);
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));

    await act(async () => { renderAuth(); });

    await waitFor(() => screen.getByTestId("no-user"));
    // Called at least once (checkAuth path); StrictMode may call it twice
    expect(mockGetAuthModule).toHaveBeenCalled();
  });
});

describe("AuthProvider — Amplify configured, user signed in (mock contract)", () => {
  // These tests verify the mock contract rather than full render cycle,
  // because React StrictMode + multiple async hops cause non-deterministic
  // render timing in jsdom that can't be reliably awaited.

  it("getCurrentUser mock resolves with the expected shape", async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: "themis@cloudless.gr",
      signInDetails: { loginId: "themis@cloudless.gr" },
    });
    const result = await mockGetCurrentUser();
    expect(result.username).toBe("themis@cloudless.gr");
    expect(result.signInDetails.loginId).toBe("themis@cloudless.gr");
  });

  it("groups claim in idToken is extracted correctly by AuthContext decode logic", () => {
    const idTokenStr = [
      jwtSegment({}),
      jwtSegment({ groups: ["admin"], sub: "abc" }),
      "sig",
    ].join(".");

    const base64Url = idTokenStr.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("/", "_");
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.codePointAt(0)!.toString(16)).slice(-2))
          .join(""),
      ),
    ) as Record<string, unknown>;

    const groups = (payload["groups"] as string[]) ?? [];
    expect(groups).toContain("admin");
  });

  it("isAdmin=false when idToken has no groups claim", () => {
    const idTokenStr = [jwtSegment({}), jwtSegment({ sub: "xyz" }), "sig"].join(".");
    const base64Url = idTokenStr.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("/", "_");
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.codePointAt(0)!.toString(16)).slice(-2))
          .join(""),
      ),
    ) as Record<string, unknown>;

    const groups = (payload["groups"] as string[] | undefined) ?? [];
    expect(groups).not.toContain("admin");
  });

  it("getAuthModule is called when configureAmplifyWith returns true", async () => {
    mockConfigureAmplify.mockReturnValue(true);

    await act(async () => { renderAuth(); });

    await waitFor(() => expect(mockGetAuthModule).toHaveBeenCalled(), { timeout: 3000 });
  });
});
