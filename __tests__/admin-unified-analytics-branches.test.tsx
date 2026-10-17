/**
 * Branch tails for the unified admin analytics page: missing ROI, channel
 * status labels, partially configured funnel, nullable Stripe/SEO/email
 * metrics, non-Error failures, and results arriving after unmount.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
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

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Text of the funnel step whose label is `label` (value + sub line). */
function funnelStep(c: HTMLElement, label: string): string[] {
  const funnel = c.querySelector(".min-w-32")!.parentElement!;
  const step = [...funnel.children].find((el) => el.querySelector("p")?.textContent === label)!;
  return [...step.querySelectorAll("p")].map((p) => p.textContent ?? "");
}

function kpi(c: HTMLElement, label: string): string | undefined {
  const card = [...c.querySelectorAll("div.rounded-xl")].find(
    (el) => el.children[1]?.textContent === label
  );
  return card?.children[0]?.textContent ?? undefined;
}

describe("admin analytics/unified — branch tails", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("shows the ROI empty state when the ROI endpoint fails", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/roi") ? new Response("nope", { status: 503 }) : okJson(UNIFIED)
      )
    );
    const c = await renderPage();
    expect(c.textContent).toContain("ROI not configured");
    expect(c.textContent).toContain("Total Revenue");
    expect(c.textContent).not.toContain("HTTP 503");
  });

  it("labels unconfigured channels by gold status", async () => {
    const base = { configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 };
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        okJson(
          url.includes("/roi")
            ? {
                ...ROI,
                notes: undefined,
                channels: [
                  { ...base, channel: "google", status: "not_in_gold" },
                  { ...base, channel: "tiktok", status: "empty_gold" },
                  { ...base, channel: "x", status: "unknown" },
                ],
              }
            : UNIFIED
        )
      )
    );
    const c = await renderPage();
    const statusOf = (label: string) =>
      screen.getByText(label).closest("tr")!.children[1].textContent;
    expect(statusOf("Google Ads")).toBe("not in gold");
    expect(statusOf("TikTok")).toBe("empty gold");
    expect(statusOf("X")).toBe("—");
    expect(screen.getByText("Google Ads").closest("tr")!.children[2].textContent).toBe("—");
    expect(c.querySelector("ul")).toBeNull();
  });

  it("funnel with only Stripe: SEO and pipeline steps show dashes", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        okJson(
          url.includes("/roi")
            ? ROI
            : {
                ...UNIFIED,
                seo: null,
                pipeline: null,
                email: null,
                stripe: {
                  totalOrders: 2,
                  revenue: 50,
                  activeSubscriptions: null,
                  mrr: null,
                },
              }
        )
      )
    );
    const c = await renderPage();
    expect(funnelStep(c, "Impressions")).toEqual(["Impressions", "—", "GSC (28d)"]);
    expect(funnelStep(c, "Clicks")).toEqual(["Clicks", "—", "CTR —"]);
    expect(funnelStep(c, "Open Deals")).toEqual(["Open Deals", "—", "EspoCRM pipeline"]);
    expect(funnelStep(c, "Pipeline Value")[1]).toBe("—");
    expect(funnelStep(c, "Revenue")).toEqual(["Revenue", "€50", "2 orders"]);
    expect(kpi(c, "Active Subscriptions")).toBe("—");
    expect(kpi(c, "MRR")).toBe("—");
    const bars = c.querySelector('[data-testid="daily-bars"]')!;
    expect(JSON.parse(bars.getAttribute("data-points")!)).toEqual([]);
  });

  it("funnel without Stripe shows revenue dashes; missing avgPosition reads 0.0; click rate shown", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        okJson(
          url.includes("/roi")
            ? ROI
            : {
                ...UNIFIED,
                stripe: null,
                seo: { clicks: 10, impressions: 100, ctr: 10 },
                email: { totalContacts: 5, totalCampaigns: 1, avgClickRate: 3.25 },
              }
        )
      )
    );
    const c = await renderPage();
    expect(funnelStep(c, "Revenue")).toEqual(["Revenue", "—", "— orders"]);
    expect(funnelStep(c, "Clicks")).toEqual(["Clicks", "10", "CTR 10.0%"]);
    expect(kpi(c, "Avg Position")).toBe("0.0");
    expect(kpi(c, "Avg Click Rate")).toBe("3.3%");
    expect(kpi(c, "Avg Open Rate")).toBeUndefined();
  });

  it("a non-Error rejection shows the generic failure message", async () => {
    fetchMock.mockImplementation(() => Promise.reject("offline"));
    const c = await renderPage();
    expect(c.textContent).toContain("Failed to load");
  });

  it("ignores results that arrive after unmount", async () => {
    const unified = deferred<Response>();
    const roiRes = okJson(ROI);
    const roiJson = vi.spyOn(roiRes, "json");
    fetchMock.mockImplementation((url: string) =>
      url.includes("/roi") ? Promise.resolve(roiRes) : unified.promise
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<UnifiedAnalyticsPage />);
    view.unmount();
    await act(async () => {
      unified.resolve(okJson(UNIFIED));
      await unified.promise;
      await new Promise((r) => setTimeout(r, 0));
    });
    // The load runs to completion (the ROI body is still read) but no state
    // update is attempted on the unmounted component.
    expect(roiJson).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("ignores a failure that arrives after unmount", async () => {
    const unified = deferred<Response>();
    fetchMock.mockImplementation((url: string) =>
      url.includes("/roi") ? Promise.resolve(okJson(ROI)) : unified.promise
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<UnifiedAnalyticsPage />);
    view.unmount();
    await act(async () => {
      unified.reject(new Error("late"));
      await unified.promise.catch(() => {});
    });
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
