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
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
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
// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { getConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
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

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
}));

// Mock fetch globally — routes call Workers AI via fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function withWorkersAiEnv() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  delete process.env.GEMINI_API_KEY;
}

function clearAiEnv() {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.GEMINI_API_KEY;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(url: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url, { method: "POST", body: JSON.stringify({ brief: "test" }) });
}

function mockWorkersAiResponse(text: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ result: { response: text } }),
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/ai/campaign
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWorkersAiEnv();
    getConfigMock.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/campaign"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when brief is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const req = new NextRequest("http://localhost/api/admin/ai/campaign", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ budget: "€500" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when Admin AI not configured", async () => {
    clearAiEnv();
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/campaign", { brief: "Promote AI tool" })
    );
    withWorkersAiEnv();
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns campaign strategy from Workers AI", async () => {
    const strategy = {
      recommended_platforms: ["Meta", "LinkedIn"],
      campaign_objective: "LEAD_GENERATION",
    };
    mockWorkersAiResponse(JSON.stringify(strategy));
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/campaign", {
        brief: "Promote AI marketing tool to Greek SMBs",
        budget: "€500/month",
        targetAudience: "Greek small business owners",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.strategy).toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns raw text when AI response is not valid JSON", async () => {
    mockWorkersAiResponse("I recommend Meta and LinkedIn for this campaign.");
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/campaign", { brief: "Test" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.strategy).toHaveProperty("raw");
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai/copy
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWorkersAiEnv();
    getConfigMock.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/copy"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when service is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const req = new NextRequest("http://localhost/api/admin/ai/copy", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "Meta" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when Admin AI not configured", async () => {
    clearAiEnv();
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/copy", { service: "AI Marketing" })
    );
    withWorkersAiEnv();
    expect(res.status).toBe(503);
  });

  it("returns ad copy variants", async () => {
    const variants = {
      variants: [
        {
          headline: "Grow Faster",
          body: "AI tools for your business",
          cta: "Get Started",
          tone: "professional",
        },
      ],
    };
    mockWorkersAiResponse(JSON.stringify(variants));
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/copy", {
        service: "AI Marketing Platform",
        platform: "Meta",
        objective: "leads",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.variants).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai/audience
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/audience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWorkersAiEnv();
    getConfigMock.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/audience"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when description is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const req = new NextRequest("http://localhost/api/admin/ai/audience", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platforms: ["Meta"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when Admin AI not configured", async () => {
    clearAiEnv();
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/audience", { description: "Greek SMB owners" })
    );
    withWorkersAiEnv();
    expect(res.status).toBe(503);
  });

  it("returns targeting parameters", async () => {
    const targeting = {
      summary: "SMB decision makers in Greece",
      demographics: { age_range: "30-50" },
    };
    mockWorkersAiResponse(JSON.stringify(targeting));
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/audience", {
        description: "Greek small business owners interested in digital marketing",
        platforms: ["Meta", "LinkedIn"],
        objective: "LEAD_GENERATION",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.targeting).toBeDefined();
  });
});
