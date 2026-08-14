import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const getGscReportsMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/gsc-weekly-archive", () => ({
  getGscReports: getGscReportsMock,
}));

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

const okAuth = { ok: true as const };
const denyAuth = {
  ok: false as const,
  response: new Response("Unauthorized", { status: 401 }),
};

describe("GET /api/admin/analytics/gsc-archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(okAuth);
  });

  it("returns 401 when unauthenticated (does not call the lib)", async () => {
    requireAdminMock.mockResolvedValueOnce(denyAuth);

    const { GET } = await import("@/app/api/admin/analytics/gsc-archive/route");
    const res = await GET(makeGet("/api/admin/analytics/gsc-archive"));

    expect(res.status).toBe(401);
    expect(getGscReportsMock).not.toHaveBeenCalled();
  });

  it("returns the archive rows with source=r2-datalake", async () => {
    getGscReportsMock.mockResolvedValueOnce([
      { id: "p1", week: "Week of 2026-06-08", date: "2026-06-08", clicks: 100 },
    ]);

    const { GET } = await import("@/app/api/admin/analytics/gsc-archive/route");
    const res = await GET(makeGet("/api/admin/analytics/gsc-archive"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("r2-datalake");
    expect(body.count).toBe(1);
    expect(body.reports[0].week).toBe("Week of 2026-06-08");
  });

  it("clamps the limit param to [1,100]", async () => {
    getGscReportsMock.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/admin/analytics/gsc-archive/route");
    await GET(makeGet("/api/admin/analytics/gsc-archive?limit=9999"));

    expect(getGscReportsMock).toHaveBeenCalledWith(100);
  });

  it("returns 503 when the R2 snapshot is missing or unbound", async () => {
    getGscReportsMock.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/admin/analytics/gsc-archive/route");
    const res = await GET(makeGet("/api/admin/analytics/gsc-archive"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.reports).toEqual([]);
    expect(body.error).toMatch(/DATALAKE_BUCKET|gsc-weekly/i);
  });

  it("returns 500 when the lib throws", async () => {
    getGscReportsMock.mockRejectedValueOnce(new Error("boom"));

    const { GET } = await import("@/app/api/admin/analytics/gsc-archive/route");
    const res = await GET(makeGet("/api/admin/analytics/gsc-archive"));

    expect(res.status).toBe(500);
  });
});
