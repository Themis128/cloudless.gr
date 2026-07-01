/**
 * Component tests for src/app/[locale]/auth/signup/page.tsx
 *
 * Signup is delegated to Cognito Hosted UI.
 *
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense } from "react";

const signInMock = vi.hoisted(() => vi.fn());

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isLoading: false,
    configError: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
 </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

vi.mock("@/lib/i18n", () => ({
  translate: (_locale: string, _key: string, fallback: string) => fallback,
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en"],
}));

async function renderSignUp() {
  const { default: SignUpPage } = await import("@/app/[locale]/auth/signup/page");
  return render(
    <Suspense fallback={null}>
      <SignUpPage />
    </Suspense>
  );
}

describe("SignUpPage component", () => {
  beforeEach(() => {
    vi.resetModules();
    signInMock.mockReset();
    signInMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Cognito Hosted UI handoff", async () => {
    await renderSignUp();

    expect(screen.getByRole("heading", { name: /create account/i })).toBeTruthy();
    expect(
      screen.getByText(/account creation is handled securely through aws/i)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue with aws/i })).toBeTruthy();
  });

  it("does not render legacy in-app registration fields", async () => {
    await renderSignUp();

    expect(screen.queryByLabelText(/full name/i)).toBeNull();
    expect(screen.queryByLabelText(/^email$/i)).toBeNull();
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    expect(screen.queryByLabelText(/confirm password/i)).toBeNull();
  });

  it("shows sign-in link", async () => {
    const { container } = await renderSignUp();

    expect(container.querySelector('a[href="/auth/login"]')).toBeTruthy();
  });

  it("delegates signup to Cognito through NextAuth", async () => {
    await renderSignUp();

    fireEvent.submit(screen.getByRole("button", { name: /continue with aws/i }).closest("form")!);

    await waitFor(() => expect(signInMock).toHaveBeenCalled());
    expect(signInMock).toHaveBeenCalledWith("cognito", { callbackUrl: "/auth/post-login" });
  });
});
