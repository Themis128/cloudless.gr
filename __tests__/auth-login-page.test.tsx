/**
 * Tests for src/app/[locale]/auth/login/page.tsx — form, signIn errors,
 * required-field validation, activated banner, redirect-safety logic.
 *
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.hoisted(() => vi.fn());
const signInMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: null as null | { email: string },
  isAdmin: false,
  isLoading: false,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    isAdmin: authState.isAdmin,
    isLoading: authState.isLoading,
    signIn: signInMock,
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsMock }),
}));
vi.mock("@/lib/i18n", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...mod, translate: (_l: string, _k: string, fb: string) => fb };
});
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en"] }));

import LoginPage from "@/app/[locale]/auth/login/page";

describe("login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isAdmin = false;
    authState.isLoading = false;
    searchParamsMock.mockReturnValue(null);
  });
  afterEach(() => cleanup());

  it("renders the form and submits signIn with trimmed email", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: " a@b.com " } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw123456" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    });
    expect(signInMock).toHaveBeenCalledWith("a@b.com", "pw123456");
  });

  it("shows required-field error without calling signIn", async () => {
    render(<LoginPage />);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    });
    expect(signInMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").textContent).toContain("required");
  });

  it("surfaces the signIn error message", async () => {
    signInMock.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    });
    await waitFor(() =>
      expect(screen.getByTestId("auth-error").textContent).toContain("Invalid credentials")
    );
  });

  it("shows the activated banner when activated=1", async () => {
    searchParamsMock.mockImplementation((k: string) => (k === "activated" ? "1" : null));
    render(<LoginPage />);
    expect(screen.getByText(/Account activated/)).toBeTruthy();
  });

  it("redirects an authenticated user to /dashboard (or /admin)", async () => {
    authState.user = { email: "a@b.com" };
    render(<LoginPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    cleanup();
    pushMock.mockClear();
    authState.isAdmin = true;
    render(<LoginPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin"));
  });

  it("redirects to a safe `next` path, strips the locale prefix, rejects unsafe paths", async () => {
    authState.user = { email: "a@b.com" };
    searchParamsMock.mockImplementation((k: string) => (k === "next" ? "/en/dashboard/settings" : null));
    render(<LoginPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/settings"));
    cleanup();
    pushMock.mockClear();
    // protocol-relative open redirect attempt → falls back to /dashboard
    searchParamsMock.mockImplementation((k: string) => (k === "next" ? "//evil.example/x" : null));
    render(<LoginPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("redirects portal paths via window.location instead of the i18n router", async () => {
    authState.user = { email: "a@b.com" };
    searchParamsMock.mockImplementation((k: string) => (k === "next" ? "/portal/tok123" : null));
    const loc = { href: "" };
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });
    render(<LoginPage />);
    await waitFor(() => expect(loc.href).toBe("/portal/tok123"));
    expect(pushMock).not.toHaveBeenCalledWith("/portal/tok123");
  });

  it("renders the loading spinner while auth state resolves", () => {
    authState.isLoading = true;
    const { container } = render(<LoginPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });
});
