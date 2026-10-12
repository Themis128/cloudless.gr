/**
 * Populated tests for the customer dashboard pages — main dashboard stats,
 * purchases (orders/subscriptions tabs), consultations (upcoming/past).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useAuth } from "@/context/AuthContext";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", () => {}] }));
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: vi.fn() }));

import DashboardPage from "@/app/[locale]/dashboard/page";
import PurchasesPage from "@/app/[locale]/dashboard/purchases/page";
import ConsultationsPage from "@/app/[locale]/dashboard/consultations/page";

const fetchMock = vi.mocked(fetchWithAuth);
const useAuthMock = vi.mocked(useAuth);
const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const flush = () => act(async () => { await Promise.resolve(); });

const user = { email: "u@x.dev", name: "Pat", preferences: {} };

describe("dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user, isLoading: false } as never);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("purchases"))
        return okJson({
          purchases: [
            { status: "paid", amount: 1200 },
            { status: "complete", amount: 300 },
            { status: "unpaid", amount: 50 },
          ],
          subscriptions: [{ status: "active" }, { status: "canceled" }],
        });
      if (url.includes("consultations"))
        return okJson({
          consultations: [{ status: "upcoming" }, { status: "past" }],
        });
      return okJson({});
    });
  });
  afterEach(() => cleanup());

  it("renders greeting, user name, and computed stat cards", async () => {
    const { container } = render(<DashboardPage />);
    await flush();
    expect(container.textContent).toContain("Pat");
    expect(container.textContent).toContain("3 orders — €1500.00 spent");
    expect(container.textContent).toContain("1 upcoming session");
    expect(container.textContent).toContain("Profile");
    expect(container.textContent).toContain("Settings");
  });

  it("stops loading with no fetch when user is absent", async () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false } as never);
    const { container } = render(<DashboardPage />);
    await flush();
    expect(container.textContent).not.toContain("Loading…");
    expect(container.textContent).toContain("No purchases yet");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("dashboard purchases page", () => {
  const purchase = {
    id: "ord_1",
    status: "paid",
    amount: 4900,
    currency: "eur",
    items: [{ name: "Starter Kit", quantity: 1, amount: 4900 }],
    date: "2026-01-10",
  };
  const subscription = {
    id: "sub_1",
    status: "active",
    currentPeriodEnd: "2026-02-01",
    items: [{ name: "Pro plan", amount: 2900, currency: "eur" }],
    cancelAtPeriodEnd: true,
    created: "2025-12-01",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user, isLoading: false } as never);
    fetchMock.mockResolvedValue(okJson({ purchases: [purchase], subscriptions: [subscription] }));
  });
  afterEach(() => cleanup());

  it("renders orders tab with purchase rows and counts", async () => {
    const { container } = render(<PurchasesPage />);
    await flush();
    expect(container.textContent).toContain("Starter Kit");
    expect(container.textContent).toContain("Subscriptions (1)");
    expect(screen.getByRole("button", { name: /Orders/ })).toBeTruthy();
  });

  it("switches to subscriptions tab and shows cancel note", async () => {
    const { container } = render(<PurchasesPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Subscriptions \(1\)/ }));
    expect(container.textContent).toContain("Pro plan");
    expect(container.textContent).toContain("Cancels at period end");
  });

  it("renders 503 not-configured and HTTP error states", async () => {
    fetchMock.mockResolvedValue(okJson({}, 503));
    const { container } = render(<PurchasesPage />);
    await flush();
    expect(container.textContent).toContain("Stripe not configured");
    fetchMock.mockResolvedValue(okJson({}, 500));
    cleanup();
    const { container: c2 } = render(<PurchasesPage />);
    await flush();
    expect(c2.textContent).toContain("HTTP 500");
  });
});

describe("dashboard consultations page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user, isLoading: false } as never);
    fetchMock.mockResolvedValue(
      okJson({
        consultations: [
          {
            id: "c1",
            status: "upcoming",
            start: "2026-02-01T10:00:00Z",
            end: "2026-02-01T10:30:00Z",
            meetLink: "https://meet.google.com/abc",
            title: "Cloud audit",
          },
          {
            id: "c2",
            status: "past",
            start: "2025-11-01T10:00:00Z",
            end: "2025-11-01T10:30:00Z",
            title: "Old call",
          },
        ],
      })
    );
  });
  afterEach(() => cleanup());

  it("renders upcoming tab with meet link and counts", async () => {
    const { container } = render(<ConsultationsPage />);
    await flush();
    expect(container.textContent).toContain("Cloud audit");
    const join = screen.getAllByRole("link").find((a) => a.textContent?.includes("Join Meet"));
    expect(join?.getAttribute("href")).toBe("https://meet.google.com/abc");
    expect(container.textContent).not.toContain("Old call");
  });

  it("switches to past tab and back", async () => {
    const { container } = render(<ConsultationsPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Past \(1\)/ }));
    expect(container.textContent).toContain("Old call");
    expect(container.textContent).not.toContain("Cloud audit");
    fireEvent.click(screen.getByRole("button", { name: /Upcoming \(1\)/ }));
    expect(container.textContent).toContain("Cloud audit");
  });

  it("shows empty state on non-OK response and unconfigured notice when configured=false", async () => {
    fetchMock.mockResolvedValue(okJson({}, 500));
    const { container } = render(<ConsultationsPage />);
    await flush();
    expect(container.textContent).toContain("No upcoming consultations");
    fetchMock.mockResolvedValue(okJson({ consultations: [], configured: false }));
    cleanup();
    const { container: c2 } = render(<ConsultationsPage />);
    await flush();
    expect(c2.textContent).toMatch(/not configured|configured/i);
  });
});
