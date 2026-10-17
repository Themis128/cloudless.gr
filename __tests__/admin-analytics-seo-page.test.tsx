/**
 * SEO deep-dive admin page: 503 → not-configured, failed snapshot → error,
 * optional sections skipped when their endpoints fail, missing-field
 * fallbacks in every table, and CTR fraction-vs-percent formatting.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let routes: Record<string, unknown> = {};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchWithAuthMock = vi.fn(async (url: string) => {
  const r = routes[url];
  if (r instanceof Error) throw r;
  if (r === "REJECT_STRING") throw "boom";
  if (r instanceof Response) return r;
  if (r === undefined) return json({}, 404);
  return json(r);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (url: string) => fetchWithAuthMock(url),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SeoAnalyticsPage from "@/app/[locale]/admin/analytics/seo/page";

const SEO = "/api/admin/analytics/seo";
const INTENT = "/api/admin/analytics/search-intent";
const ARCHIVE = "/api/admin/analytics/gsc-archive?limit=26";
const PAGES = "/api/admin/analytics/pages?limit=25&days=28";
const COUNTRIES = "/api/admin/analytics/countries?days=28";
const DEVICES = "/api/admin/analytics/devices?days=28";

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<SeoAnalyticsPage />).container;
  });
  await act(async () => {});
  return c!;
}

/** Text of each body row of the table under the given section heading. */
function tableRows(heading: string): string[][] {
  const h2 = screen.getByText(
    (_, el) => el?.tagName === "H2" && el.textContent!.startsWith(heading)
  );
  const table = h2.parentElement!.querySelector("table")!;
  return Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => td.textContent ?? "")
  );
}

