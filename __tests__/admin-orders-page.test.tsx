/**
 * Populated tests for the admin orders page — orders/subscriptions tables,
 * tab switching, status badges, empty states, and load errors.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import AdminOrdersPage from "@/app/[locale]/admin/orders/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const PAYLOAD = {
  orders: [
    {
      id: "cs_test_a1b2c3d4e5f6g7h8i9",
      email: "buyer@example.com",
      amount: 149.0,
      currency: "EUR",
      status: "paid",
      mode: "payment",
      items: [{ description: "Pro plan — annual", quantity: 1, amount: 14900 }],
      created: "2026-10-01T10:00:00Z",
    },
    {
      id: "cs_test_unknown_status_here",
      email: "odd@example.com",
      amount: 5.5,
      currency: "EUR",
      status: "weird_status",
      mode: "payment",
      items: [],
      created: "2026-10-02T10:00:00Z",
    },
  ],
  subscriptions: [
    {
      id: "sub_1QwErTyUiOpAsDfGhJ",
      status: "active",
      plan: "analytics",
      amount: 29.0,
      currency: "EUR",
      interval: "month",
      currentPeriodEnd: "2026-11-01T00:00:00Z",
      cancelAtPeriodEnd: true,
      created: "2026-10-01T00:00:00Z",
    },
    {
      id: "sub_pastdue0000000000000",
      status: "past_due",
      plan: "starter",
      amount: 9.0,
      currency: "EUR",
      interval: "month",
      currentPeriodEnd: "2026-10-20T00:00:00Z",
      cancelAtPeriodEnd: false,
      created: "2026-09-20T00:00:00Z",
    },
  ],
};

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminOrdersPage />).container;
  });
  return c!;
}

describe("admin orders — populated", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders order rows, revenue total, and status badges", async () => {
    fetchMock.mockResolvedValue(okJson(PAYLOAD));
    const c = await renderPage();
    expect(c.textContent).toContain("buyer@example.com");
    expect(c.textContent).toContain("Pro plan — annual");
    expect(c.textContent).toContain("EUR 149.00");
    expect(c.textContent).toContain("paid");
    expect(c.textContent).toContain("weird_status");
    // summary cards: 2 orders, €154.50, 1 active sub
    expect(c.textContent).toContain("€154.50");
    expect(c.textContent).toContain("Orders (2)");
  });

  it("subscriptions tab lists plans with cancel-at-period-end badge", async () => {
    fetchMock.mockResolvedValue(okJson(PAYLOAD));
    const c = await renderPage();
    const subTab = [...c.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Subscriptions")
    )!;
    await act(async () => fireEvent.click(subTab));
    expect(c.textContent).toContain("analytics");
    expect(c.textContent).toContain("EUR 29.00/month");
    expect(c.textContent).toContain("active (canceling)");
    expect(c.textContent).toContain("past_due");
  });

  it("renders empty-table states for both tabs", async () => {
    fetchMock.mockResolvedValue(okJson({ orders: [], subscriptions: [] }));
    const c = await renderPage();
    expect(c.textContent).toContain("No orders yet");
    const subTab = [...c.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Subscriptions")
    )!;
    await act(async () => fireEvent.click(subTab));
    expect(c.textContent).toContain("No subscriptions yet");
  });

  it("shows the Stripe hint on fetch failure", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const c = await renderPage();
    expect(c.textContent).toContain("HTTP 500");
    expect(c.textContent).toContain("STRIPE_SECRET_KEY");
  });
});
