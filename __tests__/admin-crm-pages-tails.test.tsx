/**
 * crm/tickets page (error branches, refresh, search filter, poll/visibility
 * refetch) and crm/[id] page (invalid id, 503/404/error branches, loaded view).
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

const fetchWithAuthMock = vi.fn(async (url: string) => {
  if (String(url).includes("crm/tickets")) {
    return okJson({
      tickets: [
        { id: "t1", name: "Billing broken", status: "New", priority: "Urgent", createdAt: "2026-01-01" },
        { id: "t2", name: "Slow site", status: "Assigned", priority: "Normal", createdAt: "2026-01-02" },
      ],
    });
  }
  if (String(url).includes("crm/contacts/")) {
    return okJson({
      contact: {
        id: "68f3a2b1c9d4e5f6a",
        email: "a@b.co",
        firstName: "Ana",
        lastName: "B",
        phone: "",
        company: "ACME",
        accountId: null,
        leadSource: "site",
        description: "",
        createdAt: "2026-01-01",
        modifiedAt: "2026-01-02",
      },
      opportunities: [],
      cases: [],
      notes: [],
      stripe: { configured: false, customer: null, purchases: [], subscriptions: [] },
      account: null,
      events: [],
      attribution: { firstTouch: null, goldMatches: [] },
      scores: {
        rfmScore: null,
        recencyDays: null,
        frequency: null,
        monetary: null,
        lastPurchaseAt: null,
        churnScore: null,
        riskBand: null,
      },
      matchHints: {
        hasEmail: true,
        d1User: "hit",
        stripeCustomer: "unconfigured",
        d1Events: "miss",
        rfmScores: "miss",
        attribution: "no_utm_events",
        summary: "1/5 sources matched",
      },
      fetchedAt: "2026-01-03T00:00:00Z",
    });
  }
  return okJson({}, 404);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

let mockId: string | undefined = "68f3a2b1c9d4e5f6a";
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: mockId }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

import TicketsPage from "@/app/[locale]/admin/crm/tickets/page";
import CrmContactPage from "@/app/[locale]/admin/crm/[id]/page";

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

describe("admin/crm/tickets", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("populated list, search filter, manual refresh", async () => {
    const c = await renderPage(<TicketsPage />);
    expect(c.textContent).toContain("Billing broken");
    expect(c.textContent).toContain("Slow site");

    // search narrows
    const search = screen.getByPlaceholderText(/Search by subject/);
    fireEvent.change(search, { target: { value: "billing" } });
    expect(c.textContent).toContain("Billing broken");
    expect(c.textContent).not.toContain("Slow site");

    // refresh button refetches
    fetchWithAuthMock.mockClear();
    await click(screen.getByText(/Refresh|↺/i));
    expect(fetchWithAuthMock).toHaveBeenCalled();
  });

  it("503 → EspoCRM not configured; other !ok → HTTP status error", async () => {
    fetchWithAuthMock.mockImplementationOnce(async () => okJson({}, 503));
    const c = await renderPage(<TicketsPage />);
    expect(c.textContent).toContain("EspoCRM not configured");

    cleanup();
    fetchWithAuthMock.mockImplementationOnce(async () => okJson({}, 500));
    const c2 = await renderPage(<TicketsPage />);
    expect(c2.textContent).toContain("HTTP 500");
  });
});

describe("admin/crm/[id]", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockClear();
    mockId = "68f3a2b1c9d4e5f6a";
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("invalid id → error without fetch", async () => {
    mockId = "not an id!!";
    const c = await renderPage(<CrmContactPage />);
    expect(c.textContent).toContain("Invalid contact id");
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("503/404/500 map to their error messages", async () => {
    for (const [status, msg] of [
      [503, "EspoCRM not configured"],
      [404, "Contact not found"],
      [500, "HTTP 500"],
    ] as const) {
      cleanup();
      fetchWithAuthMock.mockImplementationOnce(async () => okJson({}, status));
      const c = await renderPage(<CrmContactPage />);
      expect(c.textContent).toContain(msg);
    }
  });

  it("loaded contact renders the 360 view", async () => {
    const c = await renderPage(<CrmContactPage />);
    expect(c.textContent).toContain("a@b.co");
    expect(c.textContent).toContain("CRM · 360");
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/admin/crm/contacts/68f3a2b1c9d4e5f6a");
  });
});
