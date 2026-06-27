/**
 * Unit tests for the GSC route ↔ cache wiring.
 *
 * Each analytics route should:
 *   1. Pass the request's limit/weeks/etc. to readThrough as part of the
 *      cache-key params (so /?limit=5 and /?limit=100 do NOT share a cache
 *      entry).
 *   2. Call the underlying gsc.ts getter when the cache reports a miss.
 *   3. Include a _cache field in the response payload.
 *
 * We don't test every wrapped route — that would just re-test readThrough.
 * Instead we exercise the three representative shapes:
 *   - keywords        — single-param (limit)
 *   - history         — single-param, different name (weeks)
 *   - seo             — multi-call composite payload (snapshot + keywords)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAdmin, mockGetConfig, mockReadThrough, mockGsc } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockGetConfig: vi.fn(),
  mockReadThrough: vi.fn(),
  mockGsc: {
    getTopKeywords: vi.fn(),
    getPerformanceHistory: vi.fn(),
    getSeoSnapshot: vi.fn(),
  },
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/gsc-cache", () => ({
  readThrough: (...a: unknown[]) => mockReadThrough(...a),
}));
vi.mock("@/lib/gsc", () => ({
  getTopKeywords: (...a: unknown[]) => mockGsc.getTopKeywords(...a),
  getPerformanceHistory: (...a: unknown[]) => mockGsc.getPerformanceHistory(...a),
  getSeoSnapshot: (...a: unknown[]) => mockGsc.getSeoSnapshot(...a),
}));

function req(url: string) {
  return new NextRequest(url, { headers: { Authorization: "Bearer x" } });
}

const OK_ADMIN = { ok: true as const, user: { sub: "u1" } };
const OK_CONFIG = { GOOGLE_CLIENT_EMAIL: "a@b.com", GOOGLE_PRIVATE_KEY: "k" };

describe("GET /api/admin/analytics/keywords — cache wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetConfig.mockResolvedValue(OK_CONFIG);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords"));
    expect(r.status).toBe(401);
  });

  it("returns 503 when GSC env is unset", async () => {
    mockGetConfig.mockResolvedValue({});
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords"));
    expect(r.status).toBe(503);
  });

  it("uses limit from query string as part of the cache key", async () => {
    mockReadThrough.mockResolvedValue({
      value: [{ keyword: "k1" }],
      source: "live",
      ageSeconds: 0,
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    await GET(req("http://localhost/api/admin/analytics/keywords?limit=42"));
    expect(mockReadThrough).toHaveBeenCalledTimes(1);
    const [routeKey, params, fetcher, opts] = mockReadThrough.mock.calls[0];
    expect(routeKey).toBe("keywords");
    expect(params).toEqual({ limit: 42, days: 28 });
    expect(opts).toEqual({ ttlSeconds: 3600 });
    expect(typeof fetcher).toBe("function");
  });

  it("different limits result in different cache-key params", async () => {
    mockReadThrough.mockResolvedValue({
      value: [],
      source: "live",
      ageSeconds: 0,
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    await GET(req("http://localhost/api/admin/analytics/keywords?limit=5"));
    await GET(req("http://localhost/api/admin/analytics/keywords?limit=100"));
    expect(mockReadThrough.mock.calls[0][1]).toEqual({ limit: 5, days: 28 });
    expect(mockReadThrough.mock.calls[1][1]).toEqual({ limit: 100, days: 28 });
  });

  it("includes _cache metadata in the response", async () => {
    mockReadThrough.mockResolvedValue({
      value: [{ keyword: "test" }],
      source: "cache",
      ageSeconds: 42,
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords?limit=20"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data._cache).toEqual({ source: "cache", ageSeconds: 42 });
    expect(data.keywords).toEqual([{ keyword: "test" }]);
  });

  it("fetcher invocation calls the GSC getter with the limit", async () => {
    // Capture the fetcher and invoke it manually to verify it calls getTopKeywords correctly.
    let captured: (() => unknown) | null = null;
    mockReadThrough.mockImplementation(async (_k, _p, fn) => {
      captured = fn as () => unknown;
      return { value: [], source: "live", ageSeconds: 0 };
    });
    mockGsc.getTopKeywords.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    await GET(req("http://localhost/api/admin/analytics/keywords?limit=12"));
    expect(captured).not.toBeNull();
    await captured!();
    expect(mockGsc.getTopKeywords).toHaveBeenCalledWith(undefined, 12, 28);
  });
});

describe("GET /api/admin/analytics/history — cache wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetConfig.mockResolvedValue(OK_CONFIG);
  });

  it("uses weeks from query string as the cache-key param", async () => {
    mockReadThrough.mockResolvedValue({
      value: [],
      source: "live",
      ageSeconds: 0,
    });
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    await GET(req("http://localhost/api/admin/analytics/history?weeks=16"));
    expect(mockReadThrough).toHaveBeenCalledTimes(1);
    const params = mockReadThrough.mock.calls[0][1];
    expect(params).toEqual({ weeks: 16 });
  });
});

describe("GET /api/admin/analytics/seo — composite cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetConfig.mockResolvedValue(OK_CONFIG);
  });

  it("caches snapshot + keywords as a single composite payload", async () => {
    mockReadThrough.mockResolvedValue({
      value: { snapshot: { clicks: 100 }, keywords: [{ keyword: "x" }] },
      source: "cache",
      ageSeconds: 60,
    });
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const r = await GET(req("http://localhost/api/admin/analytics/seo"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.snapshot).toEqual({ clicks: 100 });
    expect(data.keywords).toEqual([{ keyword: "x" }]);
    expect(data._cache).toEqual({ source: "cache", ageSeconds: 60 });
    // Empty params: the seo route caches one global blob.
    expect(mockReadThrough.mock.calls[0][1]).toEqual({ days: 28 });
  });

  it("composite fetcher resolves snapshot + keywords in parallel", async () => {
    let captured: (() => Promise<unknown>) | null = null;
    mockReadThrough.mockImplementation(async (_k, _p, fn) => {
      captured = fn as () => Promise<unknown>;
      return { value: { snapshot: null, keywords: [] }, source: "live", ageSeconds: 0 };
    });
    mockGsc.getSeoSnapshot.mockResolvedValue({ clicks: 1 });
    mockGsc.getTopKeywords.mockResolvedValue([{ keyword: "y" }]);
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    await GET(req("http://localhost/api/admin/analytics/seo"));
    const composite = await captured!();
    expect(composite).toEqual({
      snapshot: { clicks: 1 },
      keywords: [{ keyword: "y" }],
    });
    expect(mockGsc.getSeoSnapshot).toHaveBeenCalledTimes(1);
    expect(mockGsc.getTopKeywords).toHaveBeenCalledTimes(1);
  });
});
