/**
 * Unit tests for src/lib/gsc.ts
 *
 * Strategy:
 * - Mock `jose` (dynamic-imported inside getAccessToken) globally
 * - Mock `@/lib/ssm-config` to provide Google credentials
 * - Stub `fetch` per-test with ordered return values (token call first,
 *   then GSC searchAnalytics calls)
 * - `vi.resetModules()` in beforeEach so the module-level `cachedToken`
 *   is reset between tests
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

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    GOOGLE_CLIENT_EMAIL: "svc@project.iam.gserviceaccount.com",
    GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
  }),
}));

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
    const { getConfig } = await import("@/lib/ssm-config");
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      GOOGLE_CLIENT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: "",
    });

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

  it("returns [] when GSC call fails", async () => {
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

  it("returns [] when GSC call fails", async () => {
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
