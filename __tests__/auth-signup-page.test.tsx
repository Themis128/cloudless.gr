/**
 * Component tests for src/app/[locale]/auth/signup/page.tsx
 *
 * Verifies the new in-app registration flow:
 *   1. Form renders in signup step
 *   2. Client-side password mismatch check
 *   3. Calls POST /api/auth/register with correct payload
 *   4. Transitions to "check-email" state on success
 *   5. Surfaces API error on failure (duplicate email, 503, etc.)
 *
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense } from "react";

// ── top-level mocks ───────────────────────────────────────────────────────────

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
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/lib/i18n", () => ({
  translate: (_locale: string, _key: string, fallback: string) => fallback,
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en"],
}));

// ── helpers ───────────────────────────────────────────────────────────────────

async function renderSignUp() {
  const { default: SignUpPage } = await import("@/app/[locale]/auth/signup/page");
  return render(
    <Suspense fallback={null}>
      <SignUpPage />
    </Suspense>
  );
}

function fillForm(email: string, password: string, confirm: string, name = "") {
  if (name) {
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: name } });
  }
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: confirm },
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("SignUpPage component", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  it("renders the registration form in signup step", async () => {
    await renderSignUp();
    expect(screen.getByRole("heading", { name: /create account/i })).toBeTruthy();
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
  });

  it("shows sign-in link in registration form", async () => {
    const { container } = await renderSignUp();
    expect(container.querySelector('a[href="/auth/login"]')).toBeTruthy();
  });

  it("shows password mismatch error without calling the API", async () => {
    await renderSignUp();
    fillForm("a@b.com", "password1", "different1");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    expect(await screen.findByText(/passwords do not match/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls POST /api/auth/register with email, password, and fullName", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await renderSignUp();
    fillForm("user@cloudless.gr", "mypassword", "mypassword", "Jane Doe");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/register");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string) as {
      email: string;
      password: string;
      fullName: string;
    };
    expect(body.email).toBe("user@cloudless.gr");
    expect(body.password).toBe("mypassword");
    expect(body.fullName).toBe("Jane Doe");
  });

  it("transitions to confirm-code step on successful registration", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: "nonce.12345.sig" }),
    });
    await renderSignUp();
    fillForm("user@cloudless.gr", "mypassword", "mypassword");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /verify your email/i })).toBeTruthy()
    );
    expect(screen.getByRole("button", { name: /confirm account/i })).toBeTruthy();
  });

  it("shows 409 duplicate-email error from API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "An account with this email already exists" }),
    });
    await renderSignUp();
    fillForm("dup@b.com", "password1", "password1");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() => expect(screen.queryByText(/already exists/i)).toBeTruthy());
    expect(screen.queryByRole("heading", { name: /check your email/i })).toBeNull();
  });

  it("shows 503 error when registration service is unavailable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "Registration not available" }),
    });
    await renderSignUp();
    fillForm("a@b.com", "password1", "password1");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() => expect(screen.queryByText(/registration not available/i)).toBeTruthy());
  });

  it("shows generic error when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    await renderSignUp();
    fillForm("a@b.com", "password1", "password1");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() => expect(screen.queryByText(/sign up failed/i)).toBeTruthy());
  });

  it("omits fullName from the request body when name field is empty", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await renderSignUp();
    fillForm("a@b.com", "password1", "password1"); // no fullName
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      fullName?: string;
    };
    expect(body.fullName).toBeUndefined();
  });
});
