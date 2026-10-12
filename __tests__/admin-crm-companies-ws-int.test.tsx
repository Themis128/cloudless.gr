/**
 * Admin/dashboard tails: crm/companies, analytics/workspaces, integrations.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import CompaniesPage from "@/app/[locale]/admin/crm/companies/page";
import WsAnalyticsPage from "@/app/[locale]/admin/analytics/workspaces/page";
import IntegrationsPage from "@/app/[locale]/admin/integrations/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("admin crm companies", () => {
  const companies = [
    {
      id: "c1",
      name: "Acme Ltd",
      website: "https://acme.gr",
      billingAddressCity: "Athens",
      billingAddressCountry: "GR",
      createdAt: "2026-01-02T00:00:00Z",
    },
    { id: "c2", name: "Beta SA" },
  ];

  it("renders the company table and filters via search", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson({ companies }));
    const { container, getByPlaceholderText, queryByText } = render(
      <CompaniesPage />
    );
    await waitFor(() => expect(container.textContent).toContain("Acme Ltd"));
    expect(container.textContent).toContain("Athens");
    expect(container.textContent).toContain("acme.gr");

    await act(async () =>
      fireEvent.change(getByPlaceholderText(/search/i), {
        target: { value: "beta" },
      })
    );
    expect(queryByText("Acme Ltd")).toBeNull();
    expect(container.textContent).toContain("Beta SA");
  });

  it("shows HTTP error on non-OK", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<CompaniesPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});

describe("admin crm companies tails", () => {
  it("interval and visibilitychange re-fetch companies", async () => {
    vi.useFakeTimers();
    try {
      fetchWithAuthMock.mockImplementation(async () =>
        okJson({ companies: [] })
      );
      render(<CompaniesPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const initial = fetchWithAuthMock.mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchWithAuthMock.mock.calls.length).toBe(initial + 1);

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });
      expect(fetchWithAuthMock.mock.calls.length).toBe(initial + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("manual Refresh button re-fetches", async () => {
    fetchWithAuthMock.mockImplementation(async () =>
      okJson({ companies: [], fetchedAt: "2026-02-01T10:00:00Z" })
    );
    const { getByText } = render(<CompaniesPage />);
    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalled());
    const n = fetchWithAuthMock.mock.calls.length;
    await act(async () => fireEvent.click(getByText("Refresh")));
    await waitFor(() =>
      expect(fetchWithAuthMock.mock.calls.length).toBeGreaterThan(n)
    );
  });
});

describe("admin analytics workspaces", () => {
  const ws = {
    workspaceId: "w1",
    workspace: { id: "w1", name: "Acme Corp", slug: "acme" },
    portals: { total: 3, active: 2, expiringSoon: 1, averageHealth: 72, expired: 0 },
    deliverables: { total: 5, inReview: 1, approved: 3, changesRequested: 1, draft: 0 },
    revenue: {
      openCount: 1,
      paidCount: 2,
      voidCount: 0,
      openAmountCents: 50000,
      paidAmountCents: 120000,
      currency: "EUR",
    },
    calendar: {
      total: 4,
      draft: 1,
      scheduled: 2,
      published: 1,
      cancelled: 0,
      nextScheduledAt: "2026-02-01T09:00:00Z",
    },
  };

  it("renders org-wide + per-workspace analytics cards", async () => {
    fetchWithAuthMock.mockResolvedValue(
      okJson({
        workspaces: [ws],
        orgWide: { ...ws, workspaceId: null, workspace: null },
      })
    );
    const { container } = render(<WsAnalyticsPage />);
    await waitFor(() => expect(container.textContent).toContain("Acme Corp"));
    expect(container.textContent).toContain("72");
    expect(container.textContent).toMatch(/€1,200|1,200/);
  });

  it("shows the error state on failure", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<WsAnalyticsPage />);
    await waitFor(() => expect(container.textContent).toMatch(/HTTP 500|error/i));
  });
});

describe("admin integrations", () => {
  it("groups integrations by category with status badges", async () => {
    fetchWithAuthMock.mockResolvedValue(
      okJson({
        integrations: [
          {
            id: "stripe",
            name: "Stripe",
            category: "Payments",
            status: "configured",
            setupUrl: "/admin/billing",
          },
          {
            id: "tiktok",
            name: "TikTok Ads",
            category: "Advertising",
            status: "degraded",
            message: "Token rejected",
            setupUrl: "https://ads.tiktok.com",
          },
        ],
        summary: { total: 2, configured: 1, degraded: 1, not_configured: 0, error: 0 },
        checkedAt: "2026-01-05T00:00:00Z",
      })
    );
    const { container } = render(<IntegrationsPage />);
    await waitFor(() => expect(container.textContent).toContain("Stripe"));
    expect(container.textContent).toContain("TikTok Ads");
    expect(container.textContent).toContain("Token rejected");
    // only non-configured rows render a Connect link
    const links = [...container.querySelectorAll("a")];
    expect(
      links.some((a) => a.getAttribute("href") === "https://ads.tiktok.com")
    ).toBe(true);
    expect(links.some((a) => a.getAttribute("href") === "/admin/billing")).toBe(false);
  });

  it("shows HTTP error on failure", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<IntegrationsPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});
