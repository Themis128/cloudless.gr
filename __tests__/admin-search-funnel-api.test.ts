import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

const mockGetFunnelSummary = vi.fn();
vi.mock("@/lib/search-funnel", () => ({
  getFunnelSummary: (...a: unknown[]) => mockGetFunnelSummary(...a),
}));

describe("GET /api/admin/analytics/search-funnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/search-funnel/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/analytics/search-funnel"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when D1 not configured", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
    mockGetFunnelSummary.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/analytics/search-funnel/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/analytics/search-funnel"));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.configured).toBe(false);
  });

  it("returns aggregated rows from D1", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
    mockGetFunnelSummary.mockResolvedValue([
      { event_type: "search_query", ab_variant: null, count: 12 },
      { event_type: "rec_impression", ab_variant: "a", count: 8 },
      { event_type: "rec_impression", ab_variant: "b", count: 7 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/search-funnel/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/analytics/search-funnel?days=7")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.days).toBe(7);
    expect(data.rows).toHaveLength(3);
  });
});
