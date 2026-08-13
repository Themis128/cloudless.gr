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

const ANALYTICS_URL = "http://localhost/api/admin/analytics/unified";
const ALG_RS256 = "RS256";

const { mockGetUnifiedFromLake } = vi.hoisted(() => ({
  mockGetUnifiedFromLake: vi.fn(),
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
      return { payload, protectedHeader: { alg: ALG_RS256 } };
    },
  };
});

vi.mock("@/lib/datalake-serve", () => ({
  getUnifiedFromLake: (...a: unknown[]) => mockGetUnifiedFromLake(...a),
}));

function makeAdminToken(): string {
  return "test-admin-session";
}

function makeUserToken(): string {
  return "test-user-session";
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeAdminToken()}` } });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeUserToken()}` } });
}

const SAMPLE_UNIFIED = {
  days: 28,
  fetchedAt: "2026-08-13T12:00:00.000Z",
  source: "datalake-gold",
  lakeSource: "r2",
  seo: { clicks: 400, impressions: 8000, ctr: 0.05, position: 12, days: 28 },
  keywords: [{ query: "cloudless", clicks: 40 }],
  pipeline: { stages: [{ stage: "Qualified", count: 3 }], rowCount: 1 },
  email: null,
  stripe: {
    totalOrders: 2,
    revenue: 150,
    activeSubscriptions: null,
    mrr: null,
    rows: [{ day: "2026-08-01", revenue: 150 }],
  },
  attribution: [{ channel: "organic", sessions: 10 }],
  sectionsMissing: [],
};

describe("GET /api/admin/analytics/unified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnifiedFromLake.mockResolvedValue(SAMPLE_UNIFIED);
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(new NextRequest(ANALYTICS_URL));
    expect(res.status).toBe(401);
    expect(mockGetUnifiedFromLake).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(userReq(ANALYTICS_URL));
    expect(res.status).toBe(403);
    expect(mockGetUnifiedFromLake).not.toHaveBeenCalled();
  });

  it("returns 200 with lake-composed sources", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(mockGetUnifiedFromLake).toHaveBeenCalledWith(28);
    expect(data.source).toBe("datalake-gold");
    expect(data).toHaveProperty("stripe");
    expect(data).toHaveProperty("seo");
    expect(data).toHaveProperty("pipeline");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("attribution");
    expect(data).toHaveProperty("keywords");
    expect(data).toHaveProperty("sectionsMissing");
    expect(typeof data.fetchedAt).toBe("string");
    expect(data._filters).toEqual({ days: 28 });
  });

  it("passes days query to getUnifiedFromLake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    await GET(adminReq(`${ANALYTICS_URL}?days=14`));
    expect(mockGetUnifiedFromLake).toHaveBeenCalledWith(14);
  });

  it("surfaces null seo from the lake payload", async () => {
    mockGetUnifiedFromLake.mockResolvedValue({ ...SAMPLE_UNIFIED, seo: null });
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.seo).toBeNull();
  });

  it("surfaces null pipeline from the lake payload", async () => {
    mockGetUnifiedFromLake.mockResolvedValue({ ...SAMPLE_UNIFIED, pipeline: null });
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.pipeline).toBeNull();
  });

  it("keeps email null (not in gold yet)", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.email).toBeNull();
  });

  it("surfaces null stripe from the lake payload", async () => {
    mockGetUnifiedFromLake.mockResolvedValue({ ...SAMPLE_UNIFIED, stripe: null });
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.stripe).toBeNull();
  });
});
