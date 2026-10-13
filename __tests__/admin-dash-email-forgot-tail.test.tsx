/**
 * admin dashboard populated stats + action queue, admin email tabs,
 * and the forgot-password submit paths.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const match = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out.clone();
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en"],
}));

const { mockForgotPassword } = vi.hoisted(() => ({ mockForgotPassword: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    isLoading: false,
    forgotPassword: mockForgotPassword,
  }),
}));

import AdminDashboardPage from "@/app/[locale]/admin/page";
import AdminEmailPage from "@/app/[locale]/admin/email/page";
import ForgotPasswordPage from "@/app/[locale]/auth/forgot-password/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

beforeEach(() => {
  routes = {};
  fetchWithAuthMock.mockClear();
  mockForgotPassword.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin dashboard", () => {
  it("aggregates populated stats and renders the action queue", async () => {
    routes["/api/admin/leads"] = okJson({ total: 42 });
    routes["/api/admin/analytics/roi"] = okJson({
      totals: { spendCents: 125000, roas: 3.4 },
    });
    routes["/api/admin/orders"] = okJson({
      orders: [{ amount: 5000 }, { amount: 7500 }],
    });
    routes["/api/admin/client-portals"] = okJson({
      portals: [
        {
          deliverables: [{ status: "in_review" }, { status: "done" }],
          paymentLinks: [{ status: "open" }, { status: "paid" }],
          health: { score: 40, band: "at_risk" },
        },
        {
          deliverables: [{ status: "in_review" }],
          paymentLinks: [],
          health: { score: 95, band: "healthy" },
        },
      ],
    });
    routes["/api/admin/pending-clients"] = okJson({
      clients: [{ status: "waiting" }, { status: "approved" }],
    });
    routes["/api/admin/ops/errors"] = okJson({ total: 3 });
    routes["/api/health"] = okJson({ status: "ok", version: "1.2.3" });
    const c = await renderPage(<AdminDashboardPage />);
    await flush();

    // Action-queue items derived from the populated payloads.
    expect(c.textContent).toContain("Needs your attention");
    expect(c.textContent).toContain("Deliverables awaiting client review");
    expect(c.textContent).toContain("Open payment links");
    expect(c.textContent).toContain("Clients waiting for portal approval");
    expect(c.textContent).toContain("Clients needing attention");
    expect(c.textContent).toContain("Unresolved errors");
  });

  it("tolerates a non-JSON endpoint without crashing", async () => {
    routes["/api/admin/leads"] = new Response("<html>proxy error</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    routes["/api/health"] = okJson({ status: "ok", version: "1.0.0" });
    const c = await renderPage(<AdminDashboardPage />);
    await flush();
    // Dashboard shell still renders with null-safe stats.
    expect(c.textContent).toContain("Dashboard");
  });
});

describe("admin/email", () => {
  const contactsBody = {
    contacts: [
      {
        id: "c1",
        emailAddress: "lead@example.com",
        firstName: "Lead",
        lastName: "Person",
        leadSource: "Web Site",
        createdAt: "2026-10-01T10:00:00Z",
      },
      {
        id: "c2",
        emailAddress: "bare@example.com",
      },
    ],
    total: 2,
    fetchedAt: "2026-10-02T00:00:00Z",
  };

  it("renders subscriber rows and switches to the CRM contacts tab", async () => {
    routes["/api/admin/email/contacts"] = okJson(contactsBody);
    const c = await renderPage(<AdminEmailPage />);
    await flush();
    expect(c.textContent).toContain("lead@example.com");
    expect(c.textContent).toContain("Lead Person");

    // contacts tab shows the Source column + badge
    await click(screen.getByText("All CRM Contacts"));
    await flush();
    expect(c.textContent).toContain("Web Site");
    const url = fetchWithAuthMock.mock.lastCall?.[0] as string;
    expect(url).toContain("tab=contacts");
  });

  it("shows the not-configured state on 503", async () => {
    routes["/api/admin/email/contacts"] = okJson({ error: "espo not bound" }, 503);
    const c = await renderPage(<AdminEmailPage />);
    await flush();
    expect(c.textContent).not.toContain("Loading…");
    expect(c.textContent).not.toContain("lead@example.com");
  });

  it("renders the API error on non-ok", async () => {
    routes["/api/admin/email/contacts"] = okJson({ error: "upstream" }, 500);
    const c = await renderPage(<AdminEmailPage />);
    await flush();
    expect(c.textContent).toContain("HTTP 500");
  });
});

describe("auth/forgot-password", () => {
  it("submits the email through the auth context", async () => {
    const c = await renderPage(<ForgotPasswordPage />);
    const input = c.querySelector("#forgot-email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "me@example.com" } });
    fireEvent.submit(c.querySelector("form")!);
    await flush();
    expect(mockForgotPassword).toHaveBeenCalledWith("me@example.com");
  });

  it("shows the provider error when the reset request fails", async () => {
    mockForgotPassword.mockRejectedValue(new Error("reset service down"));
    const c = await renderPage(<ForgotPasswordPage />);
    const input = c.querySelector("#forgot-email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "me@example.com" } });
    fireEvent.submit(c.querySelector("form")!);
    await flush();
    expect(c.textContent).toContain("reset service down");
  });

  it("falls back to a generic message for non-Error rejections", async () => {
    mockForgotPassword.mockRejectedValue("nope");
    const c = await renderPage(<ForgotPasswordPage />);
    const input = c.querySelector("#forgot-email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "me@example.com" } });
    fireEvent.submit(c.querySelector("form")!);
    await flush();
    expect(c.textContent).toContain("Request failed");
  });
});
