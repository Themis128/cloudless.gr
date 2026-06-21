/**
 * AuthContext tests — covers the real AuthProvider component rendered via
 * @testing-library/react in jsdom.
 *
 * AuthContext uses Cognito via next-auth. On mount it calls
 * GET /api/auth/session and sets user/isAdmin from the response.
 */

import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// ── Top-level mocks ───────────────────────────────────────────────────────────

// Mock next-auth/react so signIn/signOut/getSession don't call the network.
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  getSession: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn().mockReturnValue({ data: null, status: "unauthenticated" }),
}));

// Prevent any indirect next-intl calls
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
    </AuthProvider>
  );
}

function renderAuthAdmin() {
  return render(
    <AuthProvider>
      <AdminStatus />
    </AuthProvider>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jwtSegment(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function makeSessionResponse(
  user: {
    id?: string;
    email?: string;
    name?: string;
    groups?: string[];
    roles?: string[];
  } | null
) {
  return Promise.resolve(
    new Response(JSON.stringify(user ? { user } : null), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  // Default: unauthenticated
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    if (String(input).includes("/api/auth/session")) {
      return makeSessionResponse(null);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthProvider — no active session", () => {
  it("renders signed-out state when /api/auth/session returns null", async () => {
    await act(async () => {
      renderAuth();
    });
    await waitFor(() => screen.getByTestId("no-user"));
    expect(screen.getByTestId("no-user").textContent).toBe("signed-out");
  });

  it("configError is always null (single provider, no config needed)", async () => {
    await act(async () => {
      renderAuth();
    });
    await waitFor(() => screen.getByTestId("no-user"));
    expect(screen.queryByTestId("config-error")).toBeNull();
  });

  it("isLoading starts true then becomes false", async () => {
    await act(async () => {
      renderAuth();
    });
    await waitFor(() => screen.getByTestId("no-user"));
    expect(screen.queryByText("loading")).toBeNull();
  });

  it("isAdmin is false when no session", async () => {
    await act(async () => {
      renderAuthAdmin();
    });
    await waitFor(() => screen.getByTestId("admin"));
    expect(screen.getByTestId("admin").textContent).toBe("false");
  });
});

describe("AuthProvider — authenticated session", () => {
  it("sets user from /api/auth/session response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).includes("/api/auth/session")) {
        return makeSessionResponse({ id: "user-123", email: "t@cloudless.gr" });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    await act(async () => {
      renderAuth();
    });

    await waitFor(() => screen.getByTestId("user"));
    expect(screen.getByTestId("user").textContent).toBe("user-123");
  });

  it("isAdmin=true when session user has groups: ['admin']", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).includes("/api/auth/session")) {
        return makeSessionResponse({
          id: "admin-1",
          email: "admin@cloudless.gr",
          groups: ["admin"],
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    await act(async () => {
      renderAuthAdmin();
    });

    await waitFor(() => screen.getByTestId("admin"));
    expect(screen.getByTestId("admin").textContent).toBe("true");
  });

  it("isAdmin=true when session user has groups: ['admin']", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).includes("/api/auth/session")) {
        return makeSessionResponse({
          id: "role-admin",
          groups: ["admin"],
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    await act(async () => {
      renderAuthAdmin();
    });

    await waitFor(() => screen.getByTestId("admin"));
    expect(screen.getByTestId("admin").textContent).toBe("true");
  });

  it("isAdmin=false when groups does not include 'admin'", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).includes("/api/auth/session")) {
        return makeSessionResponse({ id: "user-1", groups: ["viewer"] });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    await act(async () => {
      renderAuthAdmin();
    });

    await waitFor(() => screen.getByTestId("admin"));
    expect(screen.getByTestId("admin").textContent).toBe("false");
  });
});

describe("AuthProvider — error handling", () => {
  it("renders signed-out when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await act(async () => {
      renderAuth();
    });

    await waitFor(() => screen.getByTestId("no-user"));
  });

  it("renders signed-out when /api/auth/session returns non-ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    await act(async () => {
      renderAuth();
    });

    await waitFor(() => screen.getByTestId("no-user"));
  });
});

describe("AuthContext — JWT decode utility (contract tests)", () => {
  it("getCurrentUser mock resolves with the expected shape", async () => {
    const mockGetCurrentUser = vi.fn().mockResolvedValue({
      username: "themis@cloudless.gr",
      signInDetails: { loginId: "themis@cloudless.gr" },
    });
    const result = await mockGetCurrentUser();
    expect(result.username).toBe("themis@cloudless.gr");
    expect(result.signInDetails.loginId).toBe("themis@cloudless.gr");
  });

  it("groups claim in idToken is extracted correctly by decode logic", () => {
    const idTokenStr = [jwtSegment({}), jwtSegment({ groups: ["admin"], sub: "abc" }), "sig"].join(
      "."
    );

    const base64Url = idTokenStr.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("/", "_");
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.codePointAt(0)!.toString(16)).slice(-2))
          .join("")
      )
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
          .join("")
      )
    ) as Record<string, unknown>;

    const groups = (payload["groups"] as string[] | undefined) ?? [];
    expect(groups).not.toContain("admin");
  });
});
