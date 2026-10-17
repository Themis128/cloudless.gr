/**
 * gsc.ts — sparse Search Console responses.
 *
 * The Search Analytics API omits fields instead of returning zeros (no
 * `rows` at all for an empty window, rows without `ctr`/`position` for
 * low-impression queries, etc.). Every public helper must turn those into
 * zeros / empty strings, never NaN or a thrown TypeError, because the admin
 * analytics pages render the numbers directly.
 *
 * Google auth + fetch are faked at the boundary; all mapping runs for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockToken } = vi.hoisted(() => ({ mockToken: vi.fn() }));
vi.mock("@/lib/google-auth", () => ({
  createGoogleAuth: vi.fn(() => mockToken),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getCtrOpportunities,
  getDeviceBreakdown,
  getPerformanceHistory,
  getProductPageMetrics,
  getQueryPageMapping,
  getSearchIntentBreakdown,
  getSeoSnapshot,
  getTopKeywords,
  getTopPages,
  getTrafficByCountry,
  getWebAnalytics,
} from "@/lib/gsc";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A row with no keys and no metrics — the sparsest thing GSC can send. */
const BARE_ROW = {};
const ZERO_METRICS = { clicks: 0, impressions: 0, ctr: 0 };

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string);
}

beforeEach(() => {
  mockFetch.mockReset();
  mockToken.mockReset();
  mockToken.mockResolvedValue("ya29.token");
});

describe("row-list helpers map bare rows to zeros", () => {
  it.each([
    ["getTopKeywords", () => getTopKeywords(), { keyword: "", ...ZERO_METRICS, position: 0 }],
    ["getTopPages", () => getTopPages(), { page: "", ...ZERO_METRICS, position: 0 }],
    [
      "getPerformanceHistory",
      () => getPerformanceHistory(),
      { date: "", ...ZERO_METRICS, avgPosition: 0 },
    ],
    [
      "getDeviceBreakdown",
      () => getDeviceBreakdown(),
      { device: "", ...ZERO_METRICS, avgPosition: 0 },
    ],
    [
      "getTrafficByCountry",
      () => getTrafficByCountry(),
      { country: "", ...ZERO_METRICS, avgPosition: 0 },
    ],
    [
      "getProductPageMetrics",
      () => getProductPageMetrics(),
      { page: "", ...ZERO_METRICS, position: 0 },
    ],
    [
      "getQueryPageMapping",
      () => getQueryPageMapping(),
      { query: "", page: "", ...ZERO_METRICS, position: 0 },
    ],
  ] as const)("%s", async (_name, call, expected) => {
    mockFetch.mockResolvedValueOnce(json({ rows: [BARE_ROW] }));
    expect(await call()).toEqual([expected]);
  });

  it.each([
    ["getTopKeywords", () => getTopKeywords()],
    ["getTopPages", () => getTopPages()],
    ["getPerformanceHistory", () => getPerformanceHistory()],
    ["getDeviceBreakdown", () => getDeviceBreakdown()],
    ["getTrafficByCountry", () => getTrafficByCountry()],
    ["getProductPageMetrics", () => getProductPageMetrics()],
    ["getQueryPageMapping", () => getQueryPageMapping()],
    ["getCtrOpportunities", () => getCtrOpportunities()],
  ] as const)("%s returns [] when the response has no rows", async (_name, call) => {
    mockFetch.mockResolvedValueOnce(json({}));
    expect(await call()).toEqual([]);
  });

  it("rounds and converts populated rows (CTR fraction → percent)", async () => {
    mockFetch.mockResolvedValueOnce(
      json({
        rows: [
          {
            keys: ["serverless hosting", "https://cloudless.gr/en/services"],
            clicks: 4.6,
            impressions: 120.2,
            ctr: 0.03456,
            position: 7.26,
          },
        ],
      })
    );
    expect(await getQueryPageMapping("sc-domain:cloudless.gr", 5)).toEqual([
      {
        query: "serverless hosting",
        page: "https://cloudless.gr/en/services",
        clicks: 5,
        impressions: 120,
        ctr: 3.46,
        position: 7.3,
      },
    ]);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain(encodeURIComponent("sc-domain:cloudless.gr"));
    expect(sentBody()).toMatchObject({ dimensions: ["query", "page"], rowLimit: 5 });
  });

  it("getProductPageMetrics filters on the requested URL pattern", async () => {
    mockFetch.mockResolvedValueOnce(json({ rows: [] }));
    await getProductPageMetrics(undefined, "/shop/", 10);
    expect(sentBody()).toMatchObject({
      rowLimit: 10,
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: "/shop/" }] },
      ],
    });
  });
});

