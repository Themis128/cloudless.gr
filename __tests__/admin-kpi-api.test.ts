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
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});

const { mockGetKpiFromLake, mockGetGoldSection, mockGetInsight } = vi.hoisted(() => ({
  mockGetKpiFromLake: vi.fn(),
  mockGetGoldSection: vi.fn(),
  mockGetInsight: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/datalake-serve", () => ({
  getKpiFromLake: (...a: unknown[]) => mockGetKpiFromLake(...a),
  getGoldSection: (...a: unknown[]) => mockGetGoldSection(...a),
  getInsight: (...a: unknown[]) => mockGetInsight(...a),
}));

function makeToken(groupsOrAdmin: string[] | boolean = false): string {
  const isAdmin = Array.isArray(groupsOrAdmin)
    ? groupsOrAdmin.includes("admin")
    : Boolean(groupsOrAdmin);
  return isAdmin ? "test-admin-session" : "test-user-session";
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken(["admin"])}` },
  });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken([])}` },
  });
}

const BASE = "http://localhost/api/admin/kpi";

const SAMPLE_KPI = {
  days: 28,
  fetchedAt: "2026-08-13T12:00:00.000Z",
  source: "datalake-gold",
  seo: {
    clicks: 300,
    impressions: 5000,
    ctr: 0.06,
    position: 14.2,
    days: 28,
  },
  keywordsTop: [{ query: "cloudless", clicks: 40 }],
  revenueRows: [{ day: "2026-08-01", revenue: 120 }],
  funnelRows: [{ step: "visit", count: 1000 }],
  errors: [],
};

const SAMPLE_APPFLOWY = {
  section: "appflowy_activity",
  rowCount: 4,
  rows: [
    { id: "p1", status: "In Progress" },
    { id: "p2", status: "Completed" },
    { id: "p3", status: "Planning" },
    { id: "p4", status: "On Hold" },
  ],
};

const SAMPLE_INSIGHT = {
  domain: "executive",
  summary: "Traffic is up week over week.",
  bullets: ["Clicks +12%", "Revenue stable"],
  generated_at: "2026-08-13T11:00:00.000Z",
};

describe("GET /api/admin/kpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKpiFromLake.mockResolvedValue(SAMPLE_KPI);
    mockGetGoldSection.mockResolvedValue(SAMPLE_APPFLOWY);
    mockGetInsight.mockResolvedValue(SAMPLE_INSIGHT);
  });

  it("returns 401 without a token", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(userReq(BASE));
    expect(res.status).toBe(403);
  });

  it("returns 200 with datalake-gold source and lake sections", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.source).toBe("datalake-gold");
    expect(data).toHaveProperty("analytics");
    expect(data).toHaveProperty("gsc");
    expect(data).toHaveProperty("revenue");
    expect(data).toHaveProperty("funnel");
    expect(data).toHaveProperty("projects");
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("insight");
    expect(typeof data.fetchedAt).toBe("string");
    expect(mockGetKpiFromLake).toHaveBeenCalledWith(28);
    expect(mockGetGoldSection).toHaveBeenCalledWith("appflowy_activity");
    expect(mockGetInsight).toHaveBeenCalledWith("executive");
  });

  it("passes days query to getKpiFromLake", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    await GET(adminReq(`${BASE}?days=14`));
    expect(mockGetKpiFromLake).toHaveBeenCalledWith(14);
  });

  it("returns SEO snapshot as gsc and revenue/funnel rows", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.gsc.clicks).toBe(300);
    expect(data.gsc.impressions).toBe(5000);
    expect(data.revenue.rows).toEqual(SAMPLE_KPI.revenueRows);
    expect(data.funnel.rows).toEqual(SAMPLE_KPI.funnelRows);
  });

  it("maps appflowy_activity gold into projects counts", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.projects.total).toBe(4);
    expect(data.projects.activeCount).toBe(4);
    expect(data.projects.rows).toHaveLength(4);
  });

  it("returns executive insight when present", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.insight).toEqual({
      summary: SAMPLE_INSIGHT.summary,
      bullets: SAMPLE_INSIGHT.bullets,
      generated_at: SAMPLE_INSIGHT.generated_at,
    });
  });

  it("returns null insight when getInsight returns null", async () => {
    mockGetInsight.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();
    expect(data.insight).toBeNull();
  });

  it("returns empty projects when appflowy gold section is missing", async () => {
    mockGetGoldSection.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.projects.total).toBe(0);
    expect(data.projects.activeCount).toBe(0);
    expect(data.projects.rows).toEqual([]);
  });

  it("keeps tasks as zeroed placeholder from lake route", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.tasks.overdueCount).toBe(0);
    expect(data.tasks.summary).toEqual({});
  });
});
