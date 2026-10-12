/**
 * Admin tails: leads unified table (search + sources), cost dashboard,
 * appflowy submissions (status PATCH + expand).
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
vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

import LeadsPage from "@/app/[locale]/admin/leads/page";
import CostPage from "@/app/[locale]/admin/cost/page";
import AppflowyPage from "@/app/[locale]/admin/appflowy/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

// ── leads ───────────────────────────────────────────────────────────────────

describe("admin leads", () => {
  const leads = [
    {
      email: "a@x.gr",
      name: "Alice",
      company: "Acme",
      sources: ["espocrm", "portal"],
      interest: "Cloud audit",
      status: "new",
      portalStatus: "active",
      createdAt: "2026-01-10T10:00:00Z",
    },
    {
      email: "b@y.gr",
      name: "Bob",
      sources: ["portal"],
      createdAt: "2026-01-09T10:00:00Z",
    },
  ];

  it("renders the lead table and filters via search", async () => {
    fetchWithAuthMock.mockImplementation(async () => okJson({ leads }));
    const { container, getByPlaceholderText, queryByText } = render(<LeadsPage />);
    await waitFor(() => expect(container.textContent).toContain("Alice"));
    expect(container.textContent).toContain("espocrm");
    expect(container.textContent).toContain("Acme");

    const search = getByPlaceholderText(/search/i);
    await act(async () => fireEvent.change(search, { target: { value: "alice" } }));
    expect(queryByText("Bob")).toBeNull();
    expect(container.textContent).toContain("Alice");
  });

  it("shows the error state when the leads fetch fails", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<LeadsPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});

// ── cost ────────────────────────────────────────────────────────────────────

describe("admin cost", () => {
  it("renders totals, top services and the daily trend", async () => {
    fetchWithAuthMock.mockResolvedValue(
      okJson({
        total_30d: 123.45,
        yesterday: 4.2,
        topServices: [
          { service: "workers-ai", total_usd: 60 },
          { service: "r2", total_usd: 20 },
        ],
        dailyTrend: [
          { cost_date: "2026-01-01", total_usd: 3 },
          { cost_date: "2026-01-02", total_usd: 5 },
        ],
        lastEtlAt: "2026-01-03T00:00:00Z",
      })
    );
    const { container } = render(<CostPage />);
    await waitFor(() => expect(container.textContent).toContain("workers-ai"));
    expect(container.textContent).toContain("$123.45");
    expect(container.textContent).toContain("r2");
  });

  it("shows the unavailable state on non-OK", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 503 }));
    const { container } = render(<CostPage />);
    await waitFor(() =>
      expect(container.textContent).toContain("No cost snapshot")
    );
  });
});

// ── appflowy submissions ────────────────────────────────────────────────────

describe("admin appflowy submissions", () => {
  const submissions = [
    {
      id: "p1",
      name: "Nikos",
      email: "n@x.gr",
      company: "Beta Ltd",
      service: "Migration",
      message: "Need a quote for the move",
      status: "New",
      source: "contact",
      submittedAt: "2026-01-05T09:00:00Z",
      url: "https://appflowy.example/p1",
    },
    {
      id: "p2",
      name: "Maria",
      email: "m@x.gr",
      company: "Gamma",
      service: "Audit",
      message: "Second message body",
      status: "In Review",
      source: "portal",
      submittedAt: "2026-01-04T09:00:00Z",
      url: "",
    },
  ];

  it("lists submissions, expands the message, and PATCHes a status change", async () => {
    fetchWithAuthMock.mockImplementation(async (_u: unknown, init?: RequestInit) =>
      init?.method === "PATCH" ? okJson({ ok: true }) : okJson({ submissions })
    );
    const { container, getAllByText } = render(<AppflowyPage />);
    await waitFor(() => expect(container.textContent).toContain("Nikos"));

    // expand the first submission
    await act(async () => fireEvent.click(getAllByText("▼ show")[0]));
    expect(container.textContent).toContain("Need a quote for the move");
    expect(container.textContent).toContain("Open in AppFlowy");

    // change status via the per-row select
    const select = container.querySelector("select")!;
    await act(async () =>
      fireEvent.change(select, { target: { value: "Done" } })
    );
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([, i]) => (i as RequestInit)?.method === "PATCH"
        )
      ).toBe(true)
    );
    const patch = fetchWithAuthMock.mock.calls.find(
      ([, i]) => (i as RequestInit)?.method === "PATCH"
    )!;
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({
      pageId: "p1",
      status: "Done",
    });
  });

  it("shows the error banner when the list fails", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<AppflowyPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});

describe("admin leads tails", () => {
  it("interval, visibilitychange and manual refresh re-fetch leads", async () => {
    vi.useFakeTimers();
    try {
      fetchWithAuthMock.mockImplementation(async () => okJson({ leads: [] }));
      render(<LeadsPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const initial = fetchWithAuthMock.mock.calls.length;
      expect(initial).toBeGreaterThan(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
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

  it("manual Refresh button triggers a refetch", async () => {
    fetchWithAuthMock.mockImplementation(async () =>
      okJson({ leads: [], fetchedAt: "2026-02-01T10:00:00Z" })
    );
    const { getByText } = render(<LeadsPage />);
    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalled());
    const n = fetchWithAuthMock.mock.calls.length;
    await act(async () => fireEvent.click(getByText("Refresh")));
    await waitFor(() =>
      expect(fetchWithAuthMock.mock.calls.length).toBeGreaterThan(n)
    );
  });
});
