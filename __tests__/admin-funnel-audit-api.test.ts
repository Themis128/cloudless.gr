import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

const mockBuildFunnelAudit = vi.fn();
vi.mock("@/lib/funnel-audit", () => ({
  buildFunnelAudit: (...a: unknown[]) => mockBuildFunnelAudit(...a),
}));

describe("GET /api/admin/analytics/funnel-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/analytics/funnel-audit/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/analytics/funnel-audit"));
    expect(res.status).toBe(401);
    expect(mockBuildFunnelAudit).not.toHaveBeenCalled();
  });

  it("returns the funnel audit report for admins", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
    const report = {
      generated_at: "2026-11-08T12:00:00Z",
      sources: { espocrm: true, socialauto: false },
      stages: [{ stage: "lead", count: 4, conv_pct: null, note: "x" }],
      weakest_transition: null,
      auction_warning: false,
      lead_sources: {},
      socialauto_funnel: null,
    };
    mockBuildFunnelAudit.mockResolvedValue(report);
    const { GET } = await import("@/app/api/admin/analytics/funnel-audit/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/analytics/funnel-audit"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(report);
  });
});