describe("admin SEO deep-dive page", () => {
  beforeEach(() => {
    routes = {};
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => cleanup());

  it("503 from the snapshot endpoint shows the not-configured notice", async () => {
    routes[SEO] = json({ error: "nc" }, 503);
    const c = await renderPage();
    expect(c.textContent).toContain("Google Search Console is not configured");
    expect(c.textContent).not.toContain("SEO Deep Dive");
    expect(screen.getByText("← Analytics").getAttribute("href")).toBe("/admin/analytics");
  });

  it("non-ok snapshot → error banner and no sections", async () => {
    routes[SEO] = json({}, 500);
    const c = await renderPage();
    expect(c.textContent).toContain("Failed to load SEO snapshot");
    expect(c.textContent).not.toContain("TOP KEYWORDS");
    expect(c.textContent).not.toContain("Loading...");
  });

  it("non-Error rejection → generic 'Failed to load'", async () => {
    routes[SEO] = "REJECT_STRING";
    const c = await renderPage();
    expect(c.textContent).toContain("Failed to load");
    expect(c.textContent).not.toContain("TOP KEYWORDS");
  });

  it("snapshot only: missing snapshot/keywords, failed optional endpoints → empty states", async () => {
    routes[SEO] = {};
    routes[INTENT] = json({}, 500);
    routes[ARCHIVE] = json({}, 500);
    routes[PAGES] = json({}, 500);
    routes[COUNTRIES] = json({}, 500);
    routes[DEVICES] = json({}, 500);
    const c = await renderPage();
    expect(c.textContent).not.toContain("Organic Clicks");
    expect(c.textContent).not.toContain("SEARCH INTENT");
    expect(c.textContent).not.toContain("WEEKLY ARCHIVE");
    expect(c.textContent).toContain("No keyword data.");
    expect(c.textContent).toContain("No page gold yet");
    expect(c.textContent).toContain("No country gold yet");
    expect(c.textContent).toContain("No device gold yet");
  });

  it("ok optional endpoints without their list fields also fall back to empty", async () => {
    routes[SEO] = { snapshot: null, keywords: [] };
    routes[INTENT] = {};
    routes[ARCHIVE] = {};
    routes[PAGES] = {};
    routes[COUNTRIES] = {};
    routes[DEVICES] = {};
    const c = await renderPage();
    expect(c.textContent).not.toContain("SEARCH INTENT");
    expect(c.textContent).not.toContain("WEEKLY ARCHIVE");
    expect(c.textContent).toContain("No page gold yet");
    expect(c.textContent).toContain("No device gold yet");
  });

  it("populated: metrics, intent buckets, tables with fallbacks and CTR scaling", async () => {
    routes[SEO] = {
      snapshot: {
        clicks: 1234,
        impressions: 56789,
        ctr: 2.2,
        avgPosition: 7.25,
        organicKeywords: 42,
      },
      keywords: [
        { keyword: "cloud audit", clicks: 10, impressions: 100, ctr: 10, position: 3 },
        { keyword: "sparse kw" },
      ],
    };
    routes[INTENT] = {
      intent: {
        brand: [{ keyword: "cloudless", clicks: 9 }],
        product: [],
        informational: [
          { keyword: "i1", clicks: 1 },
          { keyword: "i2", clicks: 1 },
          { keyword: "i3", clicks: 1 },
          { keyword: "i4", clicks: 1 },
          { keyword: "i5", clicks: 1 },
          { keyword: "i6", clicks: 1 },
        ],
        navigational: [],
      },
    };
    routes[ARCHIVE] = {
      reports: [
        {
          id: "w1",
          week: "2026-W40",
          clicks: 500,
          impressions: 9000,
          ctrPct: 5,
          avgPosition: 8,
          keywords: 120,
          mobilePct: 60,
          topCountry: "GR",
          ctrOpportunities: 4,
        },
        { id: "w2", week: "2026-W39", topCountry: "" },
      ],
    };
    // fraction CTR (≤ 1) is scaled to %, already-percent CTR (> 1) is kept
    routes[PAGES] = {
      pages: [
        { page: "/services", clicks: 1000, impressions: 8000, ctr: 0.125, position: 2.5 },
        { clicks: 1, impressions: 2, ctr: 12, avgPosition: 4 },
        {},
      ],
    };
    routes[COUNTRIES] = {
      countries: [
        { country: "grc", clicks: 5, impressions: 50, ctr: 0.1, avgPosition: 3 },
        { ctr: 25, position: 9 },
        {},
      ],
    };
    routes[DEVICES] = {
      devices: [
        { device: "MOBILE", clicks: 7, impressions: 70, ctr: 0.5, avgPosition: 1.5 },
        { ctr: 3, position: 6 },
        {},
      ],
    };

    const c = await renderPage();
    for (const v of ["1,234", "56,789", "2.2%", "7.3", "42"]) expect(c.textContent).toContain(v);

    // intent: counts, max 5 listed, empty bucket copy
    expect(c.textContent).toContain("cloudless(9)");
    expect(c.textContent).toContain("i5");
    expect(c.textContent).not.toContain("i6");
    expect(screen.getAllByText("No keywords.")).toHaveLength(2);

    expect(tableRows("TOP KEYWORDS")).toEqual([
      ["cloud audit", "10", "100", "10%", "3.0"],
      ["sparse kw", "0", "0", "0%", "0.0"],
    ]);
    expect(tableRows("TOP PAGES")).toEqual([
      ["/services", "1,000", "8,000", "12.5%", "2.5"],
      ["—", "1", "2", "12.0%", "4.0"],
      ["—", "0", "0", "0.0%", "0.0"],
    ]);
    expect(tableRows("COUNTRIES")).toEqual([
      ["grc", "5", "50", "10.0%", "3.0"],
      ["—", "0", "0", "25.0%", "9.0"],
      ["—", "0", "0", "0.0%", "0.0"],
    ]);
    expect(tableRows("DEVICES")).toEqual([
      ["MOBILE", "7", "70", "50.0%", "1.5"],
      ["—", "0", "0", "3.0%", "6.0"],
      ["—", "0", "0", "0.0%", "0.0"],
    ]);
    expect(tableRows("WEEKLY ARCHIVE")).toEqual([
      ["2026-W40", "500", "9,000", "5%", "8.0", "120", "60%", "GR", "4"],
      ["2026-W39", "0", "0", "0%", "0.0", "0", "0%", "—", "0"],
    ]);
  });
});
