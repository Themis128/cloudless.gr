/**
 * Populated-state interaction tests for the SEO & Analytics admin page —
 * overview KPIs, keywords/pages/history/CTR tabs (lazy fetch per tab),
 * date-range presets with localStorage persistence, error states.
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
  const out = routes[String(url)];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

import AdminAnalyticsPage from "@/app/[locale]/admin/analytics/page";

const SNAPSHOT = { clicks: 1234, impressions: 56789, ctr: 2.17, avgPosition: 12.3 };
const WEB = { clicks: 900, impressions: 40000, ctr: 2.25, position: 11.1 };
const KEYWORDS = [
  { keyword: "cloud consulting", clicks: 100, impressions: 5000, ctr: 2.0, position: 8.5 },
  { keyword: "null fields", clicks: null, impressions: null, ctr: null, position: null },
];
const PAGES = [
  { page: "/services", clicks: 50, impressions: 2000, ctr: 12.5, position: 2.5 },
];
const HISTORY = [
  { date: "2026-01-05", clicks: 10, impressions: 400, ctr: 2.5, position: 9.1 },
  { date: "2026-01-12", clicks: 20, impressions: 600, ctr: 3.3, position: 7.4 },
];
const OPPS = [
  { keyword: "easy win", position: 15.2, impressions: 9000, ctr: 0.5, clicks: 45, potentialClicks: 300 },
];

function seedRoutes() {
  routes = {
    "/api/admin/analytics/seo?days=28": { snapshot: SNAPSHOT },
    "/api/admin/analytics/web?days=28": { analytics: WEB },
    "/api/admin/analytics/keywords?limit=50&days=28": { keywords: KEYWORDS },
    "/api/admin/analytics/pages?limit=25&days=28": { pages: PAGES },
    "/api/admin/analytics/history?weeks=8": { history: HISTORY },
    "/api/admin/analytics/ctr-opportunities?limit=40&days=28": { opportunities: OPPS },
    // 7d range (used after preset switch)
    "/api/admin/analytics/seo?days=7": { snapshot: SNAPSHOT },
    "/api/admin/analytics/web?days=7": { analytics: WEB },
  };
}

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminAnalyticsPage />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

describe("admin analytics — populated interactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedRoutes();
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("overview — snapshot + web KPIs, explore-deeper tab jump, seo failure", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("1,234"); // clicks
    expect(c.textContent).toContain("56,789"); // impressions
    expect(c.textContent).toContain("2.2%"); // ctr
    expect(c.textContent).toContain("12.3"); // position
    expect(c.textContent).toContain("Organic search summary");
    expect(c.textContent).toContain("900"); // web clicks

    // explore deeper → keywords tab (lazy fetch)
    await click(screen.getByText("Keywords →"));
    expect(c.textContent).toContain("cloud consulting");
    expect(c.textContent).toContain("#8.5");
    expect(c.textContent).toContain("#—"); // null position

    // seo fails → overview error
    routes["/api/admin/analytics/seo?days=28"] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage();
    expect(c2.textContent).toContain("Failed to load GSC overview");
    // error state replaces the whole tab
    expect(c2.textContent).toContain("Make sure GOOGLE_CLIENT_EMAIL");
  });

  it("keywords/pages/history/ctr tabs — populated + empty + error states", async () => {
    const c = await renderPage();

    await click(screen.getByText("Top Pages"));
    expect(c.textContent).toContain("/services");
    expect(c.textContent).toContain("#2.5");
    expect(c.textContent).toContain("12.5%");

    await click(screen.getByText("History"));
    expect(c.textContent).toContain("Clicks (16 weeks)");
    expect(c.textContent).toContain("Weekly Breakdown");
    expect(c.textContent).toContain("5 Jan"); // en-IE → day-first
    expect(c.querySelector("polyline")).toBeTruthy();

    await click(screen.getByText("CTR Opportunities"));
    expect(c.textContent).toContain("easy win");
    expect(c.textContent).toContain("+300 clicks");
    expect(c.textContent).toContain("1 CTR Opportunities");

    // empty states
    routes["/api/admin/analytics/keywords?limit=50&days=28"] = { keywords: [] };
    routes["/api/admin/analytics/pages?limit=25&days=28"] = { pages: [] };
    routes["/api/admin/analytics/history?weeks=8"] = { history: [] };
    routes["/api/admin/analytics/ctr-opportunities?limit=40&days=28"] = { opportunities: [] };
    cleanup();
    const c2 = await renderPage();
    for (const [tab, empty] of [
      ["Keywords", "No keyword data available"],
      ["Top Pages", "No page data yet"],
      ["History", "No history data available yet"],
      ["CTR Opportunities", "No CTR opportunities found"],
    ] as const) {
      await click(screen.getByText(tab));
      expect(c2.textContent).toContain(empty);
    }

    // error state
    routes["/api/admin/analytics/keywords?limit=50&days=28"] = okJson({}, 500);
    cleanup();
    const c3 = await renderPage();
    await click(screen.getByText("Keywords"));
    expect(c3.textContent).toContain("HTTP 500");
  });

  it("range presets — persisted days, refetch, reset chip", async () => {
    const c = await renderPage();
    // switch to 7d → refetches overview with days=7, shows active chip
    await click(screen.getByText("Last 7 days"));
    expect(window.localStorage.getItem("admin:analytics:days")).toBe("7");
    expect(c.textContent).toContain("Reset to default");
    const calls7 = fetchWithAuthMock.mock.calls.filter(([u]) =>
      String(u).includes("days=7")
    );
    expect(calls7.length).toBeGreaterThan(0);

    // reset → back to 28d
    await click(screen.getByText("Reset to default"));
    expect(window.localStorage.getItem("admin:analytics:days")).toBe("28");
    expect(c.textContent).not.toContain("Reset to default");

    // persisted value on mount (localStorage preseeded)
    window.localStorage.setItem("admin:analytics:days", "90");
    routes["/api/admin/analytics/seo?days=90"] = { snapshot: SNAPSHOT };
    routes["/api/admin/analytics/web?days=90"] = { analytics: WEB };
    cleanup();
    await renderPage();
    const calls90 = fetchWithAuthMock.mock.calls.filter(([u]) =>
      String(u).includes("days=90")
    );
    expect(calls90.length).toBeGreaterThan(0);
  });
});
