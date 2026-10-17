/**
 * Branch tests for the SEO & Analytics admin page, complementing
 * admin-analytics-page.test.tsx: null-heavy rows in every table, the colour
 * thresholds for position and CTR, flat or all-null sparklines, payloads with
 * missing keys, a failed web request, non-Error rejections, and a stored day
 * count that matches no preset.
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
const fetchWithAuthMock = vi.fn(async (url: string) => {
  const out = routes[String(url)];
  if (typeof out === "function") return out();
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (url: string) => fetchWithAuthMock(url),
}));
vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

import AdminAnalyticsPage from "@/app/[locale]/admin/analytics/page";

const Q = {
  seo: "/api/admin/analytics/seo?days=28",
  web: "/api/admin/analytics/web?days=28",
  keywords: "/api/admin/analytics/keywords?limit=50&days=28",
  pages: "/api/admin/analytics/pages?limit=25&days=28",
  history: "/api/admin/analytics/history?weeks=8",
  ctr: "/api/admin/analytics/ctr-opportunities?limit=40&days=28",
};

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminAnalyticsPage />).container;
  });
  return c!;
}
const openTab = async (label: string) => {
  await act(async () => fireEvent.click(screen.getByText(label)));
};
const rows = (c: HTMLElement) => Array.from(c.querySelectorAll("tbody tr"));
const cells = (tr: Element) => Array.from(tr.querySelectorAll("td"));

describe("admin analytics — branch coverage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routes = {
      [Q.seo]: { snapshot: { clicks: 1, impressions: 2, ctr: 1, avgPosition: 3 } },
      [Q.web]: { analytics: { clicks: 1, impressions: 2, ctr: 1, position: 1 } },
    };
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("overview tolerates missing snapshot/analytics keys and a failed web call", async () => {
    routes[Q.seo] = {};
    routes[Q.web] = okJson({}, 503);
    const c = await renderPage();
    expect(c.textContent).not.toContain("Failed to load GSC overview");
    expect(c.textContent).not.toContain("Organic search summary");
    expect(screen.getByText("Total Clicks").parentElement!.textContent).toContain("—");
    expect(screen.getByText("Avg Position").parentElement!.textContent).toContain("—");

    cleanup();
    routes[Q.web] = {};
    const c2 = await renderPage();
    expect(c2.textContent).not.toContain("Organic search summary");
  });

  it("position and CTR colour thresholds across the pages table, with null cells", async () => {
    routes[Q.pages] = {
      pages: [
        { page: "/a", clicks: 1, impressions: 1, ctr: 12, position: 2 },
        { page: "/b", clicks: 1, impressions: 1, ctr: 6, position: 7 },
        { page: "/c", clicks: 1, impressions: 1, ctr: 3, position: 15 },
        { page: "/d", clicks: 1, impressions: 1, ctr: 1, position: 40 },
        { page: "/e", clicks: null, impressions: null, ctr: null, position: null },
      ],
    };
    const c = await renderPage();
    await openTab("Top Pages");
    const r = rows(c);
    expect(r).toHaveLength(5);
    const ctrCls = r.map((tr) => cells(tr)[4].className);
    const posCls = r.map((tr) => cells(tr)[5].className);
    expect(ctrCls[0]).toContain("text-neon-green");
    expect(ctrCls[1]).toContain("text-neon-cyan");
    expect(ctrCls[2]).toContain("text-yellow-400");
    expect(ctrCls[3]).toContain("text-slate-500");
    expect(ctrCls[4]).toContain("text-slate-500");
    expect(posCls[0]).toContain("text-neon-green");
    expect(posCls[1]).toContain("text-neon-cyan");
    expect(posCls[2]).toContain("text-yellow-400");
    expect(posCls[3]).toContain("text-slate-400");
    expect(posCls[4]).toContain("text-slate-400");
    expect(
      cells(r[4])
        .map((td) => td.textContent)
        .slice(2)
    ).toEqual(["0", "0", "—", "#—"]);
  });

  it("history with all-null clicks and flat impressions still draws both sparklines", async () => {
    routes[Q.history] = {
      history: [
        { date: "2026-01-05", clicks: null, impressions: 500, ctr: null, position: null },
        { date: "2026-01-12", clicks: null, impressions: 500, ctr: 4, position: 5 },
      ],
    };
    const c = await renderPage();
    await openTab("History");
    const lines = Array.from(c.querySelectorAll("polyline"));
    expect(lines).toHaveLength(2);
    // all-zero clicks → flat line on the baseline; flat impressions → same
    expect(lines[0].getAttribute("points")).toBe("0.0,48.0 240.0,48.0");
    expect(lines[1].getAttribute("points")).toBe("0.0,48.0 240.0,48.0");
    expect(screen.getByText("Clicks (16 weeks)").nextElementSibling!.textContent).toBe("0");
    expect(screen.getByText("Impressions (16 weeks)").nextElementSibling!.textContent).toBe(
      (1000).toLocaleString()
    );
    // newest week first, so the all-null first week is the last row
    const r = rows(c);
    expect(
      cells(r[1])
        .map((td) => td.textContent)
        .slice(1)
    ).toEqual(["0", "500", "—", "—"]);
  });

  it("history with null impressions totals and lists them as zero", async () => {
    routes[Q.history] = {
      history: [
        { date: "2026-01-05", clicks: 3, impressions: null, ctr: 1, position: 2 },
        { date: "2026-01-12", clicks: 3, impressions: null, ctr: 1, position: 2 },
      ],
    };
    const c = await renderPage();
    await openTab("History");
    expect(screen.getByText("Clicks (16 weeks)").nextElementSibling!.textContent).toBe("6");
    expect(screen.getByText("Impressions (16 weeks)").nextElementSibling!.textContent).toBe("0");
    expect(rows(c).map((tr) => cells(tr)[2].textContent)).toEqual(["0", "0"]);
  });

  it("CTR opportunities with null fields fall back to dashes and zeros", async () => {
    routes[Q.ctr] = {
      opportunities: [
        {
          keyword: "sparse",
          position: null,
          impressions: null,
          ctr: null,
          clicks: null,
          potentialClicks: null,
        },
      ],
    };
    const c = await renderPage();
    await openTab("CTR Opportunities");
    const tds = cells(rows(c)[0]).map((td) => td.textContent);
    expect(tds).toEqual(["sparse", "#—", "0", "—", "0", "+0 clicks"]);
  });

  it.each([
    ["Keywords", "No keyword data available"],
    ["Top Pages", "No page data yet"],
    ["History", "No history data available yet"],
    ["CTR Opportunities", "No CTR opportunities found"],
  ])("%s tab treats a payload without its list key as empty", async (tab, empty) => {
    routes[Q.keywords] = {};
    routes[Q.pages] = {};
    routes[Q.history] = {};
    routes[Q.ctr] = {};
    const c = await renderPage();
    await openTab(tab);
    expect(c.textContent).toContain(empty);
  });

  it("a non-Error rejection shows the per-tab fallback message", async () => {
    routes[Q.keywords] = () => Promise.reject("socket closed");
    const c = await renderPage();
    await openTab("Keywords");
    expect(c.textContent).toContain("Failed to load keywords");
  });

  it("a stored day count outside the presets is used but labelled with the default preset", async () => {
    window.localStorage.setItem("admin:analytics:days", "45");
    await renderPage();
    const urls = fetchWithAuthMock.mock.calls.map(([u]) => String(u));
    expect(urls).toContain("/api/admin/analytics/seo?days=45");
    expect(screen.getByLabelText("Clear Last 28 days filter")).toBeTruthy();
  });
});
