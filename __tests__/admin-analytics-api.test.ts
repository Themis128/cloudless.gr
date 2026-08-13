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

const { lakeMocks } = vi.hoisted(() => ({
  lakeMocks: {
    getSeoFromLake: vi.fn(),
    getGscDimensionFromLake: vi.fn(),
    getCtrOpportunitiesFromLake: vi.fn(),
  },
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/datalake-serve", () => ({
  getSeoFromLake: lakeMocks.getSeoFromLake,
  getGscDimensionFromLake: lakeMocks.getGscDimensionFromLake,
  getCtrOpportunitiesFromLake: lakeMocks.getCtrOpportunitiesFromLake,
}));

function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeAdminToken()}` } });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url);
}

const SAMPLE_SEO = {
  snapshot: {
    clicks: 500,
    impressions: 10000,
    ctr: 0.05,
    position: 12.3,
    days: 28,
  },
  keywords: [
    {
      query: "digital agency greece",
      clicks: 45,
      impressions: 600,
      ctr: 0.075,
      position: 4.2,
    },
  ],
  fetchedAt: "2026-08-13T12:00:00.000Z",
  source: "datalake-gold" as const,
};

const SAMPLE_DIMENSION = {
  dimension: "device",
  rows: [
    { device: "DESKTOP", clicks: 300 },
    { device: "MOBILE", clicks: 200 },
  ],
  snapshot: SAMPLE_SEO.snapshot,
  fetchedAt: SAMPLE_SEO.fetchedAt,
  source: "datalake-gold" as const,
  note: "Dimension stub from gold",
};

describe("GET /api/admin/analytics/web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/web"));
    expect(res.status).toBe(401);
    expect(lakeMocks.getSeoFromLake).not.toHaveBeenCalled();
  });

  it("returns analytics data from lake SEO snapshot", async () => {
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/web"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getSeoFromLake).toHaveBeenCalledWith(28);
    expect(data.analytics).toEqual({
      clicks: 500,
      impressions: 10000,
      ctr: 0.05,
      position: 12.3,
    });
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/seo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue({
      ...SAMPLE_SEO,
      snapshot: { ...SAMPLE_SEO.snapshot, clicks: 1200, position: 8.4 },
      keywords: [{ query: "cloudless ai", clicks: 80, impressions: 900, ctr: 0.089, position: 3.1 }],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(401);
  });

  it("returns snapshot and keywords from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/seo"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.snapshot).toBeDefined();
    expect(data.keywords).toHaveLength(1);
    expect(data.source).toBe("datalake-gold");
    expect(data._cache).toEqual({ source: "datalake-gold", ageSeconds: null });
  });
});

describe("GET /api/admin/analytics/devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "device",
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(401);
  });

  it("returns device breakdown from lake dimension helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/devices"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("device", 28);
    expect(data.devices).toHaveLength(2);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(401);
  });

  it("returns keywords list from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/keywords"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.keywords).toHaveLength(1);
    expect(data.keywords[0].query).toBe("digital agency greece");
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/countries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "country",
      rows: [
        { country: "grc", clicks: 280, impressions: 4000 },
        { country: "usa", clicks: 120, impressions: 2000 },
      ],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(401);
  });

  it("returns country data from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/countries"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("country", 28);
    expect(data.countries).toHaveLength(2);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(401);
  });

  it("returns empty history with SEO snapshot from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/history"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.history).toEqual([]);
    expect(data.snapshot).toEqual(SAMPLE_SEO.snapshot);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "page",
      rows: [{ page: "/en/", clicks: 200, impressions: 3000, ctr: 0.067, position: 5.1 }],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(401);
  });

  it("returns top pages from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/pages"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("page", 28);
    expect(data.pages).toHaveLength(1);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "product",
      rows: [{ page: "/en/store/ai-seo-bundle", clicks: 50, impressions: 800 }],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(401);
  });

  it("returns product page metrics from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(
      adminReq("http://localhost/api/admin/analytics/products?pattern=/store/")
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("product", 28);
    expect(data.products).toHaveLength(1);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/ctr-opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getCtrOpportunitiesFromLake.mockResolvedValue({
      opportunities: [
        { query: "seo agency athens", impressions: 500, clicks: 10, ctr: 0.02, position: 7.8 },
      ],
      fetchedAt: SAMPLE_SEO.fetchedAt,
      source: "datalake-gold" as const,
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(401);
  });

  it("returns CTR opportunities from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/ctr-opportunities"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getCtrOpportunitiesFromLake).toHaveBeenCalledWith(50);
    expect(data.opportunities).toHaveLength(1);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/query-pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "query_page",
      rows: [{ query: "ai marketing tool", page: "/en/store/ai-marketing", clicks: 30 }],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(401);
  });

  it("returns query-page rows from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/query-pages"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("query_page", 28);
    expect(data.queryPages).toHaveLength(1);
    expect(data.source).toBe("datalake-gold");
  });
});

describe("GET /api/admin/analytics/search-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(401);
  });

  it("returns empty intents with keywords from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/search-intent"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.intents).toEqual([]);
    expect(data.keywords).toEqual(SAMPLE_SEO.keywords);
    expect(data.source).toBe("datalake-gold");
    expect(data.note).toMatch(/no live gsc/i);
  });
});
