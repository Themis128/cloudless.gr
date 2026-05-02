/**
 * Unit tests for src/lib/gsc.ts
 *
 * Strategy:
 * - Mock `jose` (dynamic-imported inside createGoogleAuth in google-auth.ts)
 * - Credentials come from process.env set in __tests__/setup.ts
 * - Stub `fetch` per-test with ordered return values (token call first,
 *   then GSC searchAnalytics calls)
 * - `vi.resetModules()` in beforeEach resets the token cache in the closure
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Static mocks (hoisted before any import) ─────────────────────────────────

vi.mock("jose", () => {
  // SignJWT is called with `new` — Vitest 4.x calls the implementation with
  // `new` too, so we must use a regular function (not an arrow function).
  // A constructor that explicitly returns a plain object causes `new` to yield
  // that object instead of `this`, giving us the chainable mock we need.
  const SignJWT = vi.fn().mockImplementation(function (this: unknown) {
    return {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue("mock-jwt-token"),
    };
  });
  return {
    SignJWT,
    importPKCS8: vi.fn().mockResolvedValue("mock-private-key"),
  };
});

// ── Token response helper ─────────────────────────────────────────────────────

function tokenResponse() {
  return {
    ok: true as const,
    json: async () => ({ access_token: "mock-access-token", expires_in: 3600 }),
    text: async () => "",
  };
}

/** Single ok GSC searchAnalytics response with given rows. */
function gscOkResponse(rows: unknown[]) {
  return {
    ok: true as const,
    json: async () => ({ rows }),
    text: async () => "",
  };
}

/** Non-ok GSC response (e.g. 403 Forbidden). */
function gscErrorResponse(status = 403) {
  return {
    ok: false as const,
    status,
    json: async () => ({ error: { message: "Forbidden" } }),
    text: async () => "Forbidden",
  };
}

// ── Row builders ──────────────────────────────────────────────────────────────

const TOTALS_ROW = { clicks: 842, impressions: 18_500, ctr: 0.0455, position: 12.7 };

function kwRow(keyword: string) {
  return { keys: [keyword], clicks: 120, impressions: 3000, ctr: 0.04, position: 9.2 };
}

function pageRow(page: string) {
  return { keys: [page], clicks: 90, impressions: 2100, ctr: 0.043, position: 7.1 };
}