describe("aggregate helpers with sparse responses", () => {
  it("getSeoSnapshot zeroes a totals response without rows and counts no keywords", async () => {
    mockFetch.mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({}));
    expect(await getSeoSnapshot()).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      avgPosition: 0,
      organicKeywords: 0,
    });
  });

  it("getSeoSnapshot still returns totals when the keyword-count query fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        json({ rows: [{ clicks: 10, impressions: 200, ctr: 0.05, position: 3.14 }] })
      )
      .mockResolvedValueOnce(new Response("quota", { status: 429 }));
    expect(await getSeoSnapshot()).toEqual({
      clicks: 10,
      impressions: 200,
      ctr: 5,
      avgPosition: 3.1,
      organicKeywords: 0,
    });
  });

  it("getWebAnalytics degrades each failed sub-query to zeros instead of failing", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));
    expect(await getWebAnalytics()).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      avgPosition: 0,
      topPages: [],
    });
  });

  it("getWebAnalytics maps bare page rows and a bare totals row", async () => {
    mockFetch
      .mockResolvedValueOnce(json({ rows: [BARE_ROW] }))
      .mockResolvedValueOnce(json({ rows: [BARE_ROW] }));
    expect(await getWebAnalytics()).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      avgPosition: 0,
      topPages: [{ page: "", clicks: 0, impressions: 0, position: 0 }],
    });
  });
});

describe("getCtrOpportunities", () => {
  it("skips rows missing metrics and ranks the rest by impressions", async () => {
    mockFetch.mockResolvedValueOnce(
      json({
        rows: [
          BARE_ROW, // position 0 / impressions 0 — never an opportunity
          { keys: ["no ctr"], position: 6, impressions: 50 }, // ctr missing → 0% → qualifies
          { keys: ["big"], position: 8, impressions: 400, clicks: 4, ctr: 0.01 },
          { keys: ["top3"], position: 2, impressions: 999, ctr: 0.01 }, // already top-3
          { keys: ["good ctr"], position: 9, impressions: 500, ctr: 0.2 }, // CTR already ≥5%
        ],
      })
    );
    const out = await getCtrOpportunities();
    expect(out.map((o) => o.keyword)).toEqual(["big", "no ctr"]);
    expect(out[0]).toEqual({
      keyword: "big",
      clicks: 4,
      impressions: 400,
      ctr: 1,
      position: 8,
      potentialClicks: 16, // 5% of 400 = 20, minus 4 existing clicks
    });
    expect(out[1]).toMatchObject({ clicks: 0, ctr: 0, potentialClicks: 3 });
  });

  it("keeps an opportunity without keys as an empty keyword", async () => {
    mockFetch.mockResolvedValueOnce(json({ rows: [{ position: 5, impressions: 40 }] }));
    expect((await getCtrOpportunities())[0]).toMatchObject({ keyword: "", impressions: 40 });
  });
});

describe("getSearchIntentBreakdown", () => {
  it("returns empty buckets when the response has no rows", async () => {
    mockFetch.mockResolvedValueOnce(json({}));
    expect(await getSearchIntentBreakdown()).toEqual({
      brand: [],
      product: [],
      informational: [],
      navigational: [],
    });
  });

  it("buckets a keyless, metric-less row as navigational with zeros", async () => {
    mockFetch.mockResolvedValueOnce(json({ rows: [BARE_ROW] }));
    const out = await getSearchIntentBreakdown();
    expect(out.navigational).toEqual([{ keyword: "", ...ZERO_METRICS, position: 0 }]);
    expect(out.brand).toEqual([]);
  });
});
