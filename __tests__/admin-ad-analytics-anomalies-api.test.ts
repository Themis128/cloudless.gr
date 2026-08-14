import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  return {
    ...actual,
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const h = request.headers.get("authorization") ?? "";
      const token = h.startsWith("Bearer ") ? h.slice(7) : "";
      if (token === "test-admin-session") return { ok: true as const, user: adminUser };
      if (token === "test-user-session") {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return actual.requireAdmin(request);
    },
  };
});

const { mockListAnomalyHistory } = vi.hoisted(() => ({
  mockListAnomalyHistory: vi.fn(),
}));

vi.mock("@/lib/ad-analytics/anomaly-log", () => ({
  listAnomalyHistory: (...a: unknown[]) => mockListAnomalyHistory(...a),
}));

const URL = "http://localhost/api/admin/ad-analytics/anomalies";

function adminReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: "Bearer test-admin-session" },
  });
}

describe("GET /api/admin/ad-analytics/anomalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAnomalyHistory.mockResolvedValue([
      {
        id: "ad-analytics:anomaly:shop-online:linkedin:ctr_floor:2026-08-14",
        firedAt: "2026-08-14T10:15:00.000Z",
        campaignSlug: "shop-online",
        platform: "linkedin",
        rule: "ctr_floor",
        severity: "warning",
        message: "CTR below floor",
        detail: null,
        source: "log",
      },
    ]);
  });

  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/admin/ad-analytics/anomalies/route");
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/ad-analytics/anomalies/route");
    const res = await GET(
      new NextRequest(URL, { headers: { Authorization: "Bearer test-user-session" } })
    );
    expect(res.status).toBe(403);
  });

  it("returns anomaly rows for admin", async () => {
    const { GET } = await import("@/app/api/admin/ad-analytics/anomalies/route");
    const res = await GET(adminReq(`${URL}?limit=25`));
    expect(res.status).toBe(200);
    expect(mockListAnomalyHistory).toHaveBeenCalledWith(25);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.anomalies[0].rule).toBe("ctr_floor");
    expect(typeof data.fetchedAt).toBe("string");
  });
});