function dateRow(date: string) {
  return { keys: [date], clicks: 30, impressions: 600, ctr: 0.05, position: 11 };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const GSC_RETURNS_EMPTY_ON_FAIL = "returns [] when GSC call fails";

describe("getSeoSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns snapshot with correct numeric fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())          // getAccessToken
        .mockResolvedValueOnce(gscOkResponse([TOTALS_ROW]))      // totals
        .mockResolvedValueOnce(gscOkResponse([kwRow("cloudless"), kwRow("sst")])), // keywords
    );

    const { getSeoSnapshot } = await import("@/lib/gsc");
    const snap = await getSeoSnapshot();

    expect(snap).not.toBeNull();
    expect(snap!.clicks).toBe(842);
    expect(snap!.impressions).toBe(18_500);
    expect(snap!.ctr).toBe(4.55);          // percentage: 0.0455 × 100
    expect(snap!.avgPosition).toBe(12.7);
    expect(snap!.organicKeywords).toBe(2);  // length of keyword rows
  });

  it("returns null when GSC totals call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse(403)),
    );

    const { getSeoSnapshot } = await import("@/lib/gsc");
    const snap = await getSeoSnapshot();
    expect(snap).toBeNull();
  });

  it("returns null when credentials are missing", async () => {
    process.env.GOOGLE_CLIENT_EMAIL = ""; process.env.GOOGLE_PRIVATE_KEY = "";
    vi.stubGlobal("fetch", vi.fn());  // should not be called

    const { getSeoSnapshot } = await import("@/lib/gsc");
    const snap = await getSeoSnapshot();
    expect(snap).toBeNull();
  });

  it("handles missing rows gracefully (new property with no data)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscOkResponse([]))   // no totals row
        .mockResolvedValueOnce(gscOkResponse([])),  // no keyword rows
    );

    const { getSeoSnapshot } = await import("@/lib/gsc");
    const snap = await getSeoSnapshot();

    expect(snap).not.toBeNull();
    expect(snap!.clicks).toBe(0);
    expect(snap!.organicKeywords).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getTopKeywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps keyword rows to KeywordData objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            kwRow("serverless nextjs"),
            kwRow("cloudless.gr"),
          ]),
        ),
    );

    const { getTopKeywords } = await import("@/lib/gsc");
    const kws = await getTopKeywords();

    expect(kws).toHaveLength(2);
    expect(kws[0]).toMatchObject({
      keyword: "serverless nextjs",
      clicks: 120,
      impressions: 3000,
      ctr: 4,    // 0.04 × 100
      position: 9.2,
    });
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getTopKeywords } = await import("@/lib/gsc");
    const kws = await getTopKeywords();
    expect(kws).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const { getTopKeywords } = await import("@/lib/gsc");
    const kws = await getTopKeywords();
    expect(kws).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getPerformanceHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps date rows to PerformancePoint objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            dateRow("2025-01-01"),
            dateRow("2025-01-02"),
          ]),
        ),
    );

    const { getPerformanceHistory } = await import("@/lib/gsc");
    const history = await getPerformanceHistory();

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      date: "2025-01-01",
      clicks: 30,
      impressions: 600,
      ctr: 5,       // 0.05 × 100
      avgPosition: 11,
    });
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getPerformanceHistory } = await import("@/lib/gsc");
    expect(await getPerformanceHistory()).toEqual([]);
  });

  it("accepts custom weeks parameter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(gscOkResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const { getPerformanceHistory } = await import("@/lib/gsc");
    await getPerformanceHistory(undefined, 4);

    // Verify the GSC call body includes the correct rowLimit (4 × 7 = 28)
    const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(body.rowLimit).toBe(28);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getTopPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps page rows to PageData objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([pageRow("https://cloudless.gr/"), pageRow("https://cloudless.gr/blog")]),
        ),
    );

    const { getTopPages } = await import("@/lib/gsc");
    const pages = await getTopPages();

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      page: "https://cloudless.gr/",
      clicks: 90,
      impressions: 2100,
      ctr: 4.3,
      position: 7.1,
    });
  });

  it("returns [] on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getTopPages } = await import("@/lib/gsc");
    expect(await getTopPages()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getWebAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns totals + topPages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscOkResponse([TOTALS_ROW]))          // totals
        .mockResolvedValueOnce(gscOkResponse([pageRow("https://cloudless.gr/")])), // pages
    );

    const { getWebAnalytics } = await import("@/lib/gsc");
    const data = await getWebAnalytics();

    expect(data).not.toBeNull();
    expect(data!.clicks).toBe(842);
    expect(data!.impressions).toBe(18_500);
    expect(data!.ctr).toBe(4.55);
    expect(data!.avgPosition).toBe(12.7);
    expect(data!.topPages).toHaveLength(1);
    expect(data!.topPages[0].page).toBe("https://cloudless.gr/");
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout")),
    );

    const { getWebAnalytics } = await import("@/lib/gsc");
    expect(await getWebAnalytics()).toBeNull();
  });

  it("handles empty data (no rows)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscOkResponse([]))
        .mockResolvedValueOnce(gscOkResponse([])),
    );

    const { getWebAnalytics } = await import("@/lib/gsc");
    const data = await getWebAnalytics();

    expect(data).not.toBeNull();
    expect(data!.clicks).toBe(0);
    expect(data!.topPages).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getCtrOpportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("filters rows to position 4-20 with CTR < 5% and impressions > 10", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            { keys: ["opportunity keyword"], clicks: 10, impressions: 500, ctr: 0.02, position: 8 },
            { keys: ["rank 2 keyword"], clicks: 200, impressions: 5000, ctr: 0.04, position: 2 },
            { keys: ["high ctr keyword"], clicks: 80, impressions: 1000, ctr: 0.08, position: 10 },
            { keys: ["low impressions"], clicks: 1, impressions: 5, ctr: 0.02, position: 9 },
          ]),
        ),
    );

    const { getCtrOpportunities } = await import("@/lib/gsc");
    const opps = await getCtrOpportunities();

    expect(opps).toHaveLength(1);
    expect(opps[0].keyword).toBe("opportunity keyword");
    expect(opps[0].position).toBe(8);
    expect(opps[0].ctr).toBe(2);
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getCtrOpportunities } = await import("@/lib/gsc");
    expect(await getCtrOpportunities()).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      keys: [`keyword ${i}`],
      clicks: 5,
      impressions: 500,
      ctr: 0.01,
      position: 12,
    }));

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscOkResponse(rows)),
    );

    const { getCtrOpportunities } = await import("@/lib/gsc");
    const opps = await getCtrOpportunities(undefined, 3);
    expect(opps).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getDeviceBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps device rows to DeviceData objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            { keys: ["DESKTOP"], clicks: 400, impressions: 8000, ctr: 0.05, position: 10 },
            { keys: ["MOBILE"], clicks: 300, impressions: 7000, ctr: 0.043, position: 12 },
          ]),
        ),
    );

    const { getDeviceBreakdown } = await import("@/lib/gsc");
    const devices = await getDeviceBreakdown();

    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({
      device: "DESKTOP",
      clicks: 400,
      impressions: 8000,
      ctr: 5,
      avgPosition: 10,
    });
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getDeviceBreakdown } = await import("@/lib/gsc");
    expect(await getDeviceBreakdown()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getProductPageMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps page rows to ProductPageData objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            { keys: ["https://cloudless.gr/store/pro-plan"], clicks: 50, impressions: 1200, ctr: 0.042, position: 8.5 },
          ]),
        ),
    );

    const { getProductPageMetrics } = await import("@/lib/gsc");
    const products = await getProductPageMetrics();

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      page: "https://cloudless.gr/store/pro-plan",
      clicks: 50,
      impressions: 1200,
    });
    expect(products[0].ctr).toBeCloseTo(4.2, 1);
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getProductPageMetrics } = await import("@/lib/gsc");
    expect(await getProductPageMetrics()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getQueryPageMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps query+page rows to QueryPageMapping objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            {
              keys: ["cloudless serverless", "https://cloudless.gr/"],
              clicks: 80,
              impressions: 2000,
              ctr: 0.04,
              position: 7.2,
            },
          ]),
        ),
    );

    const { getQueryPageMapping } = await import("@/lib/gsc");
    const mappings = await getQueryPageMapping();

    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      query: "cloudless serverless",
      page: "https://cloudless.gr/",
      clicks: 80,
    });
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getQueryPageMapping } = await import("@/lib/gsc");
    expect(await getQueryPageMapping()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getSearchIntentBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("categorises keywords into brand/product/informational/navigational buckets", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            { keys: ["cloudless gr"], clicks: 100, impressions: 2000, ctr: 0.05, position: 3 },
            { keys: ["buy serverless hosting"], clicks: 20, impressions: 400, ctr: 0.05, position: 8 },
            { keys: ["how to deploy nextjs"], clicks: 30, impressions: 600, ctr: 0.05, position: 6 },
            { keys: ["some other term"], clicks: 10, impressions: 200, ctr: 0.05, position: 12 },
          ]),
        ),
    );

    const { getSearchIntentBreakdown } = await import("@/lib/gsc");
    const result = await getSearchIntentBreakdown();

    expect(result.brand).toHaveLength(1);
    expect(result.brand[0].keyword).toBe("cloudless gr");
    expect(result.product).toHaveLength(1);
    expect(result.product[0].keyword).toBe("buy serverless hosting");
    expect(result.informational).toHaveLength(1);
    expect(result.informational[0].keyword).toBe("how to deploy nextjs");
    expect(result.navigational).toHaveLength(1);
    expect(result.navigational[0].keyword).toBe("some other term");
  });

  it("returns empty buckets when GSC call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getSearchIntentBreakdown } = await import("@/lib/gsc");
    const result = await getSearchIntentBreakdown();

    expect(result.brand).toEqual([]);
    expect(result.product).toEqual([]);
    expect(result.informational).toEqual([]);
    expect(result.navigational).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getTrafficByCountry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps country rows to CountryTraffic objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          gscOkResponse([
            { keys: ["grc"], clicks: 450, impressions: 9000, ctr: 0.05, position: 8 },
            { keys: ["usa"], clicks: 200, impressions: 5000, ctr: 0.04, position: 11 },
          ]),
        ),
    );

    const { getTrafficByCountry } = await import("@/lib/gsc");
    const countries = await getTrafficByCountry();

    expect(countries).toHaveLength(2);
    expect(countries[0]).toMatchObject({
      country: "grc",
      clicks: 450,
      impressions: 9000,
      ctr: 5,
      avgPosition: 8,
    });
  });

  it(GSC_RETURNS_EMPTY_ON_FAIL, async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(gscErrorResponse()),
    );

    const { getTrafficByCountry } = await import("@/lib/gsc");
    expect(await getTrafficByCountry()).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(gscOkResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const { getTrafficByCountry } = await import("@/lib/gsc");
    await getTrafficByCountry(undefined, 5);

    const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(body.rowLimit).toBe(5);
  });
});
