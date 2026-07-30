import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetJsonConfigMemory, writeJsonConfig } from "@/lib/app-config-json";
import { persistVoiceBrief } from "@/lib/voice-brief-store";

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
const VOICE_BRIEF_URL = "http://localhost/api/admin/voice-brief";

const { mockRunAgent, mockFetch } = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/agent-voice-brief", () => ({
  runVoiceBriefAgent: (...a: unknown[]) => mockRunAgent(...a),
}));

vi.stubGlobal("fetch", mockFetch);

function makeAdminToken(): string {
  return "test-admin-session";
}

function makeUserToken(): string {
  return "test-user-session";
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeUserToken()}` },
  });
}

const MOCK_BRIEF = {
  text: "Weekly brief for Cloudless.gr.",
  generatedAt: new Date().toISOString(),
  week: "2026-W17",
};

describe("GET /api/admin/voice-brief", () => {
  beforeEach(() => {
    resetJsonConfigMemory();
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(new NextRequest(VOICE_BRIEF_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(userReq(VOICE_BRIEF_URL));
    expect(res.status).toBe(403);
  });

  it("returns brief from app_config when present", async () => {
    await persistVoiceBrief(MOCK_BRIEF);
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq(VOICE_BRIEF_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toMatchObject({
      text: MOCK_BRIEF.text,
      week: MOCK_BRIEF.week,
    });
  });

  it("returns null brief when nothing is stored", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq(VOICE_BRIEF_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toBeNull();
  });
});

describe("POST /api/admin/voice-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJsonConfigMemory();
    mockRunAgent.mockResolvedValue({
      text: "AI-enhanced brief.",
      sources: [],
    });
  });

  it("returns 401 without token", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(new NextRequest(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(
      new NextRequest(VOICE_BRIEF_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${makeUserToken()}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("calls the agent directly and returns the generated brief", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief.text).toBe("AI-enhanced brief.");
    expect(data.brief.week).toBe("on-demand");
    expect(typeof data.brief.generatedAt).toBe("string");
    expect(mockRunAgent).toHaveBeenCalledTimes(1);
  });

  it("returns the brief even when persist fails (best-effort)", async () => {
    const appConfig = await import("@/lib/app-config-json");
    vi.spyOn(appConfig, "writeJsonConfig").mockRejectedValueOnce(new Error("store down"));
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief.text).toBe("AI-enhanced brief.");
  });

  it("returns 500 when the agent throws", async () => {
    mockRunAgent.mockRejectedValueOnce(new Error("agent down"));
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("does NOT make any outbound HTTP call (no SSRF surface)", async () => {
    mockFetch.mockClear();
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
