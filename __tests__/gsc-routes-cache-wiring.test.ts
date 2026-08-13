/**
 * Unit tests for lake-backed GSC analytics routes.
 *
 * keywords / history / seo no longer use readThrough or live gsc.ts.
 * They read via `@/lib/datalake-serve` (`getSeoFromLake`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAdmin, mockGetSeoFromLake, mockGetGscDimensionFromLake } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockGetSeoFromLake: vi.fn(),
  mockGetGscDimensionFromLake: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/datalake-serve", () => ({
  getSeoFromLake: (...a: unknown[]) => mockGetSeoFromLake(...a),
  getGscDimensionFromLake: (...a: unknown[]) => mockGetGscDimensionFromLake(...a),
}));

function req(url: string) {
  return new NextRequest(url, { headers: { Authorization: "Bearer x" } });
}

const OK_ADMIN = { ok: true as const, user: { sub: "u1" } };

const SAMPLE_SEO = {
  snapshot: {
    clicks: 100,
    impressions: 2000,
    ctr: 0.05,
    position: 12.3,
    days: 28,
  },
  keywords: [
    { query: "cloudless", clicks: 40, impressions: 800, ctr: 0.05, position: 3.1 },
    { query: "ai seo greece", clicks: 20, impressions: 400, ctr: 0.05, position: 8.2 },
  ],
  fetchedAt: "2026-08-13T12:00:00.000Z",
  source: "datalake-gold" as const,
};

describe("GET /api/admin/analytics/keywords — lake wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords"));
    expect(r.status).toBe(401);
    expect(mockGetSeoFromLake).not.toHaveBeenCalled();
  });

  it("passes days from query string to getSeoFromLake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    await GET(req("http://localhost/api/admin/analytics/keywords?days=42&limit=10"));
    expect(mockGetSeoFromLake).toHaveBeenCalledWith(42);
  });

  it("slices keywords by limit and marks datalake-gold cache metadata", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords?limit=1"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.keywords).toHaveLength(1);
    expect(data.keywords[0].query).toBe("cloudless");
    expect(data.source).toBe("datalake-gold");
    expect(data._cache).toEqual({ source: "datalake-gold", ageSeconds: null });
    expect(data._filters).toEqual({ days: 28, limit: 1 });
  });

  it("returns 500 when the lake helper throws", async () => {
    mockGetSeoFromLake.mockRejectedValue(new Error("r2 down"));
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const r = await GET(req("http://localhost/api/admin/analytics/keywords"));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.error).toMatch(/datalake/i);
  });
});

describe("GET /api/admin/analytics/history — lake wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const r = await GET(req("http://localhost/api/admin/analytics/history"));
    expect(r.status).toBe(401);
  });

  it("uses days from query string and returns empty history with SEO snapshot", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const r = await GET(req("http://localhost/api/admin/analytics/history?days=16"));
    expect(mockGetSeoFromLake).toHaveBeenCalledWith(16);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.history).toEqual([]);
    expect(data.snapshot).toEqual(SAMPLE_SEO.snapshot);
    expect(data.source).toBe("datalake-gold");
    expect(data._filters).toEqual({ days: 16 });
    expect(data.note).toMatch(/no live gsc/i);
  });
});

describe("GET /api/admin/analytics/seo — lake composite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockGetSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const r = await GET(req("http://localhost/api/admin/analytics/seo"));
    expect(r.status).toBe(401);
  });

  it("returns snapshot + keywords from getSeoFromLake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const r = await GET(req("http://localhost/api/admin/analytics/seo?days=7"));
    expect(mockGetSeoFromLake).toHaveBeenCalledWith(7);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.snapshot).toEqual(SAMPLE_SEO.snapshot);
    expect(data.keywords).toEqual(SAMPLE_SEO.keywords);
    expect(data.source).toBe("datalake-gold");
    expect(data._cache).toEqual({ source: "datalake-gold", ageSeconds: null });
    expect(data._filters).toEqual({ days: 7 });
  });

  it("returns 500 when the lake helper throws", async () => {
    mockGetSeoFromLake.mockRejectedValue(new Error("gold missing"));
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const r = await GET(req("http://localhost/api/admin/analytics/seo"));
    expect(r.status).toBe(500);
  });
});
