/**
 * Client-page batch — auth reset-confirm + reset-password,
 * dashboard services + profile.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const searchParamsMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn(async () => {}));
const authUser = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
}));
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: searchParamsMock }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: authUser.user, updateProfile: updateProfileMock, isLoading: false }),
}));
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en"] }));
vi.mock("@/lib/i18n", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...mod, translate: (_l: string, _k: string, fb: string) => fb };
});

import ResetConfirmPage from "@/app/[locale]/auth/reset-confirm/page";
import ResetPasswordPage from "@/app/[locale]/auth/reset-password/page";
import DashboardServicesPage from "@/app/[locale]/dashboard/services/page";
import DashboardProfilePage from "@/app/[locale]/dashboard/profile/page";

const flush = () => act(async () => { await Promise.resolve(); });

describe("auth reset-confirm page", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    searchParamsMock.mockReturnValue("tok-123");
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  it("shows missing-token error and blocks submit", async () => {
    searchParamsMock.mockReturnValue(null);
    const { container } = render(<ResetConfirmPage />);
    expect(container.textContent).toMatch(/token|invalid|expired/i);
  });

  it("submits the new password and shows success", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { container } = render(<ResetConfirmPage />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: "newpass123" } });
    fireEvent.change(inputs[1], { target: { value: "newpass123" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(container.textContent).toMatch(/reset|success|sign in/i));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.token).toBe("tok-123");
  });

  it("surfaces the API error on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Token expired" }), { status: 400 })
    );
    const { container } = render(<ResetConfirmPage />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: "newpass123" } });
    fireEvent.change(inputs[1], { target: { value: "newpass123" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(container.textContent).toContain("Token expired"));
  });
});

describe("auth reset-password page", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  it("sends the reset email and shows the sent state", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { container } = render(<ResetPasswordPage />);
    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "a@b.com" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(container.textContent).toMatch(/sent|check|inbox|email/i));
  });

  it("shows the API error on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many attempts" }), { status: 429 })
    );
    const { container } = render(<ResetPasswordPage />);
    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "a@b.com" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(container.textContent).toContain("Too many attempts"));
  });
});

describe("dashboard services page", () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.user = { email: "u@x.dev" };
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
  });

  it("renders portal status and fetched portal data when approved", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "approved", portalToken: "tok1", plan: "pro", planLabel: "Pro", submittedAt: "2026-01-01" }),
        { status: 200 }
      )
    );
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "Acme Portal",
          steps: [{ id: "s1", title: "Discovery", status: "completed" }],
          services: [{ name: "Audit" }],
        }),
        { status: 200 }
      )
    );
    const { container } = render(<DashboardServicesPage />);
    await flush();
    await flush();
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).toContain("1/1 steps completed");
  });

  it("renders waiting / none statuses", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "waiting", submittedAt: "2026-01-01" }), { status: 200 })
    );
    const { container } = render(<DashboardServicesPage />);
    await flush();
    expect(container.textContent).toMatch(/waiting|review|pending/i);
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "none" }), { status: 200 })
    );
    cleanup();
    const { container: c2 } = render(<DashboardServicesPage />);
    await flush();
    expect(c2.textContent).toContain("No active service");
  });
});

describe("dashboard profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.user = { email: "u@x.dev", name: "Pat", company: "Acme", phone: "123" };
  });
  afterEach(() => cleanup());

  it("prefills the form and saves via updateProfile", async () => {
    const { container } = render(<DashboardProfilePage />);
    const nameInput = container.querySelector("#profile-name")! as HTMLInputElement;
    expect(nameInput.value).toBe("Pat");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await flush();
    expect(updateProfileMock).toHaveBeenCalled();
    expect(container.textContent).toMatch(/saved|updated/i);
  });

  it("saves edited field values", async () => {
    const { container } = render(<DashboardProfilePage />);
    fireEvent.change(container.querySelector("#profile-name")!, { target: { value: "New Name" } });
    fireEvent.change(container.querySelector("#profile-company")!, { target: { value: "NewCo" } });
    fireEvent.change(container.querySelector("#profile-phone")!, { target: { value: "999" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await flush();
    expect(updateProfileMock).toHaveBeenCalledWith({ name: "New Name", company: "NewCo", phone: "999" });
  });

  it("shows the update error", async () => {
    updateProfileMock.mockRejectedValueOnce(new Error("DB down"));
    const { container } = render(<DashboardProfilePage />);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(container.textContent).toContain("DB down"));
  });
});
