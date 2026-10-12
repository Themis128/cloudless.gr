/**
 * Populated-interaction tests for the unified admin analytics page —
 * channel ROI rows, ROI notes, refresh, Stripe daily-trend mapping,
 * pipeline stage rows, and load-error handling.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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
}));

vi.mock("@/components/admin/AdminDailyBars", () => ({
  AdminDailyBars: ({
    title,
    points,
  }: {
    title: string;
    points: { day: string; value: number }[];
  }) => (
    <div data-testid="daily-bars" data-points={JSON.stringify(points)}>
      {title}
    </div>
  ),
}));

vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import UnifiedAnalyticsPage from "@/app/[locale]/admin/analytics/unified/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const UNIFIED = {
  seo: { clicks: 120, impressions: 4200, ctr: 2.9, avgPosition: 8.4 },
  pipeline: {
    totalDeals: 7,
    totalValue: 18400,
    byStage: {
      Qualification: { count: 3, value: 8000 },
      Proposal: { count: 4, value: 10400 },
    },
  },
  email: { totalContacts: 950, totalCampaigns: 12, avgOpenRate: 41.2 },
  stripe: {
    totalOrders: 31,
    revenue: 9650,
    activeSubscriptions: 9,
    mrr: 1230,
    dailyTrend: [
      { day: "2026-10-01", revenueMinor: 12000, events: 4, processed: 4, failed: 0 },
      { day: "2026-10-02", revenueMinor: 3000, events: 1, processed: 1, failed: 0 },
    ],
    dailyTrendSource: "d1",
  },
  fetchedAt: "2026-10-08T12:00:00Z",
};

const ROI = {
  windowDays: 30,
  channels: [
    {
      channel: "linkedin",
      configured: true,
      inGold: true,
      status: "ok",
      spendCents: 10000,
      impressions: 2400,
      clicks: 96,
      platformLeads: 5,
    },
    {
      channel: "weirdnet",
      configured: false,
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      platformLeads: 0,
      reason: "not configured",
    },
  ],
  notes: ["LinkedIn campaign uses promotional credit", "Meta pixel not linked"],
  totals: {
    spendCents: 10000,
    impressions: 2400,
    clicks: 96,
    platformLeads: 5,
    newLeads: 4,
    revenueCents: 965000,
    costPerLeadCents: 2500,
    roas: 9.6,
  },
};

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<UnifiedAnalyticsPage />).container;
  });
  return c!;
}

describe("admin analytics/unified — populated", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders ROI channel rows, notes, funnel steps, trend chart, and stage rows", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(okJson(url.includes("/roi") ? ROI : UNIFIED))
    );
    const c = await renderPage();

    // ROI channel rows — known label + unknown passthrough
    expect(c.textContent).toContain("LinkedIn");
    expect(c.textContent).toContain("weirdnet");
    // ROI notes
    expect(c.textContent).toContain("LinkedIn campaign uses promotional credit");
    // funnel + KPI sections
    expect(c.textContent).toContain("Open Deals");
    expect(c.textContent).toContain("Pipeline Value");
    expect(c.textContent).toContain("Revenue");
    // pipeline stage rows
    expect(c.textContent).toContain("Qualification");
    expect(c.textContent).toContain("Proposal");
    // daily trend mapped to AdminDailyBars points (revenueMinor / 100)
    const bars = c.querySelector('[data-testid="daily-bars"]');
    expect(bars).not.toBeNull();
    const points = JSON.parse(bars!.getAttribute("data-points")!);
    expect(points).toEqual([
      { day: "2026-10-01", value: 120 },
      { day: "2026-10-02", value: 30 },
    ]);
  });

  it("refresh button refetches both endpoints", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(okJson(url.includes("/roi") ? ROI : UNIFIED))
    );
    const c = await renderPage();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockClear();

    const btn = [...c.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Refresh")
    )!;
    await act(async () => fireEvent.click(btn));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/api/admin/analytics/unified"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/admin/analytics/roi"))).toBe(true);
  });

  it("shows the thrown message when the unified fetch fails", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/roi")
        ? Promise.resolve(okJson(ROI))
        : Promise.resolve(new Response("oops", { status: 500 }))
    );
    const c = await renderPage();
    expect(c.textContent).toContain("HTTP 500");
  });

  it("surfaces a rejected fetch as the error text", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/roi")
        ? Promise.resolve(okJson(ROI))
        : Promise.reject(new Error("analytics api down"))
    );
    const c = await renderPage();
    expect(screen.getByText("analytics api down")).toBeTruthy();
  });

  it("renders EmptyState placeholders for unconfigured sections", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        okJson(
          url.includes("/roi")
            ? { ...ROI, channels: [], notes: [] }
            : { seo: null, pipeline: null, email: null, stripe: null, fetchedAt: "x" }
        )
      )
    );
    const c = await renderPage();
    expect(c.textContent).toContain("Google Search Console not configured");
    expect(c.textContent).toContain("EspoCRM pipeline not configured");
    expect(c.textContent).toContain("EspoCRM email not configured");
    expect(c.textContent).toContain("Stripe not configured");
  });
});
